import { savePdfFromIsolatedHtml } from '@/lib/html2pdf-isolated';

export type LedgerExportRow = {
    transaction_id: number;
    settlement_id?: number | null;
    occurred_on: string;
    type: string;
    description: string | null;
    source: string | null;
    category: { id: number; name: string; type: string } | null;
    debit_primary: string;
    credit_primary: string;
    debit_secondary: string | null;
    credit_secondary: string | null;
    primary_currency: string;
    secondary_currency: string | null;
    running_primary: string;
    running_secondary: string | null;
};

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

const EXPORT_TABLE_CSS = `
  .ledger-export-root {
    font-family: "Noto Sans Bengali", "Noto Sans", ui-sans-serif, system-ui, sans-serif;
    font-size: 11px;
    line-height: 1.4;
    color: #111;
    -webkit-font-smoothing: antialiased;
  }
  .ledger-export-root h1 {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 4px 0;
    font-family: "Noto Sans", ui-sans-serif, system-ui, sans-serif;
  }
  .ledger-export-root .meta {
    color: #52525b;
    margin-bottom: 16px;
    font-size: 11px;
  }
  .ledger-export-root .meta .period {
    font-weight: 600;
    color: #3f3f46;
  }
  .ledger-export-root table {
    width: auto;
    max-width: 100%;
    border-collapse: collapse;
    table-layout: auto;
  }
  .ledger-export-root th,
  .ledger-export-root td {
    border: 1px solid #d4d4d8;
    padding: 6px 8px;
    vertical-align: top;
    width: auto;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  .ledger-export-root th {
    background: #705cfc;
    color: #fff;
    font-weight: 600;
    text-align: left;
  }
  .ledger-export-root td:nth-child(6),
  .ledger-export-root td:nth-child(7),
  .ledger-export-root td:nth-child(8),
  .ledger-export-root td:nth-child(9),
  .ledger-export-root td:nth-child(10),
  .ledger-export-root td:nth-child(11),
  .ledger-export-root th:nth-child(6),
  .ledger-export-root th:nth-child(7),
  .ledger-export-root th:nth-child(8),
  .ledger-export-root th:nth-child(9),
  .ledger-export-root th:nth-child(10),
  .ledger-export-root th:nth-child(11) {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  @page {
    size: landscape;
    margin: 5mm 6mm;
  }
  @media print {
    body {
      padding: 4px 6px !important;
      margin: 0 !important;
    }
    .ledger-export-root .meta {
      margin-bottom: 8px;
    }
  }
`;

function buildLedgerExportInnerHtml(
    headers: string[],
    body: string[][],
    title: string,
    periodLabel: string | null = null,
): string {
    const headerCells = headers
        .map((h) => `<th>${escapeHtml(h)}</th>`)
        .join('');
    const bodyRows = body
        .map(
            (row) =>
                `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`,
        )
        .join('');

    const periodLine = periodLabel
        ? `<span class="period">${escapeHtml(periodLabel)}</span><br/>`
        : '';

    return `
<div class="ledger-export-root">
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">${periodLine}Both primary and secondary currency amounts are shown.</p>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
</div>`;
}

function formatFixed(value: number, decimals: number): string {
    if (!Number.isFinite(value)) {
        return '';
    }

    return value.toFixed(decimals);
}

export function buildLedgerExportTable(
    rows: LedgerExportRow[],
    opts: {
        primaryDecimals: number;
        secondaryDecimals: number;
        primaryCurrency: string;
        secondaryCurrency: string;
        typeLabel: (type: string) => string;
        formatDate: (iso: string) => string;
    },
): { headers: string[]; body: string[][] } {
    const headers = [
        'SL',
        'Date',
        'Type',
        'Description',
        'Category',
        `Debit (${opts.primaryCurrency})`,
        `Debit (${opts.secondaryCurrency})`,
        `Credit (${opts.primaryCurrency})`,
        `Credit (${opts.secondaryCurrency})`,
        `Balance (${opts.primaryCurrency})`,
        `Balance (${opts.secondaryCurrency})`,
    ];

    const body = rows.map((l, idx) => {
        const isSettlement = Boolean(l.settlement_id);
        const desc = isSettlement
            ? l.description?.trim()
                ? l.description
                : '—'
            : (l.description ?? l.source ?? '—');

        const debitP = Number(l.debit_primary);
        const creditP = Number(l.credit_primary);
        const debitS = l.debit_secondary === null ? null : Number(l.debit_secondary);
        const creditS =
            l.credit_secondary === null ? null : Number(l.credit_secondary);

        const debitPrimaryCell =
            debitP > 0
                ? `${formatFixed(debitP, opts.primaryDecimals)} ${l.primary_currency}`
                : '—';
        const debitSecondaryCell =
            debitS !== null &&
            debitS > 0 &&
            l.secondary_currency &&
            debitP > 0
                ? `${formatFixed(debitS, opts.secondaryDecimals)} ${l.secondary_currency}`
                : '—';

        const creditPrimaryCell =
            creditP > 0
                ? `${formatFixed(creditP, opts.primaryDecimals)} ${l.primary_currency}`
                : '—';
        const creditSecondaryCell =
            creditS !== null &&
            creditS > 0 &&
            l.secondary_currency &&
            creditP > 0
                ? `${formatFixed(creditS, opts.secondaryDecimals)} ${l.secondary_currency}`
                : '—';

        const rp = Number(l.running_primary);
        const balancePrimary = `${formatFixed(rp, opts.primaryDecimals)} ${opts.primaryCurrency}`;
        let balanceSecondary = '—';
        if (l.running_secondary !== null && l.secondary_currency) {
            const rs = Number(l.running_secondary);
            if (Number.isFinite(rs)) {
                balanceSecondary = `${formatFixed(rs, opts.secondaryDecimals)} ${opts.secondaryCurrency}`;
            }
        }

        return [
            String(idx + 1),
            opts.formatDate(l.occurred_on),
            opts.typeLabel(l.type),
            desc,
            l.category?.name ?? '—',
            debitPrimaryCell,
            debitSecondaryCell,
            creditPrimaryCell,
            creditSecondaryCell,
            balancePrimary,
            balanceSecondary,
        ];
    });

    return { headers, body };
}

export async function downloadLedgerExcel(
    headers: string[],
    body: string[][],
    filenameBase = 'ledger',
    periodLabel: string | null = null,
): Promise<void> {
    const XLSX = await import('xlsx');
    const aoa: string[][] = [];
    if (periodLabel) {
        aoa.push([periodLabel]);
        aoa.push([]);
    }
    aoa.push(headers, ...body);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ledger');

    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${filenameBase}-${stamp}.xlsx`);
}

export async function downloadLedgerPdf(
    headers: string[],
    body: string[][],
    title = 'Ledger',
    filenameBase = 'ledger',
    periodLabel: string | null = null,
): Promise<void> {
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `${filenameBase}-${stamp}.pdf`;

    const innerHtml = buildLedgerExportInnerHtml(
        headers,
        body,
        title,
        periodLabel,
    );

    await savePdfFromIsolatedHtml(innerHtml, EXPORT_TABLE_CSS, {
        margin: [4, 5, 4, 5],
        filename,
        image: { type: 'jpeg', quality: 0.92 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            letterRendering: true,
            scrollY: 0,
        },
        jsPDF: {
            unit: 'mm',
            format: 'a4',
            orientation: 'landscape',
        },
    });
}

export function printLedgerTable(
    headers: string[],
    body: string[][],
    title = 'Ledger',
    periodLabel: string | null = null,
): void {
    const inner = buildLedgerExportInnerHtml(headers, body, title, periodLabel);
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(title)}</title>
  <style>${EXPORT_TABLE_CSS}</style>
</head>
<body style="margin:0;padding:10px 12px;background:#fff;">
${inner}
</body>
</html>`;

    const w = window.open('', '_blank');
    if (!w) {
        return;
    }

    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();

    const triggerPrint = () => {
        w.print();
        w.close();
    };

    window.setTimeout(triggerPrint, 200);
}
