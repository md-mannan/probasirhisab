/**
 * Parse an Excel workbook back into importable transaction rows.
 *
 * The shape accepted here is exactly what `transactions-export.ts` produces:
 * a header row (SL, Date, Type, Person, Category, Source, Primary (…),
 * Secondary (…), Status) followed by data rows, optionally preceded by a
 * "Period: …" label row. Derived settlement rows (type "Settle …"/"Settlement")
 * cannot be recreated as base transactions and are reported as skipped.
 */

export type ImportRow = {
    occurred_on: string; // ISO YYYY-MM-DD
    type: 'income' | 'expense' | 'payable' | 'receivable';
    category: string | null;
    source: string | null;
    contacts: string[];
    primary_amount: number | null;
    secondary_amount: number | null;
};

export type ParseResult = {
    rows: ImportRow[];
    /** Rows recognised but skipped because they are derived (settlements). */
    skipped: number;
    /** Human-readable problems found while parsing (bad dates, missing amounts). */
    errors: string[];
};

const EM_DASH = '—';

/** Map an exported type label (or raw key) to a base transaction type key. */
function normalizeType(
    raw: string,
): 'income' | 'expense' | 'payable' | 'receivable' | 'settlement' | null {
    const v = raw.trim().toLowerCase();

    if (v === 'income') return 'income';
    if (v === 'expense') return 'expense';
    if (v === 'receivable') return 'receivable';
    if (v === 'payable') return 'payable';

    // Derived rows exported for read-only views; not importable as base rows.
    if (v.includes('settle')) return 'settlement';

    return null;
}

/** Parse a DD/MM/YYYY (export format) or ISO date cell into ISO YYYY-MM-DD. */
function parseDate(raw: unknown): string | null {
    if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
        const y = raw.getFullYear();
        const m = String(raw.getMonth() + 1).padStart(2, '0');
        const d = String(raw.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    const s = String(raw ?? '').trim();

    const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
    if (dmy) {
        const d = dmy[1].padStart(2, '0');
        const m = dmy[2].padStart(2, '0');
        return `${dmy[3]}-${m}-${d}`;
    }

    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (iso) {
        return s;
    }

    return null;
}

/**
 * Parse a signed, currency-suffixed amount cell (e.g. "+ 1215.906 KWD" or
 * "- 170.025") into an absolute number. Direction is derived from type on the
 * server, so the magnitude alone is stored. Returns null for "—"/blank.
 */
function parseAmountCell(raw: unknown): number | null {
    if (typeof raw === 'number') {
        return Number.isFinite(raw) ? Math.abs(raw) : null;
    }

    const s = String(raw ?? '').trim();
    if (s === '' || s === EM_DASH) {
        return null;
    }

    // Strip a currency code and any grouping, keep the first numeric token.
    const m = /([\d]+(?:[.,]\d+)?)/.exec(s.replace(/,/g, ''));
    if (!m) {
        return null;
    }

    const n = Number(m[1]);

    return Number.isFinite(n) ? Math.abs(n) : null;
}

function parseText(raw: unknown): string | null {
    const s = String(raw ?? '').trim();
    return s === '' || s === EM_DASH ? null : s;
}

function parseContacts(raw: unknown): string[] {
    const s = parseText(raw);
    if (!s) {
        return [];
    }

    return s
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p !== '' && p !== EM_DASH);
}

/** Locate the header row index by finding the row that contains SL + Date + Type. */
function findHeaderRow(aoa: unknown[][]): number {
    for (let i = 0; i < Math.min(aoa.length, 15); i++) {
        const cells = aoa[i].map((c) => String(c ?? '').trim().toLowerCase());
        const hasSl = cells.includes('sl');
        const hasDate = cells.includes('date');
        const hasType = cells.includes('type');
        if (hasSl && hasDate && hasType) {
            return i;
        }
    }

    return -1;
}

/** Build a name→column-index map from a header row (case-insensitive prefix match). */
function columnIndex(header: unknown[]): Record<string, number> {
    const idx: Record<string, number> = {};
    header.forEach((cell, i) => {
        const label = String(cell ?? '').trim().toLowerCase();
        if (label.startsWith('date')) idx.date = i;
        else if (label.startsWith('type')) idx.type = i;
        else if (label.startsWith('person')) idx.person = i;
        else if (label.startsWith('category')) idx.category = i;
        else if (label.startsWith('source')) idx.source = i;
        else if (label.startsWith('primary')) idx.primary = i;
        else if (label.startsWith('secondary')) idx.secondary = i;
    });

    return idx;
}

export async function parseTransactionsWorkbook(
    file: File,
): Promise<ParseResult> {
    const XLSX = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
    const sheetName = wb.SheetNames[0];
    const sheet = sheetName ? wb.Sheets[sheetName] : undefined;

    if (!sheet) {
        return { rows: [], skipped: 0, errors: ['The file has no sheets.'] };
    }

    const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        raw: false,
        defval: '',
    });

    const headerRow = findHeaderRow(aoa);
    if (headerRow < 0) {
        return {
            rows: [],
            skipped: 0,
            errors: [
                'Could not find a header row with SL, Date and Type columns. Use a file exported by this app.',
            ],
        };
    }

    const cols = columnIndex(aoa[headerRow]);
    if (cols.date === undefined || cols.type === undefined) {
        return {
            rows: [],
            skipped: 0,
            errors: ['The header row is missing required Date/Type columns.'],
        };
    }

    const rows: ImportRow[] = [];
    const errors: string[] = [];
    let skipped = 0;

    for (let r = headerRow + 1; r < aoa.length; r++) {
        const row = aoa[r];
        // Skip fully empty rows.
        if (row.every((c) => String(c ?? '').trim() === '')) {
            continue;
        }

        const rowLabel = `Row ${r - headerRow}`;

        const type = normalizeType(String(row[cols.type] ?? ''));
        if (type === null) {
            errors.push(`${rowLabel}: unknown type "${String(row[cols.type] ?? '').trim()}" — skipped.`);
            continue;
        }
        if (type === 'settlement') {
            skipped++;
            continue;
        }

        const occurred_on = parseDate(row[cols.date]);
        if (!occurred_on) {
            errors.push(`${rowLabel}: invalid or missing date — skipped.`);
            continue;
        }

        const primary_amount =
            cols.primary === undefined
                ? null
                : parseAmountCell(row[cols.primary]);
        const secondary_amount =
            cols.secondary === undefined
                ? null
                : parseAmountCell(row[cols.secondary]);

        if (primary_amount === null && secondary_amount === null) {
            errors.push(`${rowLabel}: no amount found — skipped.`);
            continue;
        }

        rows.push({
            occurred_on,
            type,
            category:
                cols.category === undefined
                    ? null
                    : parseText(row[cols.category]),
            source:
                cols.source === undefined ? null : parseText(row[cols.source]),
            contacts:
                cols.person === undefined
                    ? []
                    : parseContacts(row[cols.person]),
            primary_amount,
            secondary_amount,
        });
    }

    return { rows, skipped, errors };
}
