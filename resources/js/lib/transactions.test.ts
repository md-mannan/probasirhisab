import { describe, expect, it } from 'vitest';
import {
    directionForType,
    formatDateDMY,
    isObligation,
    remainingFor,
    settledFor,
    statusLabel,
    totalFor,
} from '@/lib/transactions';

describe('directionForType', () => {
    it('returns -1 for outflows', () => {
        expect(directionForType('expense')).toBe(-1);
        expect(directionForType('payable')).toBe(-1);
        expect(directionForType('settle_payable')).toBe(-1);
    });

    it('returns +1 for inflows', () => {
        expect(directionForType('income')).toBe(1);
        expect(directionForType('receivable')).toBe(1);
        expect(directionForType('settle_receivable')).toBe(1);
    });
});

describe('isObligation', () => {
    it('is true only for payable/receivable', () => {
        expect(isObligation('payable')).toBe(true);
        expect(isObligation('receivable')).toBe(true);
        expect(isObligation('income')).toBe(false);
        expect(isObligation('settle_payable')).toBe(false);
    });
});

describe('statusLabel', () => {
    it('maps known statuses', () => {
        expect(statusLabel('unsettled')).toBe('Unsettled');
        expect(statusLabel('partial')).toBe('Partial');
        expect(statusLabel('settled')).toBe('Settled');
    });

    it('renders a dash for null/undefined', () => {
        expect(statusLabel(null)).toBe('—');
        expect(statusLabel(undefined)).toBe('—');
    });
});

describe('totalFor / settledFor / remainingFor', () => {
    it('totalFor returns absolute value', () => {
        expect(totalFor('-100.5')).toBe(100.5);
        expect(totalFor('250')).toBe(250);
    });

    it('settledFor clamps negatives to zero', () => {
        expect(settledFor('-5')).toBe(0);
        expect(settledFor('40')).toBe(40);
        expect(settledFor(null)).toBeNull();
    });

    it('remainingFor is total minus settled, clamped', () => {
        expect(remainingFor('100', '30')).toBe(70);
        expect(remainingFor('100', '150')).toBe(0);
        expect(remainingFor('100', null)).toBe(100);
    });

    it('remainingFor returns null when amount is not numeric', () => {
        expect(remainingFor('abc', '10')).toBeNull();
    });
});

describe('formatDateDMY', () => {
    it('reformats ISO dates', () => {
        expect(formatDateDMY('2026-07-09')).toBe('09/07/2026');
    });

    it('passes through non-ISO strings', () => {
        expect(formatDateDMY('not-a-date')).toBe('not-a-date');
    });
});
