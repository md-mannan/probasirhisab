<?php

namespace App\Support;

/**
 * Central helpers for money arithmetic. Amounts are stored as decimal(18,3); all
 * derived values (FX conversions, ratios) are rounded to a stable scale here so
 * accumulation across many rows does not drift into fractional-cent noise.
 *
 * A small epsilon is used for "greater than" comparisons to tolerate the float
 * representation of decimal values coming back from the database driver.
 */
final class Money
{
    /** Comparison tolerance for money values (well below the 3-decimal storage scale). */
    public const EPSILON = 0.0000001;

    /** Storage scale for monetary columns (decimal(18,3)). */
    public const SCALE = 3;

    /** Round a derived amount to the storage scale. */
    public static function round(float $value, int $scale = self::SCALE): float
    {
        return round($value, $scale);
    }

    /** Round a value to the number of decimals the given currency actually uses. */
    public static function roundFor(float $value, string $currencyCode): float
    {
        return round($value, Currency::decimalsFor($currencyCode));
    }

    /**
     * The single, canonical secondary-currency derivation. Given a portion of a
     * transaction's primary amount (the whole amount, or one settlement's amount),
     * convert it to the secondary currency using the ratio actually booked on the
     * transaction (secondary_amount / amount) and round to the secondary currency's
     * decimals. Returns null when the transaction has no secondary amount or a zero
     * primary (division guard).
     *
     * Using the booked ratio — not the stored `rate` column — keeps every surface
     * (ledger, transactions list, dashboard, balance sheet) in agreement.
     */
    public static function deriveSecondary(
        float $primaryPortion,
        ?float $txPrimary,
        ?float $txSecondary,
        string $secondaryCurrency,
    ): ?float {
        if ($txSecondary === null || $txPrimary === null || abs($txPrimary) < self::EPSILON) {
            return null;
        }

        return self::roundFor($primaryPortion * ($txSecondary / $txPrimary), $secondaryCurrency);
    }

    /** True when $a is strictly greater than $b beyond the tolerance. */
    public static function greaterThan(float $a, float $b): bool
    {
        return $a > $b + self::EPSILON;
    }

    /** True when $a is strictly less than $b beyond the tolerance. */
    public static function lessThan(float $a, float $b): bool
    {
        return $a + self::EPSILON < $b;
    }
}
