import { savePdfFromIsolatedHtml } from '@/lib/html2pdf-isolated';

export type TxExportRow = {
    occurred_on: string;
    type: string;
    amount: string;
    settled_amount: string | null;
    settlement_status: 'unsettled' | 'partial' | 'settled' | null;
    currency: string;
    secondary_amount: string | null;
    secondary_currency: string | null;
    source: string | null;
    contacts: Array<{ id: number; name: string }>;
    category: { id: number; name: string; type: string } | null;
    kind: 'transaction' | 'settlement';
};

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

const EXPORT_TABLE_CSS = `
  .transactions-export-root {
    font-family: "Noto Sans Bengali", "Noto Sans", ui-sans-serif, system-ui, sans-serif;
    font-size: 11px;
    line-height: 1.4;
    color: #111;
    -webkit-font-smoothing: antialiased;
  }
  .transactions-export-root h1 {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 4px 0;
    font-family: "Noto Sans", ui-sans-serif, system-ui, sans-serif;
  }
  .transactions-export-root .meta {
    color: #52525b;
    margin-bottom: 16px;
    font-size: 11px;
  }
  .transactions-export-root .meta .period {
    font-weight: 600;
    color: #3f3f46;
  }
  .transactions-export-root table {
    width: auto;
    max-width: 100%;
    border-collapse: collapse;
    table-layout: auto;
  }
  .transactions-export-root th,
  .transactions-export-root td {
    border: 1px solid #d4d4d8;
    padding: 6px 8px;
    vertical-align: top;
    width: auto;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  .transactions-export-root th {
    background: #705cfc;
    color: #fff;
    font-weight: 600;
    text-align: left;
  }
  .transactions-export-root td:nth-child(7),
  .transactions-export-root td:nth-child(8),
  .transactions-export-root th:nth-child(7),
  .transactions-export-root th:nth-child(8) {
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
    .transactions-export-root .meta {
      margin-bottom: 8px;
    }
  }
`;

function buildTransactionsExportInnerHtml(
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
<div class="transactions-export-root">
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">${periodLine}Both primary and secondary currency amounts are shown.</p>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
</div>`;
}

function directionForType(type: string): number {
    if (
        type === 'expense' ||
        type === 'payable' ||
        type === 'settle_payable'
    ) {
        return -1;
    }

    return 1;
}

function isObligation(type: string): boolean {
    return type === 'payable' || type === 'receivable';
}

export function buildTransactionsExportTable(
    rows: TxExportRow[],
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
        'Person',
        'Category',
        'Source',
        `Primary (${opts.primaryCurrency})`,
        `Secondary (${opts.secondaryCurrency})`,
        'Status',
    ];

    const body = rows.map((t, idx) => {
        const dir = directionForType(t.type);
        const signChar = dir < 0 ? '-' : '+';
        const primaryAmt = `${signChar} ${Math.abs(Number(t.amount)).toFixed(opts.primaryDecimals)} ${t.currency}`;

        let secondaryAmt = '—';
        if (t.secondary_amount != null && t.secondary_currency) {
            const sn = Number(t.secondary_amount);
            if (Number.isFinite(sn)) {
                secondaryAmt = `${signChar} ${Math.abs(sn).toFixed(opts.secondaryDecimals)} ${t.secondary_currency}`;
            }
        }

        const person =
            t.contacts.length > 0
                ? t.contacts.map((c) => c.name).join(', ')
                : '—';
        const category = t.category?.name ?? '—';
        const source = t.source ?? '—';

        let status = '—';
        if (isObligation(t.type) && t.kind === 'transaction') {
            if (t.settlement_status === 'unsettled') {
                status = 'Unsettled';
            } else if (t.settlement_status === 'partial') {
                status = 'Partial';
            } else if (t.settlement_status === 'settled') {
                status = 'Settled';
            }
        }

        return [
            String(idx + 1),
            opts.formatDate(t.occurred_on),
            opts.typeLabel(t.type),
            person,
            category,
            source,
            primaryAmt,
            secondaryAmt,
            status,
        ];
    });

    return { headers, body };
}

export async function downloadTransactionsExcel(
    headers: string[],
    body: string[][],
    filenameBase = 'transactions',
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
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${filenameBase}-${stamp}.xlsx`);
}

export async function downloadTransactionsPdf(
    headers: string[],
    body: string[][],
    title = 'Transactions',
    filenameBase = 'transactions',
    periodLabel: string | null = null,
): Promise<void> {
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `${filenameBase}-${stamp}.pdf`;

    const innerHtml = buildTransactionsExportInnerHtml(
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

export function printTransactionsTable(
    headers: string[],
    body: string[][],
    title = 'Transactions',
    periodLabel: string | null = null,
): void {
    const inner = buildTransactionsExportInnerHtml(headers, body, title, periodLabel);
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
