import { Head, Link } from '@inertiajs/react';
import { Eye, Printer, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    buildLedgerExportTable,
    downloadLedgerExcel,
    downloadLedgerPdf,
    printLedgerTable,
} from '@/lib/ledger-export';
import { index as ledgerIndex } from '@/routes/ledger';
import { show as transactionsShow } from '@/routes/transactions';

type Props = {
    types: Record<string, string>;
    primaryCurrency: string;
    secondaryCurrency: string;
    primaryDecimals: number;
    secondaryDecimals: number;
    lines: Array<{
        id: number;
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
    }>;
};

export default function LedgerIndex({
    types,
    primaryCurrency,
    secondaryCurrency,
    primaryDecimals,
    secondaryDecimals,
    lines,
}: Props) {
    const [tableSearch, setTableSearch] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [exportSelectKey, setExportSelectKey] = useState(0);

    const typeEntries = useMemo(() => Object.entries(types), [types]);

    const formatDateDMY = (iso: string) => {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);

        if (!m) {
            return iso;
        }

        return `${m[3]}/${m[2]}/${m[1]}`;
    };

    const formatFixed = (value: number, decimals: number) => {
        if (!Number.isFinite(value)) {
            return '';
        }

        return value.toFixed(decimals);
    };

    const typeLabel = (type: string) => types[type] ?? type;

    const dateRangeInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);

    const periodLabelForExport = useMemo(() => {
        if (!dateFrom && !dateTo) {
            return null;
        }

        if (dateFrom && dateTo) {
            return `Period: ${formatDateDMY(dateFrom)} – ${formatDateDMY(dateTo)}`;
        }

        if (dateFrom) {
            return `From: ${formatDateDMY(dateFrom)}`;
        }

        return `Until: ${formatDateDMY(dateTo)}`;
    }, [dateFrom, dateTo]);

    const exportFilenameBase = useMemo(() => {
        if (dateFrom && dateTo) {
            return `ledger-${dateFrom}-to-${dateTo}`;
        }

        if (dateFrom) {
            return `ledger-from-${dateFrom}`;
        }

        if (dateTo) {
            return `ledger-until-${dateTo}`;
        }

        return 'ledger';
    }, [dateFrom, dateTo]);

    const hasActiveFilters =
        tableSearch.trim() !== '' ||
        filterType !== 'all' ||
        Boolean(dateFrom) ||
        Boolean(dateTo);

    const filteredLines = useMemo(() => {
        if (dateRangeInvalid) {
            return [];
        }

        let rows = lines;

        if (filterType !== 'all') {
            rows = rows.filter((l) => l.type === filterType);
        }

        if (dateFrom || dateTo) {
            rows = rows.filter((l) => {
                if (dateFrom && l.occurred_on < dateFrom) {
                    return false;
                }

                if (dateTo && l.occurred_on > dateTo) {
                    return false;
                }

                return true;
            });
        }

        const q = tableSearch.trim().toLowerCase();

        if (q) {
            rows = rows.filter((l) => {
                const isSettlement = Boolean(l.settlement_id);
                const descText = isSettlement
                    ? l.description?.trim()
                        ? l.description
                        : ''
                    : (l.description ?? l.source ?? '');
                const debitP = Number(l.debit_primary);
                const creditP = Number(l.credit_primary);
                const debitS =
                    l.debit_secondary === null
                        ? null
                        : Number(l.debit_secondary);
                const creditS =
                    l.credit_secondary === null
                        ? null
                        : Number(l.credit_secondary);
                const parts = [
                    descText,
                    l.category?.name,
                    formatDateDMY(l.occurred_on),
                    l.occurred_on,
                    typeLabel(l.type),
                    l.type,
                    String(l.transaction_id),
                    l.primary_currency,
                    l.secondary_currency ?? '',
                    debitP > 0 ? formatFixed(debitP, primaryDecimals) : '',
                    creditP > 0 ? formatFixed(creditP, primaryDecimals) : '',
                    debitS !== null && debitS > 0
                        ? formatFixed(debitS, secondaryDecimals)
                        : '',
                    creditS !== null && creditS > 0
                        ? formatFixed(creditS, secondaryDecimals)
                        : '',
                    formatFixed(Number(l.running_primary), primaryDecimals),
                    l.running_secondary !== null
                        ? formatFixed(
                              Number(l.running_secondary),
                              secondaryDecimals,
                          )
                        : '',
                ];
                const haystack = parts.filter(Boolean).join(' ').toLowerCase();

                return haystack.includes(q);
            });
        }

        return rows;
    }, [
        lines,
        tableSearch,
        filterType,
        types,
        primaryDecimals,
        secondaryDecimals,
        dateFrom,
        dateTo,
        dateRangeInvalid,
    ]);

    const getExportTableOptions = () => ({
        primaryDecimals,
        secondaryDecimals,
        primaryCurrency,
        secondaryCurrency,
        typeLabel,
        formatDate: formatDateDMY,
    });

    const handleExportFormat = (fmt: 'pdf' | 'excel') => {
        const { headers, body } = buildLedgerExportTable(
            filteredLines,
            getExportTableOptions(),
        );
        const period = periodLabelForExport;
        void (async () => {
            if (fmt === 'pdf') {
                await downloadLedgerPdf(
                    headers,
                    body,
                    'Ledger',
                    exportFilenameBase,
                    period,
                );
            } else {
                await downloadLedgerExcel(
                    headers,
                    body,
                    exportFilenameBase,
                    period,
                );
            }

            setExportSelectKey((k) => k + 1);
        })();
    };

    const handlePrintLedger = () => {
        const { headers, body } = buildLedgerExportTable(
            filteredLines,
            getExportTableOptions(),
        );
        printLedgerTable(headers, body, 'Ledger', periodLabelForExport);
    };

    return (
        <>
            <Head title="Ledger" />

            <div className="space-y-6 py-4 pb-6 sm:py-6">
                <Heading
                    title="Ledger"
                    description="Posted entries from your transactions (chronological running balance)"
                />

                <div className="rounded-xl border border-sidebar-border/70 bg-card">
                    {lines.length === 0 ? (
                        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                            No ledger entries yet.
                        </div>
                    ) : (
                        <div className="w-full min-w-0">
                            <div className="space-y-2 border-b border-sidebar-border/70 p-4">
                                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
                                    <div className="max-w-[220px] min-w-0 sm:max-w-none">
                                        <Label
                                            htmlFor="ledger-table-search"
                                            className="text-xs text-muted-foreground"
                                        >
                                            Search
                                        </Label>
                                        <div className="relative mt-1">
                                            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                id="ledger-table-search"
                                                value={tableSearch}
                                                onChange={(e) =>
                                                    setTableSearch(
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="Date, type, description, category, amounts…"
                                                className="h-9 pl-9"
                                                autoComplete="off"
                                            />
                                        </div>
                                    </div>
                                    <div className="max-w-[220px] min-w-0 sm:max-w-none">
                                        <Label
                                            htmlFor="ledger-filter-type"
                                            className="text-xs text-muted-foreground"
                                        >
                                            Type
                                        </Label>
                                        <Select
                                            value={filterType}
                                            onValueChange={setFilterType}
                                        >
                                            <SelectTrigger
                                                id="ledger-filter-type"
                                                className="mt-1 h-9 w-full min-w-0"
                                            >
                                                <SelectValue placeholder="All types" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">
                                                    All types
                                                </SelectItem>
                                                {typeEntries.map(
                                                    ([value, label]) => (
                                                        <SelectItem
                                                            key={value}
                                                            value={value}
                                                        >
                                                            {label}
                                                        </SelectItem>
                                                    ),
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="max-w-[220px] min-w-0 sm:max-w-none">
                                        <Label
                                            htmlFor="ledger-date-from"
                                            className="text-xs text-muted-foreground"
                                        >
                                            From date
                                        </Label>
                                        <Input
                                            id="ledger-date-from"
                                            type="date"
                                            value={dateFrom}
                                            onChange={(e) =>
                                                setDateFrom(e.target.value)
                                            }
                                            className="mt-1 h-9"
                                        />
                                    </div>
                                    <div className="max-w-[220px] min-w-0 sm:max-w-none">
                                        <Label
                                            htmlFor="ledger-date-to"
                                            className="text-xs text-muted-foreground"
                                        >
                                            To date
                                        </Label>
                                        <Input
                                            id="ledger-date-to"
                                            type="date"
                                            value={dateTo}
                                            onChange={(e) =>
                                                setDateTo(e.target.value)
                                            }
                                            className="mt-1 h-9"
                                        />
                                    </div>
                                    <div className="flex min-h-[52px] min-w-0 flex-col justify-end md:col-span-3 xl:col-span-1">
                                        <Label
                                            className="invisible text-xs text-muted-foreground select-none"
                                            aria-hidden
                                        >
                                            Export
                                        </Label>
                                        <div className="mt-1 flex min-w-0 flex-nowrap items-center gap-2">
                                            <Select
                                                key={exportSelectKey}
                                                onValueChange={(v) => {
                                                    if (
                                                        v === 'pdf' ||
                                                        v === 'excel'
                                                    ) {
                                                        handleExportFormat(v);
                                                    }
                                                }}
                                                disabled={
                                                    dateRangeInvalid ||
                                                    filteredLines.length === 0
                                                }
                                            >
                                                <SelectTrigger
                                                    className="h-9 min-w-0 flex-1 sm:max-w-44 lg:w-44 lg:max-w-44 lg:flex-none"
                                                    aria-label="Export ledger"
                                                >
                                                    <SelectValue placeholder="Export as…" />
                                                </SelectTrigger>
                                                <SelectContent align="end">
                                                    <SelectItem value="pdf">
                                                        PDF
                                                    </SelectItem>
                                                    <SelectItem value="excel">
                                                        Excel (.xlsx)
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                className="h-9 w-9 shrink-0"
                                                onClick={handlePrintLedger}
                                                disabled={
                                                    dateRangeInvalid ||
                                                    filteredLines.length === 0
                                                }
                                                aria-label="Print ledger"
                                            >
                                                <Printer className="size-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-xs text-muted-foreground">
                                        Showing{' '}
                                        <span className="font-medium text-foreground">
                                            {filteredLines.length}
                                        </span>{' '}
                                        of {lines.length}
                                        {hasActiveFilters && (
                                            <span className="ml-1">
                                                (filtered)
                                            </span>
                                        )}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {hasActiveFilters && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-8"
                                                onClick={() => {
                                                    setTableSearch('');
                                                    setFilterType('all');
                                                    setDateFrom('');
                                                    setDateTo('');
                                                }}
                                            >
                                                Clear filters
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {filteredLines.length === 0 ? (
                                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                                    {dateRangeInvalid ? (
                                        <>
                                            From date must be on or before To
                                            date.
                                        </>
                                    ) : (
                                        <>
                                            No ledger entries match your search,
                                            filters, or date range.
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div className="-mx-4 min-w-0 overflow-x-auto overflow-y-visible px-4 rounded-b-xl">
                                    <TooltipProvider delayDuration={150}>
                                        <table className="w-full min-w-[980px] table-fixed border-separate border-spacing-0 text-sm leading-snug font-normal">
                                            <colgroup>
                                                <col className="w-[3.5%]" />
                                                <col className="w-[9%]" />
                                                <col className="w-[10%]" />
                                                <col className="w-[28%] min-w-0" />
                                                <col className="w-[11%]" />
                                                <col className="w-[11%]" />
                                                <col className="w-[11%]" />
                                                <col className="w-[11%]" />
                                                <col className="w-[5.5%]" />
                                            </colgroup>
                                            <thead>
                                                <tr className="border-b border-sidebar-border/70 text-left font-normal">
                                                    <th className="sticky top-0 z-20 bg-muted/50 px-3 py-3 text-xs font-normal tracking-wide text-muted-foreground uppercase backdrop-blur supports-backdrop-filter:bg-muted/40">
                                                        SL
                                                    </th>
                                                    <th className="sticky top-0 z-20 bg-muted/50 px-3 py-3 pr-4 text-xs font-normal tracking-wide text-muted-foreground uppercase backdrop-blur supports-backdrop-filter:bg-muted/40">
                                                        Date
                                                    </th>
                                                    <th className="sticky top-0 z-20 border-l border-sidebar-border/60 bg-muted/50 px-3 py-3 pl-4 text-xs font-normal tracking-wide text-muted-foreground uppercase backdrop-blur supports-backdrop-filter:bg-muted/40">
                                                        Type
                                                    </th>
                                                    <th className="sticky top-0 z-20 min-w-0 bg-muted/50 px-3 py-3 text-xs font-normal tracking-wide text-muted-foreground uppercase backdrop-blur supports-backdrop-filter:bg-muted/40">
                                                        Description
                                                    </th>
                                                    <th className="sticky top-0 z-20 bg-muted/50 px-3 py-3 text-xs font-normal tracking-wide text-muted-foreground uppercase backdrop-blur supports-backdrop-filter:bg-muted/40">
                                                        Category
                                                    </th>
                                                    <th className="sticky top-0 z-20 bg-muted/50 px-3 py-3 text-right text-xs font-normal tracking-wide text-muted-foreground uppercase backdrop-blur supports-backdrop-filter:bg-muted/40">
                                                        Debit
                                                    </th>
                                                    <th className="sticky top-0 z-20 bg-muted/50 px-3 py-3 text-right text-xs font-normal tracking-wide text-muted-foreground uppercase backdrop-blur supports-backdrop-filter:bg-muted/40">
                                                        Credit
                                                    </th>
                                                    <th className="sticky top-0 z-20 bg-muted/50 px-3 py-3 text-right text-xs font-normal tracking-wide text-muted-foreground uppercase backdrop-blur supports-backdrop-filter:bg-muted/40">
                                                        Balance
                                                    </th>
                                                    <th className="sticky top-0 z-20 bg-muted/50 px-2 py-3 text-right text-xs font-normal tracking-wide text-muted-foreground uppercase backdrop-blur supports-backdrop-filter:bg-muted/40"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-sidebar-border/60">
                                                {filteredLines.map((l, idx) => {
                                                    const debitP = Number(
                                                        l.debit_primary,
                                                    );
                                                    const creditP = Number(
                                                        l.credit_primary,
                                                    );
                                                    const debitS =
                                                        l.debit_secondary ===
                                                        null
                                                            ? null
                                                            : Number(
                                                                  l.debit_secondary,
                                                              );
                                                    const creditS =
                                                        l.credit_secondary ===
                                                        null
                                                            ? null
                                                            : Number(
                                                                  l.credit_secondary,
                                                              );
                                                    const isSettlement =
                                                        Boolean(
                                                            l.settlement_id,
                                                        );

                                                    return (
                                                        <tr
                                                            key={l.id}
                                                            className="transition-colors even:bg-muted/20 hover:bg-muted/40"
                                                        >
                                                            <td className="px-3 py-2.5 align-middle text-xs text-muted-foreground tabular-nums">
                                                                {idx + 1}
                                                            </td>
                                                            <td className="px-3 py-2.5 pr-4 align-middle text-sm text-foreground/90 tabular-nums">
                                                                {formatDateDMY(
                                                                    l.occurred_on,
                                                                )}
                                                            </td>
                                                            <td className="border-l border-sidebar-border/50 py-2.5 pr-3 pl-4 align-middle text-sm text-foreground/90">
                                                                <div
                                                                    className="truncate"
                                                                    title={
                                                                        types[
                                                                            l
                                                                                .type
                                                                        ] ??
                                                                        l.type
                                                                    }
                                                                >
                                                                    {types[
                                                                        l.type
                                                                    ] ?? l.type}
                                                                </div>
                                                            </td>
                                                            <td className="min-w-0 px-3 py-2.5 align-middle text-sm">
                                                                <Tooltip>
                                                                    <TooltipTrigger
                                                                        asChild
                                                                    >
                                                                        <div className="min-w-0 cursor-help truncate leading-5 font-normal text-foreground/90">
                                                                            {isSettlement ? (
                                                                                <span className="text-muted-foreground">
                                                                                    {l.description?.trim()
                                                                                        ? l.description
                                                                                        : '—'}
                                                                                </span>
                                                                            ) : (
                                                                                (l.description ??
                                                                                l.source ??
                                                                                '—')
                                                                            )}
                                                                        </div>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent
                                                                        side="bottom"
                                                                        align="start"
                                                                        className="max-w-[560px] text-left leading-5 whitespace-pre-wrap"
                                                                    >
                                                                        {isSettlement
                                                                            ? l.description?.trim()
                                                                                ? l.description
                                                                                : '—'
                                                                            : (l.description ??
                                                                              l.source ??
                                                                              '—')}
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </td>
                                                            <td className="min-w-0 px-3 py-2.5 align-middle text-sm">
                                                                <div
                                                                    className="truncate text-foreground/90"
                                                                    title={
                                                                        l
                                                                            .category
                                                                            ?.name
                                                                    }
                                                                >
                                                                    {l.category
                                                                        ?.name ?? (
                                                                        <span className="text-muted-foreground">
                                                                            —
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-2.5 text-right align-middle text-sm whitespace-nowrap tabular-nums">
                                                                {debitP > 0 ? (
                                                                    <div>
                                                                        <div className="font-normal whitespace-nowrap text-destructive">
                                                                            <span className="tabular-nums">
                                                                                {formatFixed(
                                                                                    debitP,
                                                                                    primaryDecimals,
                                                                                )}
                                                                            </span>{' '}
                                                                            <span className="text-xs font-normal text-muted-foreground">
                                                                                {
                                                                                    l.primary_currency
                                                                                }
                                                                            </span>
                                                                        </div>
                                                                        {debitS !==
                                                                            null &&
                                                                            debitS >
                                                                                0 &&
                                                                            l.secondary_currency && (
                                                                                <div className="text-xs text-muted-foreground">
                                                                                    {formatFixed(
                                                                                        debitS,
                                                                                        secondaryDecimals,
                                                                                    )}{' '}
                                                                                    {
                                                                                        l.secondary_currency
                                                                                    }
                                                                                </div>
                                                                            )}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-muted-foreground">
                                                                        —
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-right align-middle text-sm whitespace-nowrap tabular-nums">
                                                                {creditP > 0 ? (
                                                                    <div>
                                                                        <div className="font-normal whitespace-nowrap text-emerald-600 dark:text-emerald-400">
                                                                            <span className="tabular-nums">
                                                                                {formatFixed(
                                                                                    creditP,
                                                                                    primaryDecimals,
                                                                                )}
                                                                            </span>{' '}
                                                                            <span className="text-xs font-normal text-muted-foreground">
                                                                                {
                                                                                    l.primary_currency
                                                                                }
                                                                            </span>
                                                                        </div>
                                                                        {creditS !==
                                                                            null &&
                                                                            creditS >
                                                                                0 &&
                                                                            l.secondary_currency && (
                                                                                <div className="text-xs text-muted-foreground">
                                                                                    {formatFixed(
                                                                                        creditS,
                                                                                        secondaryDecimals,
                                                                                    )}{' '}
                                                                                    {
                                                                                        l.secondary_currency
                                                                                    }
                                                                                </div>
                                                                            )}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-muted-foreground">
                                                                        —
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-right align-middle text-sm whitespace-nowrap text-foreground/90 tabular-nums">
                                                                <div className="font-normal whitespace-nowrap">
                                                                    {formatFixed(
                                                                        Number(
                                                                            l.running_primary,
                                                                        ),
                                                                        primaryDecimals,
                                                                    )}{' '}
                                                                    <span className="text-xs font-normal text-muted-foreground">
                                                                        {
                                                                            primaryCurrency
                                                                        }
                                                                    </span>
                                                                </div>
                                                                {l.running_secondary !==
                                                                    null && (
                                                                    <div className="text-xs font-normal text-muted-foreground">
                                                                        {formatFixed(
                                                                            Number(
                                                                                l.running_secondary,
                                                                            ),
                                                                            secondaryDecimals,
                                                                        )}{' '}
                                                                        {
                                                                            secondaryCurrency
                                                                        }
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-2 py-2.5 align-middle">
                                                                <div className="flex justify-end">
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        aria-label="View transaction"
                                                                        asChild
                                                                    >
                                                                        <Link
                                                                            href={transactionsShow(
                                                                                {
                                                                                    transaction:
                                                                                        l.transaction_id,
                                                                                },
                                                                            )}
                                                                        >
                                                                            <Eye className="size-4" />
                                                                        </Link>
                                                                    </Button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </TooltipProvider>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

LedgerIndex.layout = {
    breadcrumbs: [
        {
            title: 'Ledger',
            href: ledgerIndex(),
        },
    ],
};
