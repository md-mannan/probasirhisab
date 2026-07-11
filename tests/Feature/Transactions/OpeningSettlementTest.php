<?php

use App\Models\Category;
use App\Models\LedgerEntry;
use App\Models\Transaction;
use App\Models\TransactionSettlement;
use App\Models\User;
use App\Support\PrimaryCashBalance;

/**
 * The opening "already settled" amount entered when creating a payable/receivable
 * is now persisted as a real settlement record: it hits the ledger, affects the
 * cash balance, and is never dropped when further settlements are added later.
 */
function obligationUser(): User
{
    return User::factory()->create([
        'primary_currency' => 'KWD',
        'secondary_currency' => 'BDT',
    ]);
}

test('creating a payable with an opening settled amount records a settlement', function (): void {
    $user = obligationUser();
    $category = Category::factory()->ofType('payable')->forUser($user)->create();

    $this->actingAs($user)->post(route('transactions.store'), [
        'type' => 'payable',
        'category_id' => $category->id,
        'primary_amount' => 1000,
        'settled_amount' => 200,
        'occurred_on' => '2026-01-01',
    ])->assertRedirect();

    $tx = Transaction::where('user_id', $user->id)->sole();

    // Opening amount became a real settlement record dated on the transaction.
    $settlement = TransactionSettlement::where('transaction_id', $tx->id)->sole();
    expect((float) $settlement->amount)->toBe(200.0)
        ->and((string) $settlement->paid_on)->toContain('2026-01-01');

    // Column mirrors the settlement sum.
    expect((float) $tx->fresh()->settled_amount)->toBe(200.0);

    // Ledger has the base credit (+1000) and an opening settlement debit (-200).
    expect(LedgerEntry::where('transaction_id', $tx->id)->whereNotNull('settlement_id')->count())->toBe(1)
        ->and(PrimaryCashBalance::forUserId($user->id))->toBe(800.0);
});

test('the opening settled amount is not dropped when another settlement is added', function (): void {
    $user = obligationUser();
    $category = Category::factory()->ofType('payable')->forUser($user)->create();
    $settleCategory = Category::factory()->ofType('settle_payable')->forUser($user)->create();

    $this->actingAs($user)->post(route('transactions.store'), [
        'type' => 'payable',
        'category_id' => $category->id,
        'primary_amount' => 1000,
        'settled_amount' => 200,
        'occurred_on' => '2026-01-01',
    ])->assertRedirect();

    $tx = Transaction::where('user_id', $user->id)->sole();

    // Add a further settlement of 300 through the normal flow.
    $this->actingAs($user)->post(route('transactions.settlements.store', $tx), [
        'amount' => 300,
        'paid_on' => '2026-02-01',
        'category_id' => $settleCategory->id,
    ])->assertRedirect();

    // 200 opening + 300 = 500, NOT 300 (the old drop bug).
    expect((float) $tx->fresh()->settled_amount)->toBe(500.0)
        ->and(TransactionSettlement::where('transaction_id', $tx->id)->count())->toBe(2);
});

test('a receivable opening settlement reduces cash correctly', function (): void {
    $user = obligationUser();
    // Seed cash so the receivable (which debits full amount) can be created.
    $income = Category::factory()->ofType('income')->forUser($user)->create();
    $this->actingAs($user)->post(route('transactions.store'), [
        'type' => 'income',
        'category_id' => $income->id,
        'primary_amount' => 5000,
        'occurred_on' => '2026-01-01',
    ]);

    $category = Category::factory()->ofType('receivable')->forUser($user)->create();
    $this->actingAs($user)->post(route('transactions.store'), [
        'type' => 'receivable',
        'category_id' => $category->id,
        'primary_amount' => 1000,
        'settled_amount' => 400, // already collected 400 at creation
        'occurred_on' => '2026-01-02',
    ])->assertRedirect();

    // 5000 income - 1000 lent + 400 collected = 4400.
    expect(PrimaryCashBalance::forUserId($user->id))->toBe(4400.0);
});

test('editing an obligation below the already-settled total is rejected', function (): void {
    $user = obligationUser();
    $category = Category::factory()->ofType('payable')->forUser($user)->create();

    $this->actingAs($user)->post(route('transactions.store'), [
        'type' => 'payable',
        'category_id' => $category->id,
        'primary_amount' => 1000,
        'settled_amount' => 600,
        'occurred_on' => '2026-01-01',
    ])->assertRedirect();

    $tx = Transaction::where('user_id', $user->id)->sole();

    // Try to reduce the total below the 600 already settled.
    $this->actingAs($user)
        ->from(route('transactions.index'))
        ->patch(route('transactions.update', $tx), [
            'type' => 'payable',
            'category_id' => $category->id,
            'primary_amount' => 500,
            'occurred_on' => '2026-01-01',
        ])
        ->assertSessionHasErrors('primary_amount');

    expect((float) $tx->fresh()->amount)->toBe(1000.0);
});
