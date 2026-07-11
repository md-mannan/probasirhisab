<?php

namespace App\Models;

use Database\Factories\TransactionSettlementFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'transaction_id',
    'user_id',
    'category_id',
    'sort_order',
    'amount',
    'paid_on',
    'source',
    'note',
])]
class TransactionSettlement extends Model
{
    /** @use HasFactory<TransactionSettlementFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'transaction_id' => 'integer',
            'user_id' => 'integer',
            'category_id' => 'integer',
            'sort_order' => 'integer',
        ];
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }
}
