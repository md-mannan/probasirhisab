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
