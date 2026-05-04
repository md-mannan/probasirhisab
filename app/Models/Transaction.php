<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable([
    'user_id',
    'category_id',
    'contact_id',
    'type',
    'amount',
    'secondary_amount',
    'settled_amount',
    'currency',
    'secondary_currency',
    'rate',
    'occurred_on',
    'sort_order',
    'note',
    'source',
])]
class Transaction extends Model
{
    protected static function booted(): void
    {
        static::deleting(function (Transaction $transaction): void {
            LedgerEntry::query()
                ->where('transaction_id', $transaction->id)
                ->delete();
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function contacts(): BelongsToMany
    {
        return $this->belongsToMany(Contact::class, 'contact_transaction')
            ->withTimestamps();
    }

    public function settlements(): HasMany
    {
        return $this->hasMany(TransactionSettlement::class);
    }

    public function ledgerEntry(): HasOne
    {
        return $this->hasOne(LedgerEntry::class);
    }
}
