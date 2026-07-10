<?php

namespace Database\Factories;

use App\Models\Transaction;
use App\Models\User;
use App\Support\TransactionType;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Transaction>
 */
class TransactionFactory extends Factory
{
    protected $model = Transaction::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'category_id' => null,
            'contact_id' => null,
            'type' => fake()->randomElement(TransactionType::values()),
            'amount' => fake()->randomFloat(3, 1, 1000),
            'secondary_amount' => null,
            'settled_amount' => null,
            'currency' => 'KWD',
            'secondary_currency' => null,
            'rate' => null,
            'occurred_on' => fake()->dateTimeBetween('-1 year', 'now')->format('Y-m-d'),
            'sort_order' => null,
            'note' => null,
            'source' => null,
        ];
    }

    public function forUser(User $user): static
    {
        return $this->state(fn (array $attributes): array => [
            'user_id' => $user->id,
        ]);
    }

    public function ofType(string $type): static
    {
        return $this->state(fn (array $attributes): array => [
            'type' => $type,
        ]);
    }

    public function income(float $amount = 100): static
    {
        return $this->state(fn (array $attributes): array => [
            'type' => 'income',
            'amount' => $amount,
        ]);
    }

    public function expense(float $amount = 100): static
    {
        return $this->state(fn (array $attributes): array => [
            'type' => 'expense',
            'amount' => $amount,
        ]);
    }

    public function payable(float $amount = 100): static
    {
        return $this->state(fn (array $attributes): array => [
            'type' => 'payable',
            'amount' => $amount,
            'settled_amount' => 0,
        ]);
    }

    public function receivable(float $amount = 100): static
    {
        return $this->state(fn (array $attributes): array => [
            'type' => 'receivable',
            'amount' => $amount,
            'settled_amount' => 0,
        ]);
    }

    /**
     * Add a secondary-currency amount and FX rate (secondary = amount * rate).
     */
    public function withSecondary(float $rate, string $secondaryCurrency = 'BDT'): static
    {
        return $this->state(fn (array $attributes): array => [
            'secondary_currency' => $secondaryCurrency,
            'rate' => $rate,
            'secondary_amount' => (float) $attributes['amount'] * $rate,
        ]);
    }
}
