<?php

namespace App\Support;

use App\Models\LedgerEntry;
use Illuminate\Support\Facades\DB;

/**
 * Net cash in the user's primary currency from posted ledger lines (credits − debits).
 */
final class PrimaryCashBalance
{
    public static function forUserId(int $userId): float
    {
        $driver = DB::getDriverName();

        $sumExpr = match ($driver) {
            'sqlite' => 'COALESCE(SUM(CAST(credit_primary AS REAL) - CAST(debit_primary AS REAL)), 0)',
            default => 'COALESCE(SUM(credit_primary - debit_primary), 0)',
        };

        $value = LedgerEntry::query()
            ->where('user_id', $userId)
            ->whereHas('transaction')
            ->selectRaw($sumExpr.' as cash_balance')
            ->value('cash_balance');

        return is_numeric($value) ? (float) $value : 0.0;
    }
}
