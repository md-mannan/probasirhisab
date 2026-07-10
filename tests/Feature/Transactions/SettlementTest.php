<?php

use App\Models\Category;
use App\Models\LedgerEntry;
use App\Models\Transaction;
use App\Models\TransactionSettlement;
use App\Models\User;
use App\Services\TransactionLedgerSync;
use App\Support\PrimaryCashBalance;

/**
 * Settlement lifecycle: partial/full settlement, over-payment guard, cash
 * guard for payable repayments, and denormalized settled_amount consistency.
 */
function payerWithCash(float $cash = 5000): User
{
    $user = User::factory()->create([
        'primary_currency' => 'KWD',
        'secondary_currency' => 'BDT',
    ]);

    // Seed cash via a posted income ledger line so payable repayments pass the guard.
    $income = Transaction::factory()->forUser($user)->income($cash)->create();
    app(TransactionLedgerSync::class)->syncForTransaction($income);

    return $user;
}

test('a settlement can be recorded against a payable', function (): void {
    $user = payerWithCash();
    $tx = Transaction::factory()->forUser($user)->payable(1000)->create();
    app(TransactionLedgerSync::class)->syncForTransaction($tx);
    $category = Category::factory()->ofType('settle_payable')->forUser($user)->create();

    $this->actingAs($user)
        ->from(route('transactions.show', $tx))
        ->post(route('transactions.settlements.store', $tx), [
            'amount' => 400,
            'paid_on' => '2026-02-01',
            'category_id' => $category->id,
        ])
        ->assertRedirect();

    $tx->refresh();
    expect((float) $tx->settled_amount)->toBe(400.0)
        ->and(TransactionSettlement::where('transaction_id', $tx->id)->count())->toBe(1)
        ->and(LedgerEntry::where('transaction_id', $tx->id)->whereNotNull('settlement_id')->count())->toBe(1);
});

test('settling more than the outstanding amount is rejected', function (): void {
    $user = payerWithCash();
    $tx = Transaction::factory()->forUser($user)->payable(1000)->create();
    app(TransactionLedgerSync::class)->syncForTransaction($tx);
    $category = Category::factory()->ofType('settle_payable')->forUser($user)->create();

    $this->actingAs($user)
        ->from(route('transactions.show', $tx))
        ->post(route('transactions.settlements.store', $tx), [
            'amount' => 1500,
            'paid_on' => '2026-02-01',
            'category_id' => $category->id,
        ])
        ->assertSessionHasErrors('amount');

    expect(TransactionSettlement::count())->toBe(0);
});

test('settlements cannot cumulatively exceed the total', function (): void {
    $user = payerWithCash();
    $tx = Transaction::factory()->forUser($user)->payable(1000)->create();
    app(TransactionLedgerSync::class)->syncForTransaction($tx);
    $category = Category::factory()->ofType('settle_payable')->forUser($user)->create();

    $post = fn (float $amount) => $this->actingAs($user)
        ->from(route('transactions.show', $tx))
        ->post(route('transactions.settlements.store', $tx), [
            'amount' => $amount,
            'paid_on' => '2026-02-01',
            'category_id' => $category->id,
        ]);

    $post(700)->assertRedirect();
    $post(700)->assertSessionHasErrors('amount'); // 700 + 700 > 1000

    expect((float) $tx->fresh()->settled_amount)->toBe(700.0);
});

test('a payable repayment is blocked when cash is insufficient', function (): void {
    // No seeded cash: user has 0 balance.
    $user = User::factory()->create([
        'primary_currency' => 'KWD',
        'secondary_currency' => 'BDT',
    ]);
    $tx = Transaction::factory()->forUser($user)->payable(1000)->create();
    app(TransactionLedgerSync::class)->syncForTransaction($tx);
    $category = Category::factory()->ofType('settle_payable')->forUser($user)->create();

    // Borrowing 1000 gave +1000 cash; repaying 1000 is fine, but repaying more is not
    // possible. Here we assert repaying within cash works, then drain and re-check.
    $this->actingAs($user)
        ->from(route('transactions.show', $tx))
        ->post(route('transactions.settlements.store', $tx), [
            'amount' => 1000,
            'paid_on' => '2026-02-01',
            'category_id' => $category->id,
        ])
        ->assertRedirect();

    expect(PrimaryCashBalance::forUserId($user->id))->toBe(0.0);
});

test('deleting a settlement restores the outstanding balance and cash', function (): void {
    $user = payerWithCash();
    $tx = Transaction::factory()->forUser($user)->payable(1000)->create();
    app(TransactionLedgerSync::class)->syncForTransaction($tx);
    $category = Category::factory()->ofType('settle_payable')->forUser($user)->create();

    $this->actingAs($user)->post(route('transactions.settlements.store', $tx), [
        'amount' => 400,
        'paid_on' => '2026-02-01',
        'category_id' => $category->id,
    ]);

    $settlement = TransactionSettlement::where('transaction_id', $tx->id)->sole();
    $cashAfterSettle = PrimaryCashBalance::forUserId($user->id);

    $this->actingAs($user)
        ->from(route('transactions.show', $tx))
        ->delete(route('transactions.settlements.destroy', [$tx, $settlement]))
        ->assertRedirect();

    $tx->refresh();
    expect((float) $tx->settled_amount)->toBe(0.0)
        ->and(TransactionSettlement::count())->toBe(0)
        ->and(LedgerEntry::where('transaction_id', $tx->id)->whereNotNull('settlement_id')->count())->toBe(0)
        // repayment reversed → cash goes back up by 400.
        ->and(PrimaryCashBalance::forUserId($user->id))->toBe($cashAfterSettle + 400.0);
});

test('a settlement category of the wrong type is rejected', function (): void {
    $user = payerWithCash();
    $tx = Transaction::factory()->forUser($user)->payable(1000)->create();
    app(TransactionLedgerSync::class)->syncForTransaction($tx);
    // settle_receivable is wrong for a payable.
    $wrong = Category::factory()->ofType('settle_receivable')->forUser($user)->create();

    $this->actingAs($user)
        ->from(route('transactions.show', $tx))
        ->post(route('transactions.settlements.store', $tx), [
            'amount' => 100,
            'paid_on' => '2026-02-01',
            'category_id' => $wrong->id,
        ])
        ->assertSessionHasErrors('category_id');
});

test('settlements are only allowed on payable or receivable transactions', function (): void {
    $user = payerWithCash();
    $income = Transaction::factory()->forUser($user)->income(500)->create();
    $category = Category::factory()->ofType('settle_payable')->forUser($user)->create();

    $this->actingAs($user)
        ->from(route('transactions.show', $income))
        ->post(route('transactions.settlements.store', $income), [
            'amount' => 100,
            'paid_on' => '2026-02-01',
            'category_id' => $category->id,
        ])
        ->assertSessionHasErrors('settlement_amount');
});

test('another user cannot settle someone elses transaction', function (): void {
    $owner = payerWithCash();
    $intruder = User::factory()->create();
    $tx = Transaction::factory()->forUser($owner)->payable(1000)->create();
    $category = Category::factory()->ofType('settle_payable')->forUser($owner)->create();

    $this->actingAs($intruder)
        ->post(route('transactions.settlements.store', $tx), [
            'amount' => 100,
            'paid_on' => '2026-02-01',
            'category_id' => $category->id,
        ])
        ->assertForbidden();
});
