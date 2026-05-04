<?php

namespace App\Support;

use App\Models\Transaction;
use App\Models\TransactionSettlement;

/**
 * Shared ordering for the combined transactions + settlements list.
 */
final class TransactionListSortOrder
{
    /**
     * Next sort_order for a newly created row (monotonic per user across txs + settlements).
     * The transactions list is ordered ascending by sort_order (LILO: last added → largest key → bottom).
     */
    public static function nextForUser(int $userId): int
    {
        $maxTx = (int) (Transaction::query()
            ->where('user_id', $userId)
            ->max('sort_order') ?? 0);

        $maxSt = (int) (TransactionSettlement::query()
            ->where('user_id', $userId)
            ->max('sort_order') ?? 0);

        return max($maxTx, $maxSt) + 1;
    }
}
