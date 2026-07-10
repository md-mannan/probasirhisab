/**
 * Pure helpers for the transactions list. Extracted from the (very large)
 * transactions/index.tsx page so the row math is unit-testable and reusable.
 */
import { parseAmount } from '@/lib/money';

/** Cash direction of a row type: -1 = outflow, +1 = inflow. */
export function directionForType(type: string): -1 | 1 {
    if (type === 'expense' || type === 'payable' || type === 'settle_payable') {
        return -1;
    }

    return 1; // income + receivable + settle_receivable
}

/** Whether a transaction type is a settleable obligation. */
export function isObligation(type: string): boolean {
    return type === 'payable' || type === 'receivable';
}

/** Human label for a settlement status value. */
export function statusLabel(
    status: 'unsettled' | 'partial' | 'settled' | null | undefined,
): string {
    switch (status) {
        case 'unsettled':
            return 'Unsettled';
        case 'partial':
            return 'Partial';
        case 'settled':
            return 'Settled';
        default:
            return '—';
    }
}

/** Absolute total of a row, or null when the amount is not numeric. */
export function totalFor(amount: string | number | null | undefined): number | null {
    const parsed = parseAmount(amount);

    return parsed === null ? null : Math.abs(parsed);
}

/** Settled amount clamped to >= 0, or null when not numeric. */
export function settledFor(
    settledAmount: string | number | null | undefined,
): number | null {
    const parsed = parseAmount(settledAmount);

    return parsed === null ? null : Math.max(0, parsed);
}

/** Remaining outstanding amount (total - settled), clamped to >= 0. */
export function remainingFor(
    amount: string | number | null | undefined,
    settledAmount: string | number | null | undefined,
): number | null {
    const total = totalFor(amount);
    const settled = settledFor(settledAmount) ?? 0;

    if (total === null) {
        return null;
    }

    return Math.max(0, total - settled);
}

/** Format an ISO date (YYYY-MM-DD) as DD/MM/YYYY, passing through unknown formats. */
export function formatDateDMY(iso: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);

    if (!m) {
        return iso;
    }

    return `${m[3]}/${m[2]}/${m[1]}`;
}
