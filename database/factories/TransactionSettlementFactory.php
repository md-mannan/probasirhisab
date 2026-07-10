<?php

namespace Database\Factories;

use App\Models\Transaction;
use App\Models\TransactionSettlement;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TransactionSettlement>
 */
class TransactionSettlementFactory extends Factory
{
    protected $model = TransactionSettlement::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'transaction_id' => Transaction::factory(),
            'user_id' => User::factory(),
            'category_id' => null,
            'sort_order' => null,
            'amount' => fake()->randomFloat(3, 1, 100),
            'paid_on' => fake()->dateTimeBetween('-6 months', 'now')->format('Y-m-d'),
            'source' => null,
            'note' => null,
        ];
    }

    public function forTransaction(Transaction $transaction): static
    {
        return $this->state(fn (array $attributes): array => [
            'transaction_id' => $transaction->id,
            'user_id' => $transaction->user_id,
        ]);
    }
}
