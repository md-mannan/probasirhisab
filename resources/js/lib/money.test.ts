import { describe, expect, it } from 'vitest';
import {
    convertWithRate,
    formatCompact,
    formatFixed,
    formatMoney,
    parseAmount,
} from '@/lib/money';

describe('parseAmount', () => {
    it('parses decimal strings', () => {
        expect(parseAmount('1234.500')).toBe(1234.5);
    });

    it('passes numbers through', () => {
        expect(parseAmount(42)).toBe(42);
    });

    it('returns null for empty / invalid / nullish input', () => {
        expect(parseAmount('')).toBeNull();
        expect(parseAmount('abc')).toBeNull();
        expect(parseAmount(null)).toBeNull();
        expect(parseAmount(undefined)).toBeNull();
        expect(parseAmount(Infinity)).toBeNull();
    });
});

describe('formatFixed', () => {
    it('formats to the requested decimals with no separators', () => {
        expect(formatFixed(1234.5, 3)).toBe('1234.500');
        expect(formatFixed(1234.5, 2)).toBe('1234.50');
    });

    it('returns empty string for non-finite input (matches legacy behaviour)', () => {
        expect(formatFixed(NaN, 2)).toBe('');
        expect(formatFixed(Infinity, 2)).toBe('');
    });

    it('output is safe to re-parse (round trip)', () => {
        const s = formatFixed(1000.25, 2);
        expect(parseAmount(s)).toBe(1000.25);
    });
});

describe('formatMoney', () => {
    it('adds thousands separators for display', () => {
        expect(formatMoney(1234.5, 2)).toBe('1,234.50');
    });

    it('appends currency when provided', () => {
        expect(formatMoney(1234.5, 2, { currency: 'BDT' })).toBe('1,234.50 BDT');
    });

    it('renders a minus sign only when signed and negative', () => {
        expect(formatMoney(-50, 2, { signed: true })).toBe('−50.00');
        expect(formatMoney(-50, 2)).toBe('50.00');
    });
});

describe('formatCompact', () => {
    it('abbreviates millions', () => {
        expect(formatCompact(2_500_000, 2, 'BDT')).toBe('2.5M BDT');
    });

    it('abbreviates >= 10k with no decimals', () => {
        expect(formatCompact(34_000, 2, 'BDT')).toBe('34k BDT');
    });

    it('abbreviates >= 1k with one decimal', () => {
        expect(formatCompact(1500, 2, 'BDT')).toBe('1.5k BDT');
    });

    it('shows the plain fixed value below 1k', () => {
        expect(formatCompact(750.5, 2, 'BDT')).toBe('750.50 BDT');
    });

    it('prefixes a minus sign for negatives', () => {
        expect(formatCompact(-2_000_000, 2, 'KWD')).toBe('−2.0M KWD');
    });
});

describe('convertWithRate', () => {
    it('multiplies and rounds to the target scale', () => {
        expect(convertWithRate(100, 3.5, 2)).toBe(350);
        expect(convertWithRate(100, 3.335, 2)).toBe(333.5);
    });

    it('avoids fractional-cent drift', () => {
        // 0.1 * 3 = 0.30000000000000004 in raw float
        expect(convertWithRate(0.1, 3, 2)).toBe(0.3);
    });
});
