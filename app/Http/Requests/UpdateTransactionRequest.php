<?php

namespace App\Http\Requests;

use App\Concerns\TransactionValidationRules;
use App\Models\Transaction;
use Illuminate\Foundation\Http\FormRequest;

class UpdateTransactionRequest extends FormRequest
{
    use TransactionValidationRules;

    /**
     * Only the owner may update a transaction. Returning false yields a 403,
     * matching the previous inline `abort(403)` guard.
     */
    public function authorize(): bool
    {
        $transaction = $this->route('transaction');

        return $transaction instanceof Transaction
            && $this->user() !== null
            && (int) $transaction->user_id === (int) $this->user()->id;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return $this->transactionRules();
    }
}
