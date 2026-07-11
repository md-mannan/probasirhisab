/**
 * Shared money parsing and formatting helpers.
 *
 * Amounts arrive from the backend as decimal strings (e.g. "1234.500"). These
 * helpers centralize the parse/format logic that was previously duplicated across
 * dashboard.tsx, transactions/index.tsx and the export utilities.
 *
 * IMPORTANT: `formatFixed` is intentionally group-separator free because its output
 * is fed back into numeric <input> fields. Use `formatMoney` only for display cells.
 */

/** Parse a decimal string into a finite number, or null when not parseable. */
export function parseAmount(value: string | number | null | undefined): number | null {
    if (value === null || value === undefined) {
        return null;
    }

    // Treat empty / whitespace-only strings as "no value". Number('') is 0, which
    // would otherwise be mistaken for a real zero amount.
    if (typeof value === 'string' && value.trim() === '') {
        return null;
    }

    const n = typeof value === 'number' ? value : Number(value);

    return Number.isFinite(n) ? n : null;
}

/**
 * Fixed-decimal string with no thousands separators. Safe to place into an
 * <input type="number"> value. Returns '' for non-finite input.
 */
export function formatFixed(value: number, decimals: number): string {
    if (!Number.isFinite(value)) {
        return '';
    }

    return value.toFixed(decimals);
}

/**
 * Display formatting with locale thousands separators, e.g. "1,234.50".
 * Display-only — do not feed the result back into number inputs.
 */
export function formatMoney(
    value: number,
    decimals: number,
    options?: { currency?: string; signed?: boolean },
): string {
    if (!Number.isFinite(value)) {
        return '';
    }

    const signed = options?.signed ?? false;
    const magnitude = Math.abs(value);
    const sign = signed && value < 0 ? '−' : '';

    const formatted = magnitude.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });

    return options?.currency
        ? `${sign}${formatted} ${options.currency}`
        : `${sign}${formatted}`;
}

/**
 * Compact display for large values: 1.2M, 34k, 1.2k, or the plain fixed value.
 * Mirrors the dashboard's original abbreviation thresholds exactly.
 */
export function formatCompact(
    value: number,
    decimals: number,
    currency: string,
): string {
    const abs = Math.abs(value);
    const sign = value < 0 ? '−' : '';

    if (abs >= 1_000_000) {
        return `${sign}${(abs / 1_000_000).toFixed(1)}M ${currency}`;
    }

    if (abs >= 10_000) {
        return `${sign}${(abs / 1000).toFixed(0)}k ${currency}`;
    }

    if (abs >= 1000) {
        return `${sign}${(abs / 1000).toFixed(1)}k ${currency}`;
    }

    return `${sign}${abs.toFixed(decimals)} ${currency}`;
}

/**
 * Multiply an amount by an FX rate and round to the target currency's scale.
 * Rounding at the boundary prevents fractional-cent drift when the result is
 * summed across many rows.
 */
export function convertWithRate(
    amount: number,
    rate: number,
    decimals: number,
): number {
    const product = amount * rate;

    return Number(product.toFixed(decimals));
}
