<?php

use App\Models\Category;
use App\Models\Contact;
use App\Models\LedgerEntry;
use App\Models\Transaction;
use App\Models\User;
use App\Support\PrimaryCashBalance;

/**
 * HTTP-level tests for creating transactions: validation, FX derivation,
 * cash-balance guards, category authorization, and ledger side effects.
 */
function userWithCurrencies(): User
{
    return User::factory()->create([
        'primary_currency' => 'KWD',
        'secondary_currency' => 'BDT',
    ]);
}

test('guests cannot create transactions', function (): void {
    $this->post(route('transactions.store'), [])->assertRedirect(route('login'));
});

test('a valid income transaction is created and posted to the ledger', function (): void {
    $user = userWithCurrencies();
    $category = Category::factory()->ofType('income')->forUser($user)->create();

    $this->actingAs($user)
        ->from(route('transactions.index'))
        ->post(route('transactions.store'), [
            'type' => 'income',
            'category_id' => $category->id,
            'primary_amount' => 500,
            'occurred_on' => '2026-01-01',
        ])
        ->assertRedirect();

    $tx = Transaction::where('user_id', $user->id)->sole();
    expect((float) $tx->amount)->toBe(500.0)
        ->and($tx->currency)->toBe('KWD')
        ->and($tx->sort_order)->not->toBeNull();

    expect(LedgerEntry::where('transaction_id', $tx->id)->count())->toBe(1)
        ->and(PrimaryCashBalance::forUserId($user->id))->toBe(500.0);
});

test('secondary amount is derived from rate when only primary is provided', function (): void {
    $user = userWithCurrencies();
    $category = Category::factory()->ofType('income')->forUser($user)->create();

    $this->actingAs($user)->post(route('transactions.store'), [
        'type' => 'income',
        'category_id' => $category->id,
        'primary_amount' => 100,
        'rate' => 300,
        'occurred_on' => '2026-01-01',
    ])->assertRedirect();

    $tx = Transaction::where('user_id', $user->id)->sole();
    expect((float) $tx->secondary_amount)->toBe(30000.0)
        ->and($tx->secondary_currency)->toBe('BDT');
});

test('primary amount is derived from rate when only secondary is provided', function (): void {
    $user = userWithCurrencies();
    $category = Category::factory()->ofType('income')->forUser($user)->create();

    $this->actingAs($user)->post(route('transactions.store'), [
        'type' => 'income',
        'category_id' => $category->id,
        'secondary_amount' => 30000,
        'rate' => 300,
        'occurred_on' => '2026-01-01',
    ])->assertRedirect();

    $tx = Transaction::where('user_id', $user->id)->sole();
    expect((float) $tx->amount)->toBe(100.0);
});

test('creating a transaction with no amount is rejected', function (): void {
    $user = userWithCurrencies();
    $category = Category::factory()->ofType('income')->forUser($user)->create();

    $this->actingAs($user)
        ->from(route('transactions.index'))
        ->post(route('transactions.store'), [
            'type' => 'income',
            'category_id' => $category->id,
            'occurred_on' => '2026-01-01',
        ])
        ->assertSessionHasErrors('primary_amount');

    expect(Transaction::count())->toBe(0);
});

test('a zero or negative rate is rejected', function (): void {
    $user = userWithCurrencies();
    $category = Category::factory()->ofType('income')->forUser($user)->create();

    $this->actingAs($user)
        ->from(route('transactions.index'))
        ->post(route('transactions.store'), [
            'type' => 'income',
            'category_id' => $category->id,
            'primary_amount' => 100,
            'rate' => 0,
            'occurred_on' => '2026-01-01',
        ])
        ->assertSessionHasErrors('rate');
});

test('an expense is blocked when the user lacks sufficient cash', function (): void {
    $user = userWithCurrencies();
    $category = Category::factory()->ofType('expense')->forUser($user)->create();

    $this->actingAs($user)
        ->from(route('transactions.index'))
        ->post(route('transactions.store'), [
            'type' => 'expense',
            'category_id' => $category->id,
            'primary_amount' => 100,
            'occurred_on' => '2026-01-01',
        ])
        ->assertSessionHasErrors('primary_amount');

    expect(Transaction::count())->toBe(0);
});

test('an expense succeeds once the user has enough cash', function (): void {
    $user = userWithCurrencies();
    $income = Category::factory()->ofType('income')->forUser($user)->create();
    $expense = Category::factory()->ofType('expense')->forUser($user)->create();

    $this->actingAs($user)->post(route('transactions.store'), [
        'type' => 'income',
        'category_id' => $income->id,
        'primary_amount' => 500,
        'occurred_on' => '2026-01-01',
    ]);

    $this->actingAs($user)->post(route('transactions.store'), [
        'type' => 'expense',
        'category_id' => $expense->id,
        'primary_amount' => 200,
        'occurred_on' => '2026-01-02',
    ])->assertRedirect();

    expect(PrimaryCashBalance::forUserId($user->id))->toBe(300.0);
});

test('a category belonging to another user cannot be used', function (): void {
    $user = userWithCurrencies();
    $other = User::factory()->create();
    $foreignCategory = Category::factory()->ofType('income')->forUser($other)->create();

    $this->actingAs($user)
        ->from(route('transactions.index'))
        ->post(route('transactions.store'), [
            'type' => 'income',
            'category_id' => $foreignCategory->id,
            'primary_amount' => 100,
            'occurred_on' => '2026-01-01',
        ])
        ->assertSessionHasErrors('category_id');

    expect(Transaction::count())->toBe(0);
});

test('the category type must match the transaction type', function (): void {
    $user = userWithCurrencies();
    $mismatched = Category::factory()->ofType('expense')->forUser($user)->create();

    $this->actingAs($user)
        ->from(route('transactions.index'))
        ->post(route('transactions.store'), [
            'type' => 'income',
            'category_id' => $mismatched->id,
            'primary_amount' => 100,
            'occurred_on' => '2026-01-01',
        ])
        ->assertSessionHasErrors('category_id');
});

test('contacts are linked through the pivot table', function (): void {
    $user = userWithCurrencies();
    $category = Category::factory()->ofType('income')->forUser($user)->create();
    $contactA = Contact::factory()->forUser($user)->create();
    $contactB = Contact::factory()->forUser($user)->create();

    $this->actingAs($user)->post(route('transactions.store'), [
        'type' => 'income',
        'category_id' => $category->id,
        'primary_amount' => 100,
        'occurred_on' => '2026-01-01',
        'contact_ids' => [$contactA->id, $contactB->id],
    ])->assertRedirect();

    $tx = Transaction::where('user_id', $user->id)->sole();
    expect($tx->contacts()->pluck('contacts.id')->sort()->values()->all())
        ->toBe([$contactA->id, $contactB->id]);
});

test('a user cannot update another users transaction', function (): void {
    $owner = userWithCurrencies();
    $intruder = userWithCurrencies();
    $category = Category::factory()->ofType('income')->forUser($owner)->create();
    $tx = Transaction::factory()->forUser($owner)->income(100)->create([
        'category_id' => $category->id,
    ]);

    $this->actingAs($intruder)
        ->patch(route('transactions.update', $tx), [
            'type' => 'income',
            'category_id' => $category->id,
            'primary_amount' => 999,
            'occurred_on' => '2026-01-01',
        ])
        ->assertForbidden();
});
