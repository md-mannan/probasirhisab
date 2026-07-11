<?php

use App\Models\Category;
use App\Models\Transaction;
use App\Models\User;

/**
 * A payable/receivable can carry an opening "already settled" amount entered at
 * creation (no settlement record). The transactions list, the detail page and the
 * dashboard must all report the same settled/remaining figures from that column.
 */
function userKwdBdt(): User
{
    return User::factory()->create([
        'primary_currency' => 'KWD',
        'secondary_currency' => 'BDT',
    ]);
}

test('the list reflects the opening settled amount (matches dashboard source)', function (): void {
    $user = userKwdBdt();
    $tx = Transaction::factory()->forUser($user)->payable(1000)->create([
        'settled_amount' => 400, // opening, no settlement records
    ]);

    $this->actingAs($user)
        ->get(route('transactions.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('transactions.0.transaction_id', $tx->id)
            ->where('transactions.0.settled_amount', '400')
            ->where('transactions.0.settlement_status', 'partial'));
});

test('the detail page reports the same settled amount as the list', function (): void {
    $user = userKwdBdt();
    $tx = Transaction::factory()->forUser($user)->receivable(1000)->create([
        'settled_amount' => 1000, // fully settled at creation
    ]);

    $this->actingAs($user)
        ->get(route('transactions.show', $tx))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('transaction.settled_amount', '1000')
            ->where('transaction.settlement_status', 'settled'));
});
