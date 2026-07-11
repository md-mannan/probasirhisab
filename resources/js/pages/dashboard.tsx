import type { DragEndEvent } from '@dnd-kit/core';
import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    rectSortingStrategy,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Head, router } from '@inertiajs/react';
import type { ChartOptions } from 'chart.js';
import {
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Legend as ChartLegend,
    LinearScale,
    Tooltip as ChartTooltip,
} from 'chart.js';
import {
    Banknote,
    BarChart3,
    GripVertical,
    Receipt,
    TrendingUp,
    Wallet,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { CountUpText } from '@/components/count-up-text';
import { ClientOnly } from '@/components/client-only';
import { DashboardSectionCarousel } from '@/components/dashboard-section-carousel';
import {
    formatCompact,
    formatFixed,
    parseAmount,
} from '@/lib/money';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import { tileOrder as patchDashboardTileOrder } from '@/routes/dashboard';
import type {
    DashboardTranslations,
    TrendChartDatasetKey,
} from '@/types/dashboard-i18n';

ChartJS.register(
    BarElement,
    CategoryScale,
    LinearScale,
    ChartTooltip,
    ChartLegend,
);

/** `#rrggbb` → rgba for bar fills */
function chartColorAlpha(hex: string, alpha: number): string {
    const h = hex.slice(1);
    const r = Number.parseInt(h.slice(0, 2), 16);
    const g = Number.parseInt(h.slice(2, 4), 16);
    const b = Number.parseInt(h.slice(4, 6), 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Bar height = max(new obligation in period, settled in period); bottom = settled, top = transparent “rest”. */
function obligationStack(
    obligationPrimary: number,
    settledPrimary: number,
): { settledHeight: number; remainderHeight: number } {
    const o = Math.max(0, obligationPrimary);
    const s = Math.max(0, settledPrimary);
    const total = Math.max(o, s);

    return {
        settledHeight: s,
        remainderHeight: Math.max(0, total - s),
    };
}

type MoneyPair = {
    primary: string;
    secondary: string | null;
};

type ObligationTotals = {
    totalPrimary: string;
    settledPrimary: string;
    remainingPrimary: string;
    totalSecondary: string | null;
    settledSecondary: string | null;
    remainingSecondary: string | null;
};

type Summary = {
    cash: MoneyPair;
    net: MoneyPair;
    income: MoneyPair & { count: number };
    expense: MoneyPair & { count: number };
    payable: ObligationTotals;
    receivable: ObligationTotals;
};

type TrendRow = {
    label: string;
    incomePrimary: number;
    incomeSecondary: number;
    expensePrimary: number;
    expenseSecondary: number;
    receivablePrimary: number;
    receivableSecondary: number;
    settleReceivablePrimary: number;
    settleReceivableSecondary: number;
    payablePrimary: number;
    payableSecondary: number;
    settlePayablePrimary: number;
    settlePayableSecondary: number;
};

type FinancialRow = {
    key: string;
    label: string;
    settledPrimary: number;
    remainingPrimary: number;
    settledSecondary: number | null;
    remainingSecondary: number | null;
};

export type DashboardTileId =
    | 'cash'
    | 'income'
    | 'expenses'
    | 'cost'
    | 'payables_due'
    | 'receivables_due'
    | 'net_position';

export type MetricTile = {
    id: DashboardTileId;
    title: string;
    dotClass: string;
    borderClass: string;
    Icon?: ComponentType<{ className?: string }>;
    primary?: string;
    secondary?: string | null;
    signed?: true;
    emphasize?: 'positive' | 'negative' | 'neutral';
    obligationBreakdown?: {
        total: MoneyPair;
        settled: MoneyPair;
        remaining: MoneyPair;
    };
    costBreakdown?: {
        expense: MoneyPair;
        payablesSettled: MoneyPair;
        total: MoneyPair;
    };
};

type Props = {
    t: DashboardTranslations;
    dashboardTileOrder: DashboardTileId[];
    primaryCurrency: string;
    secondaryCurrency: string;
    primaryDecimals: number;
    secondaryDecimals: number;
    summary: Summary;
    monthlyTrend: Array<TrendRow & { period: string }>;
    yearlyTrend: Array<TrendRow & { year: string }>;
    financialStatus: FinancialRow[];
};

/** Chart palette — indigo / violet led, distinct from old emerald/rose bars */
const PALETTE = {
    income: '#6366f1',
    expense: '#db2777',
    receivable: '#0891b2',
    /** Receipts against lent amounts (settlements), paired with receivable */
    settleReceivable: '#155e75',
    payable: '#d97706',
    /** Payments against borrowed amounts (settlements), paired with payable */
    settlePayable: '#c2410c',
    settled: '#4f46e5',
    remaining: '#c7d2fe',
    grid: 'hsl(var(--border) / 0.5)',
    axis: 'hsl(var(--muted-foreground))',
} as const;

function trendRowsHaveData(rows: TrendRow[]): boolean {
    return rows.some(
        (r) =>
            r.incomePrimary +
                r.incomeSecondary +
                r.expensePrimary +
                r.expenseSecondary +
                r.receivablePrimary +
                r.receivableSecondary +
                r.settleReceivablePrimary +
                r.settleReceivableSecondary +
                r.payablePrimary +
                r.payableSecondary +
                r.settlePayablePrimary +
                r.settlePayableSecondary >
            0,
    );
}

// Money parsing/formatting now lives in @/lib/money. `num` stays as a local alias
// for parseAmount to keep the many call sites in this large component unchanged.
const num = parseAmount;

function TrendsVolumePanel({
    title,
    description,
    data,
    hasData,
    emptyLabel,
    primaryCurrency,
    secondaryCurrency,
    primaryDecimals,
    secondaryDecimals,
    chart: chartT,
    tooltip: tooltipT,
}: {
    title: string;
    description: string;
    data: Array<TrendRow & Record<string, string | number>>;
    hasData: boolean;
    emptyLabel: string;
    primaryCurrency: string;
    secondaryCurrency: string;
    primaryDecimals: number;
    secondaryDecimals: number;
    chart: DashboardTranslations['chart'];
    tooltip: DashboardTranslations['tooltip'];
}) {
    const crowdedX = data.length > 8;

    const chartData = useMemo(() => {
        const labels = data.map((d) => String(d.label));
        const barThickness = crowdedX ? 12 : 18;
        const rFull = 5;
        const rBot = {
            bottomLeft: 5,
            bottomRight: 5,
            topLeft: 0,
            topRight: 0,
        };
        const rTop = {
            topLeft: 5,
            topRight: 5,
            bottomLeft: 0,
            bottomRight: 0,
        };

        const paySettled = data.map(
            (row) =>
                obligationStack(
                    Number(row.payablePrimary),
                    Number(row.settlePayablePrimary),
                ).settledHeight,
        );
        const payRemain = data.map(
            (row) =>
                obligationStack(
                    Number(row.payablePrimary),
                    Number(row.settlePayablePrimary),
                ).remainderHeight,
        );
        const recSettled = data.map(
            (row) =>
                obligationStack(
                    Number(row.receivablePrimary),
                    Number(row.settleReceivablePrimary),
                ).settledHeight,
        );
        const recRemain = data.map(
            (row) =>
                obligationStack(
                    Number(row.receivablePrimary),
                    Number(row.settleReceivablePrimary),
                ).remainderHeight,
        );

        const datasets = [
            {
                type: 'bar' as const,
                dsKey: 'income' as const satisfies TrendChartDatasetKey,
                label: chartT.income,
                data: data.map((row) => Number(row.incomePrimary)),
                stack: 'stk-inc',
                backgroundColor: chartColorAlpha(PALETTE.income, 0.22),
                borderColor: PALETTE.income,
                borderWidth: 1.5,
                borderRadius: rFull,
                maxBarThickness: barThickness,
            },
            {
                type: 'bar' as const,
                dsKey: 'expense' as const satisfies TrendChartDatasetKey,
                label: chartT.expense,
                data: data.map((row) => Number(row.expensePrimary)),
                stack: 'stk-exp',
                backgroundColor: chartColorAlpha(PALETTE.expense, 0.22),
                borderColor: PALETTE.expense,
                borderWidth: 1.5,
                borderRadius: rFull,
                maxBarThickness: barThickness,
            },
            {
                type: 'bar' as const,
                dsKey: 'payable_settled' as const satisfies TrendChartDatasetKey,
                label: chartT.payable_settled,
                data: paySettled,
                stack: 'stk-pay',
                backgroundColor: chartColorAlpha(PALETTE.settlePayable, 0.9),
                borderColor: PALETTE.settlePayable,
                borderWidth: 1,
                borderRadius: rBot,
                maxBarThickness: barThickness,
            },
            {
                type: 'bar' as const,
                dsKey: 'payable_remainder' as const satisfies TrendChartDatasetKey,
                label: chartT.payable_remainder,
                data: payRemain,
                stack: 'stk-pay',
                backgroundColor: 'rgba(0, 0, 0, 0)',
                borderColor: PALETTE.payable,
                borderWidth: { top: 2, right: 2, bottom: 0, left: 2 },
                borderRadius: rTop,
                maxBarThickness: barThickness,
            },
            {
                type: 'bar' as const,
                dsKey: 'receivable_settled' as const satisfies TrendChartDatasetKey,
                label: chartT.receivable_settled,
                data: recSettled,
                stack: 'stk-rec',
                backgroundColor: chartColorAlpha(
                    PALETTE.settleReceivable,
                    0.88,
                ),
                borderColor: PALETTE.settleReceivable,
                borderWidth: 1,
                borderRadius: rBot,
                maxBarThickness: barThickness,
            },
            {
                type: 'bar' as const,
                dsKey: 'receivable_remainder' as const satisfies TrendChartDatasetKey,
                label: chartT.receivable_remainder,
                data: recRemain,
                stack: 'stk-rec',
                backgroundColor: 'rgba(0, 0, 0, 0)',
                borderColor: PALETTE.receivable,
                borderWidth: { top: 2, right: 2, bottom: 0, left: 2 },
                borderRadius: rTop,
                maxBarThickness: barThickness,
            },
        ];

        return { labels, datasets };
    }, [crowdedX, data, chartT]);

    const chartOptions = useMemo((): ChartOptions<'bar'> => {
        const pair = (p: number, s: number) =>
            `${formatFixed(p, primaryDecimals)} ${primaryCurrency} | ${formatFixed(s, secondaryDecimals)} ${secondaryCurrency}`;

        return {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            datasets: {
                bar: {
                    categoryPercentage: 0.58,
                    barPercentage: 0.82,
                },
            },
            plugins: {
                legend: {
                    display: false,
                },
                tooltip: {
                    filter(tooltipItem) {
                        const k = (
                            tooltipItem.dataset as {
                                dsKey?: TrendChartDatasetKey;
                            }
                        ).dsKey;

                        return (
                            k !== 'payable_remainder' &&
                            k !== 'receivable_remainder'
                        );
                    },
                    callbacks: {
                        title(tooltipItems) {
                            const first = tooltipItems[0];

                            return first?.label != null
                                ? String(first.label)
                                : '';
                        },
                        label(ctx) {
                            const raw = ctx.parsed.y;

                            if (raw === null || Number.isNaN(raw)) {
                                return '';
                            }

                            const idx = ctx.dataIndex;
                            const row = data[idx] as TrendRow;
                            const k = (
                                ctx.dataset as { dsKey?: TrendChartDatasetKey }
                            ).dsKey;

                            if (k === 'income') {
                                return `${tooltipT.income}: ${pair(row.incomePrimary, row.incomeSecondary)}`;
                            }

                            if (k === 'expense') {
                                return `${tooltipT.expense}: ${pair(row.expensePrimary, row.expenseSecondary)}`;
                            }

                            if (k === 'payable_settled') {
                                return `${tooltipT.payable}: ${pair(row.payablePrimary, row.payableSecondary)} · ${tooltipT.settled} ${pair(row.settlePayablePrimary, row.settlePayableSecondary)}`;
                            }

                            if (k === 'receivable_settled') {
                                return `${tooltipT.receivable}: ${pair(row.receivablePrimary, row.receivableSecondary)} · ${tooltipT.settled} ${pair(row.settleReceivablePrimary, row.settleReceivableSecondary)}`;
                            }

                            const lbl = ctx.dataset.label ?? '';

                            return `${lbl}: ${formatFixed(Number(raw), primaryDecimals)} ${primaryCurrency}`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    stacked: true,
                    grid: {
                        color: PALETTE.grid,
                        drawTicks: false,
                    },
                    ticks: {
                        maxRotation: crowdedX ? 45 : 0,
                        minRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: crowdedX ? 14 : undefined,
                        color: PALETTE.axis,
                        font: { size: crowdedX ? 9 : 11 },
                    },
                    border: {
                        display: false,
                    },
                },
                y: {
                    stacked: true,
                    position: 'left',
                    grid: {
                        color: PALETTE.grid,
                    },
                    ticks: {
                        color: PALETTE.axis,
                        font: { size: 10 },
                        callback: (value) =>
                            formatCompact(
                                Number(value),
                                primaryDecimals,
                                primaryCurrency,
                            ),
                    },
                    border: {
                        display: false,
                    },
                },
            },
        };
    }, [
        crowdedX,
        data,
        primaryCurrency,
        primaryDecimals,
        secondaryCurrency,
        secondaryDecimals,
        tooltipT,
    ]);

    return (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
            <div className="border-b border-border/60 bg-linear-to-br from-muted/50 via-muted/25 to-transparent px-1.5 py-2.5 md:px-3">
                <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                    {title}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {description}
                </p>
            </div>
            <div className="p-5 md:p-6">
                {!hasData ? (
                    <div className="flex min-h-[200px] items-center justify-center rounded-xl bg-muted/25 px-4 text-center text-sm text-muted-foreground">
                        {emptyLabel}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="h-[300px] w-full md:h-[380px]">
                            <Bar data={chartData} options={chartOptions} />
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-border/50 pt-0">
                            {(
                                [
                                    {
                                        label: chartT.legend_income,
                                        color: PALETTE.income,
                                    },
                                    {
                                        label: chartT.legend_expense,
                                        color: PALETTE.expense,
                                    },
                                    {
                                        label: chartT.legend_payable,
                                        color: PALETTE.payable,
                                    },
                                    {
                                        label: chartT.legend_receivable,
                                        color: PALETTE.receivable,
                                    },
                                ] as const
                            ).map((s) => (
                                <span
                                    key={s.label}
                                    className="inline-flex items-center gap-2 text-[11px] font-medium text-foreground"
                                >
                                    <span
                                        className="size-2.5 shrink-0 rounded-sm ring-1 ring-border/60"
                                        style={{ background: s.color }}
                                    />
                                    {s.label}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function formatMoneyLine(
    primary: string,
    secondary: string | null,
    primaryCurrency: string,
    secondaryCurrency: string,
    primaryDecimals: number,
    secondaryDecimals: number,
    opts?: {
        signed?: boolean;
        emphasize?: 'positive' | 'negative' | 'neutral';
        variant?: 'hero' | 'stat';
    },
) {
    const p = num(primary);
    const s = secondary !== null ? num(secondary) : null;
    const signed = opts?.signed ?? false;
    const variant = opts?.variant ?? 'stat';
    const primaryMag = p !== null ? Math.abs(p) : null;
    const primaryNeg = signed && p !== null && p < 0;
    const secondaryMag = s !== null ? Math.abs(s) : null;
    const secondaryNeg = signed && s !== null && s < 0;

    const tone =
        opts?.emphasize === 'positive'
            ? 'text-emerald-600 dark:text-emerald-400'
            : opts?.emphasize === 'negative'
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-foreground';

    const primarySize =
        variant === 'hero'
            ? 'text-3xl font-semibold tracking-tight sm:text-4xl'
            : 'text-lg font-semibold tracking-tight sm:text-xl';

    return (
        <div className={cn('space-y-2', variant === 'stat' && 'min-w-0')}>
            <p
                className={cn(
                    'flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 tabular-nums',
                    tone,
                    primarySize,
                )}
            >
                {primaryMag !== null ? (
                    <>
                        {primaryNeg ? (
                            <span className="shrink-0">−</span>
                        ) : null}
                        <CountUpText
                            value={primaryMag}
                            decimals={primaryDecimals}
                        />
                        <span className="text-xs font-medium text-muted-foreground sm:text-sm">
                            {primaryCurrency}
                        </span>
                    </>
                ) : (
                    '—'
                )}
            </p>
            {secondaryMag !== null && (
                <p className="flex flex-wrap items-baseline gap-x-1.5 text-sm font-medium text-foreground/70 tabular-nums dark:text-foreground/65">
                    {secondaryNeg ? <span className="shrink-0">−</span> : null}
                    <CountUpText
                        value={secondaryMag}
                        decimals={secondaryDecimals}
                    />
                    <span className="text-xs font-normal text-muted-foreground">
                        {secondaryCurrency}
                    </span>
                </p>
            )}
        </div>
    );
}

function MoneyPairBreakdownRows({
    rows,
    primaryCurrency,
    secondaryCurrency,
    primaryDecimals,
    secondaryDecimals,
}: {
    rows: Array<{ label: string; pair: MoneyPair }>;
    primaryCurrency: string;
    secondaryCurrency: string;
    primaryDecimals: number;
    secondaryDecimals: number;
}) {
    return (
        <div className="space-y-3">
            {rows.map(({ label, pair }, i) => {
                const p = num(pair.primary);
                const s = pair.secondary !== null ? num(pair.secondary) : null;

                return (
                    <div key={`${label}-${i}`} className="space-y-0.5">
                        <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                            {label}
                        </p>
                        <p className="flex flex-wrap items-baseline gap-x-1.5 text-sm font-semibold text-foreground tabular-nums">
                            {p !== null ? (
                                <>
                                    <CountUpText
                                        value={p}
                                        decimals={primaryDecimals}
                                    />
                                    <span className="text-xs font-medium text-muted-foreground">
                                        {primaryCurrency}
                                    </span>
                                </>
                            ) : (
                                '—'
                            )}
                        </p>
                        {s !== null && (
                            <p className="flex flex-wrap items-baseline gap-x-1.5 text-xs font-medium text-foreground/75 tabular-nums">
                                <CountUpText
                                    value={s}
                                    decimals={secondaryDecimals}
                                />
                                <span className="font-normal text-muted-foreground">
                                    {secondaryCurrency}
                                </span>
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function ObligationBreakdownRows({
    breakdown,
    labels,
    primaryCurrency,
    secondaryCurrency,
    primaryDecimals,
    secondaryDecimals,
}: {
    breakdown: {
        total: MoneyPair;
        settled: MoneyPair;
        remaining: MoneyPair;
    };
    labels: { total: string; settled: string; remaining: string };
    primaryCurrency: string;
    secondaryCurrency: string;
    primaryDecimals: number;
    secondaryDecimals: number;
}) {
    return (
        <MoneyPairBreakdownRows
            rows={[
                { label: labels.total, pair: breakdown.total },
                { label: labels.settled, pair: breakdown.settled },
                { label: labels.remaining, pair: breakdown.remaining },
            ]}
            primaryCurrency={primaryCurrency}
            secondaryCurrency={secondaryCurrency}
            primaryDecimals={primaryDecimals}
            secondaryDecimals={secondaryDecimals}
        />
    );
}

function ObligationStrip({
    label,
    strip,
    settledPrimary,
    remainingPrimary,
    settledSecondary,
    remainingSecondary,
    primaryCurrency,
    secondaryCurrency,
    primaryDecimals,
    secondaryDecimals,
}: {
    label: string;
    strip: DashboardTranslations['strip'];
    settledPrimary: number;
    remainingPrimary: number;
    settledSecondary: number | null;
    remainingSecondary: number | null;
    primaryCurrency: string;
    secondaryCurrency: string;
    primaryDecimals: number;
    secondaryDecimals: number;
}) {
    const totalPrimary = settledPrimary + remainingPrimary;
    const totalSecondary =
        settledSecondary !== null && remainingSecondary !== null
            ? settledSecondary + remainingSecondary
            : null;

    const pctLabel =
        totalPrimary > 0
            ? Math.round((settledPrimary / totalPrimary) * 1000) / 10
            : totalSecondary !== null &&
                totalSecondary > 0 &&
                settledSecondary !== null
              ? Math.round((settledSecondary / totalSecondary) * 1000) / 10
              : 0;

    let settledBarPct = 0;

    if (totalPrimary > 0) {
        settledBarPct = (settledPrimary / totalPrimary) * 100;
    } else if (
        totalSecondary !== null &&
        totalSecondary > 0 &&
        settledSecondary !== null
    ) {
        settledBarPct = (settledSecondary / totalSecondary) * 100;
    }

    const hasBar = totalPrimary > 0 || (totalSecondary ?? 0) > 0;

    const [fillRevealed, setFillRevealed] = useState(false);

    useEffect(() => {
        const id = requestAnimationFrame(() => setFillRevealed(true));

        return () => cancelAnimationFrame(id);
    }, []);

    const dualLine = (primaryAmt: number, secondaryAmt: number | null) => (
        <span className="inline-flex flex-col gap-0.5 tabular-nums">
            <span className="font-medium text-foreground">
                <CountUpText value={primaryAmt} decimals={primaryDecimals} />{' '}
                {primaryCurrency}
            </span>
            {secondaryAmt !== null && (
                <span className="text-[11px] text-muted-foreground">
                    <CountUpText
                        value={secondaryAmt}
                        decimals={secondaryDecimals}
                    />{' '}
                    {secondaryCurrency}
                </span>
            )}
        </span>
    );

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <span className="text-sm leading-none font-medium">
                    {label}
                </span>
                <span className="max-w-[min(100%,18rem)] text-right text-xs text-muted-foreground">
                    <span className="tabular-nums">
                        {pctLabel}% {strip.settled_word} ·{' '}
                    </span>
                    <span className="text-foreground tabular-nums">
                        <CountUpText
                            value={totalPrimary}
                            decimals={primaryDecimals}
                        />{' '}
                        {primaryCurrency}
                        {totalSecondary !== null && (
                            <>
                                {' · '}
                                <CountUpText
                                    value={totalSecondary}
                                    decimals={secondaryDecimals}
                                />{' '}
                                {secondaryCurrency}
                            </>
                        )}
                    </span>
                    <span className="text-muted-foreground">
                        {' '}
                        {strip.total_word}
                    </span>
                </span>
            </div>
            <div
                className="relative h-6 w-full overflow-hidden rounded-full bg-muted sm:h-7"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={hasBar ? Math.round(settledBarPct) : 0}
                aria-label={strip.progress_aria
                    .replace(':label', label)
                    .replace(':pct', String(pctLabel))}
            >
                {hasBar ? (
                    <>
                        <div
                            className="absolute inset-0 bg-[#c7d2fe] dark:bg-indigo-900/50"
                            title={strip.bar_remaining}
                        />
                        <div
                            className="absolute inset-y-0 left-0 h-full rounded-full bg-[#4f46e5] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition-[width] duration-850 ease-out motion-reduce:transition-none motion-reduce:duration-0"
                            style={{
                                width: fillRevealed
                                    ? `${settledBarPct}%`
                                    : '0%',
                            }}
                            title={strip.bar_settled}
                        />
                    </>
                ) : (
                    <div className="h-full w-full bg-muted" />
                )}
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs text-muted-foreground">
                <span className="flex flex-wrap items-start gap-x-1.5 gap-y-0.5">
                    <span className="shrink-0 pt-0.5">
                        {strip.settled_colon}
                    </span>
                    {dualLine(settledPrimary, settledSecondary)}
                </span>
                <span className="flex flex-wrap items-start gap-x-1.5 gap-y-0.5">
                    <span className="shrink-0 pt-0.5">
                        {strip.remaining_colon}
                    </span>
                    {dualLine(remainingPrimary, remainingSecondary)}
                </span>
            </div>
        </div>
    );
}

function SortableMetricTile({
    tile,
    t,
    primaryCurrency,
    secondaryCurrency,
    primaryDecimals,
    secondaryDecimals,
}: {
    tile: MetricTile;
    t: DashboardTranslations;
    primaryCurrency: string;
    secondaryCurrency: string;
    primaryDecimals: number;
    secondaryDecimals: number;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: tile.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 20 : undefined,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                'flex h-fit w-full min-w-0 gap-2 rounded-xl border bg-card p-4 shadow-sm sm:gap-3 sm:p-5',
                'border-l-[3px]',
                tile.borderClass,
                isDragging &&
                    'opacity-95 shadow-lg ring-2 ring-primary/25 dark:ring-primary/35',
            )}
        >
            <button
                type="button"
                className="mt-0.5 shrink-0 cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
                aria-label={t.drag_aria}
                {...attributes}
                {...listeners}
            >
                <GripVertical className="size-4" />
            </button>
            <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                            <span
                                className={cn(
                                    'size-1.5 shrink-0 rounded-full',
                                    tile.dotClass,
                                )}
                                aria-hidden
                            />
                            {tile.title}
                        </p>
                    </div>
                    {tile.Icon ? (
                        <tile.Icon className="size-4 shrink-0 text-muted-foreground" />
                    ) : null}
                </div>
                <div className="mt-4 min-w-0 border-t border-border/60 pt-4">
                    {tile.costBreakdown ? (
                        <MoneyPairBreakdownRows
                            rows={[
                                {
                                    label: t.cost_rows.expenses,
                                    pair: tile.costBreakdown.expense,
                                },
                                {
                                    label: t.cost_rows.payables_settled,
                                    pair: tile.costBreakdown.payablesSettled,
                                },
                                {
                                    label: t.cost_rows.total,
                                    pair: tile.costBreakdown.total,
                                },
                            ]}
                            primaryCurrency={primaryCurrency}
                            secondaryCurrency={secondaryCurrency}
                            primaryDecimals={primaryDecimals}
                            secondaryDecimals={secondaryDecimals}
                        />
                    ) : tile.obligationBreakdown ? (
                        <ObligationBreakdownRows
                            breakdown={tile.obligationBreakdown}
                            labels={t.obligation}
                            primaryCurrency={primaryCurrency}
                            secondaryCurrency={secondaryCurrency}
                            primaryDecimals={primaryDecimals}
                            secondaryDecimals={secondaryDecimals}
                        />
                    ) : (
                        formatMoneyLine(
                            tile.primary ?? '0',
                            tile.secondary ?? null,
                            primaryCurrency,
                            secondaryCurrency,
                            primaryDecimals,
                            secondaryDecimals,
                            tile.signed === true
                                ? {
                                      signed: true,
                                      variant: 'stat',
                                      emphasize: tile.emphasize,
                                  }
                                : {
                                      variant: 'stat',
                                      emphasize: 'neutral',
                                  },
                        )
                    )}
                </div>
            </div>
        </div>
    );
}

export default function Dashboard({
    t,
    dashboardTileOrder,
    primaryCurrency,
    secondaryCurrency,
    primaryDecimals,
    secondaryDecimals,
    summary,
    monthlyTrend,
    yearlyTrend,
    financialStatus,
}: Props) {
    const hasMonthly = trendRowsHaveData(monthlyTrend);
    const hasYearly = trendRowsHaveData(yearlyTrend);

    const payableRow = financialStatus.find((r) => r.key === 'payable');
    const receivableRow = financialStatus.find((r) => r.key === 'receivable');

    const tilesById = useMemo((): Record<DashboardTileId, MetricTile> => {
        const cashP = num(summary.cash.primary);
        const cashPositive = cashP !== null ? cashP >= 0 : true;
        const netP = num(summary.net.primary);
        const netPositive = netP !== null ? netP >= 0 : true;

        const expensePrimaryN = num(summary.expense.primary);
        const expenseSecondaryN =
            summary.expense.secondary !== null
                ? num(summary.expense.secondary)
                : null;
        const payablesSettledPrimaryN = num(summary.payable.settledPrimary);
        const payablesSettledSecondaryN =
            summary.payable.settledSecondary !== null
                ? num(summary.payable.settledSecondary)
                : null;

        const costTotalPrimary =
            (expensePrimaryN ?? 0) + (payablesSettledPrimaryN ?? 0);
        const costTotalSecondary =
            expenseSecondaryN !== null && payablesSettledSecondaryN !== null
                ? expenseSecondaryN + payablesSettledSecondaryN
                : null;

        const costTotalPair: MoneyPair = {
            primary: String(costTotalPrimary),
            secondary:
                costTotalSecondary !== null ? String(costTotalSecondary) : null,
        };

        const tiles: MetricTile[] = [
            {
                id: 'cash',
                title: t.tiles.cash,
                primary: summary.cash.primary,
                secondary: summary.cash.secondary,
                dotClass: 'bg-primary',
                borderClass: 'border-l-primary',
                Icon: Banknote,
                signed: true,
                emphasize: cashPositive ? 'positive' : 'negative',
            },
            {
                id: 'income',
                title: t.tiles.income,
                primary: summary.income.primary,
                secondary: summary.income.secondary,
                dotClass: 'bg-emerald-500',
                borderClass: 'border-l-emerald-500',
                emphasize: 'neutral',
            },
            {
                id: 'expenses',
                title: t.tiles.expenses,
                primary: summary.expense.primary,
                secondary: summary.expense.secondary,
                dotClass: 'bg-rose-500',
                borderClass: 'border-l-rose-500',
                emphasize: 'neutral',
            },
            {
                id: 'cost',
                title: t.tiles.cost,
                costBreakdown: {
                    expense: {
                        primary: summary.expense.primary,
                        secondary: summary.expense.secondary,
                    },
                    payablesSettled: {
                        primary: summary.payable.settledPrimary,
                        secondary: summary.payable.settledSecondary,
                    },
                    total: costTotalPair,
                },
                dotClass: 'bg-orange-600',
                borderClass: 'border-l-orange-600',
                Icon: Receipt,
            },
            {
                id: 'payables_due',
                title: t.tiles.payables_due,
                obligationBreakdown: {
                    total: {
                        primary: summary.payable.totalPrimary,
                        secondary: summary.payable.totalSecondary,
                    },
                    settled: {
                        primary: summary.payable.settledPrimary,
                        secondary: summary.payable.settledSecondary,
                    },
                    remaining: {
                        primary: summary.payable.remainingPrimary,
                        secondary: summary.payable.remainingSecondary,
                    },
                },
                dotClass: 'bg-amber-500',
                borderClass: 'border-l-amber-500',
            },
            {
                id: 'receivables_due',
                title: t.tiles.receivables_due,
                obligationBreakdown: {
                    total: {
                        primary: summary.receivable.totalPrimary,
                        secondary: summary.receivable.totalSecondary,
                    },
                    settled: {
                        primary: summary.receivable.settledPrimary,
                        secondary: summary.receivable.settledSecondary,
                    },
                    remaining: {
                        primary: summary.receivable.remainingPrimary,
                        secondary: summary.receivable.remainingSecondary,
                    },
                },
                dotClass: 'bg-sky-500',
                borderClass: 'border-l-sky-500',
            },
            {
                id: 'net_position',
                title: t.tiles.net_position,
                primary: summary.net.primary,
                secondary: summary.net.secondary,
                dotClass: 'bg-violet-500',
                borderClass: 'border-l-violet-500',
                Icon: TrendingUp,
                signed: true,
                emphasize: netPositive ? 'positive' : 'negative',
            },
        ];

        return Object.fromEntries(
            tiles.map((tile) => [tile.id, tile]),
        ) as Record<DashboardTileId, MetricTile>;
    }, [summary, t.tiles]);

    const [pendingOrder, setPendingOrder] = useState<DashboardTileId[] | null>(
        null,
    );

    const tileOrder = pendingOrder ?? dashboardTileOrder;

    const orderedTiles = useMemo(
        () =>
            tileOrder
                .map((id) => tilesById[id])
                .filter((t): t is MetricTile => t !== undefined),
        [tileOrder, tilesById],
    );

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;

        if (!over || active.id === over.id) {
            return;
        }

        const a = active.id as DashboardTileId;
        const o = over.id as DashboardTileId;
        const oldIndex = tileOrder.indexOf(a);
        const newIndex = tileOrder.indexOf(o);

        if (oldIndex < 0 || newIndex < 0) {
            return;
        }

        const next = arrayMove(tileOrder, oldIndex, newIndex);

        setPendingOrder(next);

        router.patch(
            patchDashboardTileOrder.url(),
            { order: next },
            {
                preserveScroll: true,
                onSuccess: () => setPendingOrder(null),
                onError: () => setPendingOrder(null),
            },
        );
    }

    return (
        <>
            <Head title={t.meta.title} />

            <div className="relative min-w-0">
                <div className="m-0 max-w-full px-0 py-2 md:px-2 md:py-4">
                    <DashboardSectionCarousel
                        t={t}
                        cardsPanel={
                            <section className="space-y-3">
                                <p className="text-xs text-muted-foreground">
                                    {t.reorder_hint}
                                </p>
                                <ClientOnly
                                    fallback={
                                        <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
                                            {orderedTiles.map((tile) => (
                                                <SortableMetricTile
                                                    key={tile.id}
                                                    tile={tile}
                                                    t={t}
                                                    primaryCurrency={
                                                        primaryCurrency
                                                    }
                                                    secondaryCurrency={
                                                        secondaryCurrency
                                                    }
                                                    primaryDecimals={
                                                        primaryDecimals
                                                    }
                                                    secondaryDecimals={
                                                        secondaryDecimals
                                                    }
                                                />
                                            ))}
                                        </div>
                                    }
                                >
                                    <DndContext
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragEnd={handleDragEnd}
                                    >
                                        <SortableContext
                                            items={tileOrder}
                                            strategy={rectSortingStrategy}
                                        >
                                            <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
                                                {orderedTiles.map((tile) => (
                                                    <SortableMetricTile
                                                        key={tile.id}
                                                        tile={tile}
                                                        t={t}
                                                        primaryCurrency={
                                                            primaryCurrency
                                                        }
                                                        secondaryCurrency={
                                                            secondaryCurrency
                                                        }
                                                        primaryDecimals={
                                                            primaryDecimals
                                                        }
                                                        secondaryDecimals={
                                                            secondaryDecimals
                                                        }
                                                    />
                                                ))}
                                            </div>
                                        </SortableContext>
                                    </DndContext>
                                </ClientOnly>
                            </section>
                        }
                        payablesPanel={
                            <section className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <Wallet className="size-5 text-primary" />
                                    <h2 className="text-lg font-semibold tracking-tight">
                                        {t.section_payables_receivables}
                                    </h2>
                                </div>
                                <div className="grid gap-8 rounded-3xl border border-border/60 bg-muted/20 p-6 md:p-8">
                                    {payableRow && (
                                        <ObligationStrip
                                            label={payableRow.label}
                                            strip={t.strip}
                                            settledPrimary={
                                                payableRow.settledPrimary
                                            }
                                            remainingPrimary={
                                                payableRow.remainingPrimary
                                            }
                                            settledSecondary={
                                                payableRow.settledSecondary
                                            }
                                            remainingSecondary={
                                                payableRow.remainingSecondary
                                            }
                                            primaryCurrency={primaryCurrency}
                                            secondaryCurrency={
                                                secondaryCurrency
                                            }
                                            primaryDecimals={primaryDecimals}
                                            secondaryDecimals={
                                                secondaryDecimals
                                            }
                                        />
                                    )}
                                    {receivableRow && (
                                        <ObligationStrip
                                            label={receivableRow.label}
                                            strip={t.strip}
                                            settledPrimary={
                                                receivableRow.settledPrimary
                                            }
                                            remainingPrimary={
                                                receivableRow.remainingPrimary
                                            }
                                            settledSecondary={
                                                receivableRow.settledSecondary
                                            }
                                            remainingSecondary={
                                                receivableRow.remainingSecondary
                                            }
                                            primaryCurrency={primaryCurrency}
                                            secondaryCurrency={
                                                secondaryCurrency
                                            }
                                            primaryDecimals={primaryDecimals}
                                            secondaryDecimals={
                                                secondaryDecimals
                                            }
                                        />
                                    )}
                                    {!payableRow && !receivableRow && (
                                        <p className="text-sm text-muted-foreground">
                                            {t.no_entries}
                                        </p>
                                    )}
                                </div>
                            </section>
                        }
                        trendsPanel={
                            <section className="space-y-5">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="flex gap-4">
                                        <div className="flex size-8 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
                                            <BarChart3 className="size-5" />
                                        </div>
                                        <div className="min-w-0 space-y-1">
                                            <h2 className="mb-0! text-lg font-semibold tracking-tight">
                                                {t.trends_heading}
                                            </h2>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
                                    <TrendsVolumePanel
                                        title={t.trends.monthly_title}
                                        description=""
                                        data={monthlyTrend}
                                        hasData={hasMonthly}
                                        emptyLabel={t.trends.monthly_empty}
                                        primaryCurrency={primaryCurrency}
                                        secondaryCurrency={secondaryCurrency}
                                        primaryDecimals={primaryDecimals}
                                        secondaryDecimals={secondaryDecimals}
                                        chart={t.chart}
                                        tooltip={t.tooltip}
                                    />
                                    <TrendsVolumePanel
                                        title={t.trends.yearly_title}
                                        description=""
                                        data={yearlyTrend}
                                        hasData={hasYearly}
                                        emptyLabel={t.trends.yearly_empty}
                                        primaryCurrency={primaryCurrency}
                                        secondaryCurrency={secondaryCurrency}
                                        primaryDecimals={primaryDecimals}
                                        secondaryDecimals={secondaryDecimals}
                                        chart={t.chart}
                                        tooltip={t.tooltip}
                                    />
                                </div>
                            </section>
                        }
                    />
                </div>
            </div>
        </>
    );
}

Dashboard.layout = (props: Props) => ({
    breadcrumbs: [
        {
            title: props.t.meta.title,
            href: dashboard(),
        },
    ],
});
