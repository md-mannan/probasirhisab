<?php

namespace App\Models;

use Database\Factories\TransactionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
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
    /** @use HasFactory<TransactionFactory> */
    use HasFactory;

    /**
     * Casts keep foreign keys as integers. MySQL/PDO can return them as strings; strict
     * `user_id !== auth()->id()` would then fail with 403 on show/update/delete.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'category_id' => 'integer',
            'contact_id' => 'integer',
            'sort_order' => 'integer',
        ];
    }

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
