<?php

use App\Models\Category;
use App\Models\Transaction;
use App\Models\User;

/**
 * The transactions index exposes listMeta so the UI can warn about truncation
 * instead of silently hiding rows beyond the load cap.
 */
test('listMeta reports totals and is not truncated for a small list', function (): void {
    $user = User::factory()->create([
        'primary_currency' => 'KWD',
        'secondary_currency' => 'BDT',
    ]);
    $category = Category::factory()->ofType('income')->forUser($user)->create();
    Transaction::factory()->count(3)->forUser($user)->income(100)->create([
        'category_id' => $category->id,
    ]);

    $this->actingAs($user)
        ->get(route('transactions.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('listMeta.total', 3)
            ->where('listMeta.shown', 3)
            ->where('listMeta.truncated', false));
});
