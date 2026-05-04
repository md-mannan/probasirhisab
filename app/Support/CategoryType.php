<?php

namespace App\Support;

final class CategoryType
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
            'settle_payable' => 'Settle payable',
            'settle_receivable' => 'Settle receivable',
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
