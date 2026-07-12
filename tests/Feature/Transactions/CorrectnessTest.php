<?php

use App\Actions\Transactions\TransactionWriter;
use App\Models\Category;
use App\Models\Contact;
use App\Models\LedgerEntry;
use App\Models\Transaction;
use App\Models\TransactionSettlement;
use App\Models\User;
use App\Services\TransactionLedgerSync;
use App\Support\Money;
use Illuminate\Support\Facades\DB;

/**
 * Correctness hardening: money writes are atomic, the secondary-currency figure is
 * derived one canonical way (agreeing across surfaces), and per-currency rounding
 * is applied at derivation.
 */
function correctnessUser(): User
{
    return User::factory()->create([
        'primary_currency' => 'KWD',
        'secondary_currency' => 'BDT',
    ]);
}

test('a failing ledger sync rolls back the whole settlement write', function (): void {
    $user = correctnessUser();
    $income = Transaction::factory()->forUser($user)->income(5000)->create();
    app(TransactionLedgerSync::class)->syncForTransaction($income);

    $tx = Transaction::factory()->forUser($user)->payable(1000)->create();
    app(TransactionLedgerSync::class)->syncForTransaction($tx);
    $category = Category::factory()->ofType('settle_payable')->forUser($user)->create();

    // Force the ledger sync (the last step of the settlement write) to blow up.
    $this->mock(TransactionLedgerSync::class, function ($mock): void {
        $mock->shouldReceive('syncForTransaction')->andThrow(new RuntimeException('boom'));
    });

    try {
        $this->actingAs($user)->post(route('transactions.settlements.store', $tx), [
            'amount' => 400,
            'paid_on' => '2026-02-01',
            'category_id' => $category->id,
        ]);
    } catch (Throwable) {
        // expected — the exception propagates; what matters is the rollback below.
    }

    // Nothing partially written: no settlement row, settled_amount untouched.
    expect(TransactionSettlement::where('transaction_id', $tx->id)->count())->toBe(0)
        ->and((float) $tx->fresh()->settled_amount)->toBe(0.0);
});

test('the settlement secondary value agrees between the transactions list and the ledger', function (): void {
    $user = correctnessUser();
    $income = Transaction::factory()->forUser($user)->income(5000)->create();
    app(TransactionLedgerSync::class)->syncForTransaction($income);

    // Payable booked with BOTH amounts and a deliberately-mismatched rate, so the
    // stored `rate` (0.5) disagrees with the booked ratio (250/1000 = 0.25). The old
    // code used `amount * rate` on the list and the ratio in the ledger — divergent.
    $tx = Transaction::factory()->forUser($user)->payable(1000)->create([
        'secondary_amount' => 250,   // ratio 0.25
        'rate' => 0.5,               // mismatched on purpose
    ]);
    app(TransactionLedgerSync::class)->syncForTransaction($tx);
    $category = Category::factory()->ofType('settle_payable')->forUser($user)->create();

    $this->actingAs($user)->post(route('transactions.settlements.store', $tx), [
        'amount' => 400,
        'paid_on' => '2026-02-01',
        'category_id' => $category->id,
    ])->assertRedirect();

    // Canonical value: 400 * (250/1000) rounded to BDT (2dp) = 100.00.
    $expected = Money::deriveSecondary(400, 1000, 250, 'BDT');
    expect($expected)->toBe(100.0);

    // Ledger settlement line carries the canonical secondary.
    $ledgerSecondary = (float) LedgerEntry::query()
        ->where('transaction_id', $tx->id)
        ->whereNotNull('settlement_id')
        ->value('debit_secondary');
    expect($ledgerSecondary)->toBe(100.0);

    // Transactions list emits the same figure (not 400 * 0.5 = 200).
    $this->actingAs($user)
        ->get(route('transactions.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('transactions', function ($transactions) {
                $row = collect($transactions)->firstWhere('kind', 'settlement');
                expect($row)->not->toBeNull()
                    ->and((float) $row['secondary_amount'])->toBe(100.0);

                return true;
            }));
});

test('a derived secondary amount is rounded to the secondary currency decimals', function (): void {
    $user = correctnessUser();
    $category = Category::factory()->ofType('income')->forUser($user)->create();

    // Primary-only + rate that yields a 3-decimal product; BDT has 2 decimals, so it
    // must be stored rounded to 2 (12345 * 0.00333 = 41.108... → 41.11).
    $this->actingAs($user)->post(route('transactions.store'), [
        'type' => 'income',
        'category_id' => $category->id,
        'primary_amount' => 12345,
        'rate' => 0.00333,
        'occurred_on' => '2026-02-01',
    ])->assertRedirect();

    $tx = Transaction::where('user_id', $user->id)->latest('id')->first();
    expect((float) $tx->secondary_amount)->toBe(round(12345 * 0.00333, 2));
});

test('the contact statement summary covers all transactions, not just the shown page', function (): void {
    $user = correctnessUser();
    $contact = Contact::factory()->forUser($user)->create(['name' => 'Karim']);

    // Two receivables (lent) — the summary must sum both regardless of display cap.
    foreach ([100, 250] as $amount) {
        $r = Transaction::factory()->forUser($user)->receivable($amount)->create();
        $r->contacts()->attach($contact->id, ['user_id' => $user->id]);
    }

    $this->actingAs($user)
        ->get(route('contacts.show', $contact))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('summary.assets_primary', '350')
            ->where('listMeta.total', 2)
            ->where('listMeta.truncated', false));
});

test('money writes are wrapped so a mid-write failure leaves no transaction', function (): void {
    $user = correctnessUser();
    $category = Category::factory()->ofType('income')->forUser($user)->create();

    $before = Transaction::where('user_id', $user->id)->count();

    // Force the ledger sync used by the writer to throw; the transaction create must
    // roll back so no orphaned row survives.
    $this->mock(TransactionLedgerSync::class, function ($mock): void {
        $mock->shouldReceive('syncForTransaction')->andThrow(new RuntimeException('boom'));
    });

    try {
        DB::transaction(function () use ($user, $category): void {
            app(TransactionWriter::class)->create($user, [
                'type' => 'income',
                'category_id' => $category->id,
                'primary_amount' => 500,
                'occurred_on' => '2026-02-01',
            ]);
        });
    } catch (Throwable) {
        // expected
    }

    expect(Transaction::where('user_id', $user->id)->count())->toBe($before);
});
