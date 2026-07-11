<?php

use App\Models\Transaction;
use App\Models\User;

/**
 * Numeric guard for the dashboard summary. Locks the computed figures so the
 * caching refactor is provably behaviour-preserving.
 */
test('dashboard summary reports the expected primary totals', function (): void {
    $user = User::factory()->create([
        'primary_currency' => 'KWD',
        'secondary_currency' => 'BDT',
    ]);

    Transaction::factory()->forUser($user)->income(5000)->create();
    Transaction::factory()->forUser($user)->expense(1200)->create();
    Transaction::factory()->forUser($user)->payable(800)->create(['settled_amount' => 0]);
    Transaction::factory()->forUser($user)->receivable(600)->create(['settled_amount' => 0]);

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            // cash = 5000 - 1200 + 800 - 600 = 4000
            ->where('summary.cash.primary', '4000')
            // net = (cash 4000 + receivable 600) - payable 800 = 3800
            ->where('summary.net.primary', '3800')
            ->where('summary.income.primary', '5000')
            ->where('summary.income.count', 1)
            ->where('summary.expense.primary', '1200')
            ->where('summary.payable.remainingPrimary', '800')
            ->where('summary.receivable.remainingPrimary', '600'));
});

test('dashboard reflects new data after a transaction is added (cache invalidates)', function (): void {
    $user = User::factory()->create([
        'primary_currency' => 'KWD',
        'secondary_currency' => 'BDT',
    ]);

    Transaction::factory()->forUser($user)->income(1000)->create();

    $this->actingAs($user)->get(route('dashboard'))
        ->assertInertia(fn ($page) => $page->where('summary.cash.primary', '1000'));

    Transaction::factory()->forUser($user)->income(500)->create();

    $this->actingAs($user)->get(route('dashboard'))
        ->assertInertia(fn ($page) => $page->where('summary.cash.primary', '1500'));
});
