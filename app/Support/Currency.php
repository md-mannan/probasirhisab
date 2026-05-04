<?php

namespace App\Support;

final class Currency
{
    /**
     * @return array<string, array{label: string, decimals: int}>
     */
    public static function supported(): array
    {
        return [
            'KWD' => ['label' => 'Kuwaiti Dinar (KWD)', 'decimals' => 3],
            'USD' => ['label' => 'US Dollar (USD)', 'decimals' => 3],
            'EUR' => ['label' => 'Euro (EUR)', 'decimals' => 3],

            'BDT' => ['label' => 'Bangladeshi Taka (BDT)', 'decimals' => 2],
            'INR' => ['label' => 'Indian Rupee (INR)', 'decimals' => 2],
            'PKR' => ['label' => 'Pakistani Rupee (PKR)', 'decimals' => 2],
            'LKR' => ['label' => 'Sri Lankan Rupee (LKR)', 'decimals' => 2],
        ];
    }

    /**
     * @return list<string>
     */
    public static function codes(): array
    {
        return array_keys(self::supported());
    }

    public static function decimalsFor(string $code): int
    {
        return self::supported()[$code]['decimals'] ?? 2;
    }
}
