<?php

use App\Models\LedgerEntry;
use App\Models\Transaction;
use App\Models\TransactionSettlement;
use App\Models\User;
use App\Services\TransactionLedgerSync;
use App\Support\PrimaryCashBalance;

/**
 * Accounting invariants for TransactionLedgerSync. The ledger is the source of
 * truth for cash: net cash == SUM(credit_primary - debit_primary).
 */
beforeEach(function (): void {
    $this->sync = app(TransactionLedgerSync::class);
});

function makeTransaction(User $user, string $type, float $amount, ?float $secondary = null): Transaction
{
    return Transaction::factory()->forUser($user)->create([
        'type' => $type,
        'amount' => $amount,
        'secondary_amount' => $secondary,
        'secondary_currency' => $secondary !== null ? 'BDT' : null,
        'currency' => 'KWD',
    ]);
}

test('income creates a single credit ledger line', function (): void {
    $user = User::factory()->create();
    $tx = makeTransaction($user, 'income', 500);

    $this->sync->syncForTransaction($tx);

    $entries = LedgerEntry::where('transaction_id', $tx->id)->get();
    expect($entries)->toHaveCount(1);

    $entry = $entries->first();
    expect((float) $entry->credit_primary)->toBe(500.0)
        ->and((float) $entry->debit_primary)->toBe(0.0)
        ->and($entry->settlement_id)->toBeNull();
});

test('expense creates a single debit ledger line', function (): void {
    $user = User::factory()->create();
    $tx = makeTransaction($user, 'expense', 300);

    $this->sync->syncForTransaction($tx);

    $entry = LedgerEntry::where('transaction_id', $tx->id)->sole();
    expect((float) $entry->debit_primary)->toBe(300.0)
        ->and((float) $entry->credit_primary)->toBe(0.0);
});

test('payable credits cash (money borrowed increases cash)', function (): void {
    $user = User::factory()->create();
    $tx = makeTransaction($user, 'payable', 1000);

    $this->sync->syncForTransaction($tx);

    $entry = LedgerEntry::where('transaction_id', $tx->id)->whereNull('settlement_id')->sole();
    expect((float) $entry->credit_primary)->toBe(1000.0)
        ->and((float) $entry->debit_primary)->toBe(0.0);
});

test('receivable debits cash (money lent decreases cash)', function (): void {
    $user = User::factory()->create();
    $tx = makeTransaction($user, 'receivable', 750);

    $this->sync->syncForTransaction($tx);

    $entry = LedgerEntry::where('transaction_id', $tx->id)->whereNull('settlement_id')->sole();
    expect((float) $entry->debit_primary)->toBe(750.0)
        ->and((float) $entry->credit_primary)->toBe(0.0);
});

test('payable settlement adds a debit line (cash out on repayment)', function (): void {
    $user = User::factory()->create();
    $tx = makeTransaction($user, 'payable', 1000);
    TransactionSettlement::factory()->forTransaction($tx)->create(['amount' => 400]);

    $this->sync->syncForTransaction($tx->fresh(['settlements']));

    $settlementLine = LedgerEntry::where('transaction_id', $tx->id)->whereNotNull('settlement_id')->sole();
    expect((float) $settlementLine->debit_primary)->toBe(400.0)
        ->and((float) $settlementLine->credit_primary)->toBe(0.0);

    // Net cash after borrowing 1000 and repaying 400 = 600.
    expect(PrimaryCashBalance::forUserId($user->id))->toBe(600.0);
});

test('receivable settlement adds a credit line (cash in on collection)', function (): void {
    $user = User::factory()->create();
    // Give the user cash so the receivable can be created without a guard failure.
    $income = makeTransaction($user, 'income', 2000);
    $this->sync->syncForTransaction($income);

    $tx = makeTransaction($user, 'receivable', 1000);
    $this->sync->syncForTransaction($tx);
    TransactionSettlement::factory()->forTransaction($tx)->create(['amount' => 250]);

    $this->sync->syncForTransaction($tx->fresh(['settlements']));

    $settlementLine = LedgerEntry::where('transaction_id', $tx->id)->whereNotNull('settlement_id')->sole();
    expect((float) $settlementLine->credit_primary)->toBe(250.0)
        ->and((float) $settlementLine->debit_primary)->toBe(0.0);

    // 2000 income - 1000 lent + 250 collected = 1250.
    expect(PrimaryCashBalance::forUserId($user->id))->toBe(1250.0);
});

test('removing a settlement prunes its ledger line', function (): void {
    $user = User::factory()->create();
    $tx = makeTransaction($user, 'payable', 1000);
    $settlement = TransactionSettlement::factory()->forTransaction($tx)->create(['amount' => 400]);

    $this->sync->syncForTransaction($tx->fresh(['settlements']));
    expect(LedgerEntry::where('transaction_id', $tx->id)->count())->toBe(2);

    $settlement->delete();
    $this->sync->syncForTransaction($tx->fresh(['settlements']));

    expect(LedgerEntry::where('transaction_id', $tx->id)->count())->toBe(1)
        ->and(LedgerEntry::where('transaction_id', $tx->id)->whereNotNull('settlement_id')->count())->toBe(0);
});

test('changing type from payable to income clears orphan settlement lines', function (): void {
    $user = User::factory()->create();
    $tx = makeTransaction($user, 'payable', 1000);
    TransactionSettlement::factory()->forTransaction($tx)->create(['amount' => 200]);
    $this->sync->syncForTransaction($tx->fresh(['settlements']));

    expect(LedgerEntry::where('transaction_id', $tx->id)->count())->toBe(2);

    // Re-type to income: settlement lines are no longer valid and must be removed.
    $tx->update(['type' => 'income']);
    $this->sync->syncForTransaction($tx->fresh(['settlements']));

    expect(LedgerEntry::where('transaction_id', $tx->id)->whereNotNull('settlement_id')->count())->toBe(0);
});

test('secondary currency amounts are projected onto ledger lines', function (): void {
    $user = User::factory()->create();
    $tx = makeTransaction($user, 'income', 100, secondary: 30000); // rate ~300

    $this->sync->syncForTransaction($tx);

    $entry = LedgerEntry::where('transaction_id', $tx->id)->sole();
    expect((float) $entry->credit_secondary)->toBe(30000.0)
        ->and((float) $entry->debit_secondary)->toBe(0.0)
        ->and($entry->secondary_currency)->toBe('BDT');
});

test('settlement secondary amount is derived proportionally from the transaction ratio', function (): void {
    $user = User::factory()->create();
    // payable of 1000 KWD == 300000 BDT (ratio 300).
    $tx = makeTransaction($user, 'payable', 1000, secondary: 300000);
    TransactionSettlement::factory()->forTransaction($tx)->create(['amount' => 100]);

    $this->sync->syncForTransaction($tx->fresh(['settlements']));

    $settlementLine = LedgerEntry::where('transaction_id', $tx->id)->whereNotNull('settlement_id')->sole();
    // 100 KWD paid * ratio 300 = 30000 BDT.
    expect((float) $settlementLine->debit_secondary)->toBe(30000.0);
});

test('cash balance equals sum of ledger credits minus debits across mixed activity', function (): void {
    $user = User::factory()->create();

    foreach ([
        ['income', 5000],
        ['expense', 1200],
        ['payable', 800],
        ['receivable', 600],
    ] as [$type, $amount]) {
        $tx = makeTransaction($user, $type, $amount);
        $this->sync->syncForTransaction($tx);
    }

    // 5000 - 1200 + 800 - 600 = 4000.
    $expected = LedgerEntry::where('user_id', $user->id)
        ->sum('credit_primary') - LedgerEntry::where('user_id', $user->id)->sum('debit_primary');

    expect(PrimaryCashBalance::forUserId($user->id))->toBe((float) $expected)
        ->and(PrimaryCashBalance::forUserId($user->id))->toBe(4000.0);
});

test('deleting a transaction removes all its ledger entries', function (): void {
    $user = User::factory()->create();
    $tx = makeTransaction($user, 'payable', 1000);
    TransactionSettlement::factory()->forTransaction($tx)->create(['amount' => 300]);
    $this->sync->syncForTransaction($tx->fresh(['settlements']));

    expect(LedgerEntry::where('transaction_id', $tx->id)->count())->toBe(2);

    $tx->delete();

    expect(LedgerEntry::where('transaction_id', $tx->id)->count())->toBe(0);
});
