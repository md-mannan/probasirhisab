<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id',
    'transaction_id',
    'settlement_id',
    'occurred_on',
    'type',
    'description',
    'primary_amount',
    'primary_currency',
    'secondary_amount',
    'secondary_currency',
    'debit_primary',
    'credit_primary',
    'debit_secondary',
    'credit_secondary',
])]
class LedgerEntry extends Model
{
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }

    public function settlement(): BelongsTo
    {
        return $this->belongsTo(TransactionSettlement::class, 'settlement_id');
    }
}
