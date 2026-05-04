<?php

namespace App\Support;

final class TransactionType
{
    /**
     * @return array<string, string>
     */
    public static function labels(): array
    {
        return [
            'income' => 'Income',
            'expense' => 'Expense',
            'payable' => 'Payable',
            'receivable' => 'Receivable',
        ];
    }

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_keys(self::labels());
    }
}
