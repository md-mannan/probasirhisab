<?php

namespace App\Concerns;

use App\Support\TransactionType;
use Illuminate\Validation\Rule;

trait TransactionValidationRules
{
    /**
     * Shared validation rules for creating and updating a transaction.
     *
     * @return array<string, array<int, mixed>>
     */
    protected function transactionRules(): array
    {
        return [
            'type' => ['required', 'string', Rule::in(TransactionType::values())],
            'category_id' => ['required', 'integer'],
            'contact_id' => ['nullable', 'integer'], // legacy single person
            'contact_ids' => ['nullable', 'array', 'max:10'],
            'contact_ids.*' => ['integer', 'distinct'],
            'primary_amount' => ['nullable', 'numeric'],
            'secondary_amount' => ['nullable', 'numeric'],
            'settled_amount' => ['nullable', 'numeric', 'min:0'],
            'rate' => ['nullable', 'numeric'],
            'occurred_on' => ['required', 'date'],
            'note' => ['nullable', 'string', 'max:5000'],
            'source' => ['nullable', 'string', 'max:255'],
        ];
    }
}
