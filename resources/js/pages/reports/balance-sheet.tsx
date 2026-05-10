import { Head } from '@inertiajs/react';
import { Calendar } from 'lucide-react';
import * as React from 'react';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import reports from '@/routes/reports';

type Money = {
    primary: string;
    secondary: string | null;
};

const num = (value: string) => {
    const n = Number(value);

    return Number.isFinite(n) ? n : null;
};

const format = (value: string, decimals: number) => {
    const n = Number(value);

    if (!Number.isFinite(n)) {
        return '—';
    }

    return n.toFixed(decimals);
};

const formatSecondary = (value: string | null, decimals: number) => {
    if (value === null) {
        return null;
    }

    const n = Number(value);

    if (!Number.isFinite(n)) {
        return null;
    }

    return n.toFixed(decimals);
};

function useCountUp(target: number | null, opts?: { durationMs?: number }) {
    const durationMs = opts?.durationMs ?? 900;
    const [value, setValue] = React.useState(0);
    const currentRef = React.useRef(0);

    React.useEffect(() => {
        if (target === null || !Number.isFinite(target)) {
            const raf = requestAnimationFrame(() => {
                currentRef.current = 0;
                setValue(0);
            });

            return () => cancelAnimationFrame(raf);
        }

        const start = performance.now();
        const from = currentRef.current;

        let raf = 0;
        const tick = (now: number) => {
            const t = Math.min(1, (now - start) / durationMs);
            const eased = 1 - Math.pow(1 - t, 3);
            const next = from + (target - from) * eased;
            currentRef.current = next;
            setValue(next);

            if (t < 1) {
                raf = requestAnimationFrame(tick);
            }
        };

        raf = requestAnimationFrame(tick);

        return () => cancelAnimationFrame(raf);
    }, [target, durationMs]);

    return value;
}

const seeded = (seed: number) => {
    // Mulberry32
    let t = seed >>> 0;

    return () => {
        t += 0x6d2b79f5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);

        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
};

function Sparkline({
    series,
    tone = 'neutral',
    drawDurationMs = 1800,
}: {
    series: number[];
    tone?: 'neutral' | 'positive' | 'negative';
    drawDurationMs?: number;
}) {
    const [draw, setDraw] = React.useState(false);
    React.useEffect(() => {
        const raf = requestAnimationFrame(() => setDraw(true));

        return () => cancelAnimationFrame(raf);
    }, []);

    const w = 520;
    const h = 120;
    const pad = 8;
    const min = Math.min(...series);
    const max = Math.max(...series);
    const span = max - min || 1;

    const points = series.map((v, i) => {
        const x = pad + (i * (w - pad * 2)) / (series.length - 1);
        const y = pad + (1 - (v - min) / span) * (h - pad * 2);

        return { x, y };
    });

    const d = points
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
        .join(' ');

    const stroke =
        tone === 'positive'
            ? 'stroke-emerald-500'
            : tone === 'negative'
              ? 'stroke-destructive'
              : 'stroke-primary';

    return (
        <svg
            viewBox={`0 0 ${w} ${h}`}
            className="h-24 w-full"
            role="img"
            aria-label="Net position sparkline"
        >
            <defs>
                <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#705CFC" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#705CFC" stopOpacity="0" />
                </linearGradient>
            </defs>
            <path
                d={`${d} L ${w - pad} ${h - pad} L ${pad} ${h - pad} Z`}
                className="fill-[url(#spark-fill)]"
            />
            <path
                d={d}
                className={cn('fill-none stroke-[2.5]', stroke)}
                style={{
                    strokeDasharray: 1600,
                    strokeDashoffset: draw ? 0 : 1600,
                    transition: `stroke-dashoffset ${drawDurationMs}ms cubic-bezier(0.22, 1, 0.36, 1)`,
                }}
            />
            <circle
                cx={points.at(-1)?.x ?? w - pad}
                cy={points.at(-1)?.y ?? h / 2}
                r="3.5"
                className={cn('fill-background stroke-2', stroke)}
            />
        </svg>
    );
}

type Props = {
    primaryCurrency: string;
    secondaryCurrency: string;
    primaryDecimals: number;
    secondaryDecimals: number;
    cash: Money;
    receivable: Money;
    payable: Money;
    totals: {
        assets: Money;
        liabilities: Money;
        net: Money;
    };
};

export default function BalanceSheet({
    primaryCurrency,
    secondaryCurrency,
    primaryDecimals,
    secondaryDecimals,
    cash,
    receivable,
    payable,
    totals,
}: Props) {
    const assetsN = num(totals.assets.primary);
    const liabilitiesN = num(totals.liabilities.primary);
    const netN = num(totals.net.primary);

    const asOf = new Date().toISOString().slice(0, 10);
    const secondaryOk =
        cash.secondary !== null &&
        receivable.secondary !== null &&
        payable.secondary !== null &&
        totals.net.secondary !== null;

    // NOTE: This report is intentionally “accounting-statement” style.
    // We compute only the values we render to keep the UI simple and readable.

    const netIsNegative = netN !== null && netN < 0;
    const netTone = netIsNegative
        ? 'text-destructive'
        : 'text-emerald-600 dark:text-emerald-400';

    /** Shared duration for net counter and sparkline stroke draw. */
    const SMOOTH_ANIM_MS = 1800;

    const netAnimated = useCountUp(netN, { durationMs: SMOOTH_ANIM_MS });

    const series = React.useMemo(() => {
        const end = netN ?? 0;
        const rnd = seeded(Math.round((assetsN ?? 0) * 10 + (liabilitiesN ?? 0) * 3));
        const n = 30;
        let cur = end;
        const out: number[] = [];

        for (let i = 0; i < n; i += 1) {
            const noise = (rnd() - 0.5) * (Math.abs(end) * 0.06 + 30);
            const drift = (end - cur) * 0.15;
            cur = cur + drift + noise;
            out.push(cur);
        }

        out[out.length - 1] = end;

        return out;
    }, [assetsN, liabilitiesN, netN]);

    return (
        <TooltipProvider delayDuration={200}>
            <>
                <Head title="Balance Sheet" />

                <div className="w-full min-w-0 space-y-6 pb-8">
                    <div className="border-b border-border/60 bg-background px-2 py-4 sm:px-4 md:px-6 lg:px-8">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <Heading
                                className="mb-0 max-w-3xl space-y-1"
                                title="Balance Sheet"
                                description="A snapshot of assets and liabilities at a point in time."
                            />
                            <div className="flex shrink-0 items-center gap-2 rounded-md bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground">
                                <Calendar className="size-4 opacity-70" aria-hidden />
                                <span>
                                    As of{' '}
                                    <span className="font-medium text-foreground">{asOf}</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6 px-2 sm:px-4 md:px-6 lg:px-8">
                        <div className="grid gap-4 lg:grid-cols-12">
                            {/* Summary */}
                            <div className="lg:col-span-6">
                                <Card className="h-full overflow-hidden">
                                    <div className="h-1 w-full bg-linear-to-r from-primary/70 via-primary to-primary/70" />
                                    <CardHeader className="pb-2">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <CardTitle className="text-base">Net position</CardTitle>
                                                <CardDescription>Assets − liabilities</CardDescription>
                                            </div>
                                            <Badge
                                                variant={
                                                    netIsNegative
                                                        ? 'destructive'
                                                        : netN === 0
                                                          ? 'outline'
                                                          : 'secondary'
                                                }
                                            >
                                                {netIsNegative ? 'Deficit' : netN === 0 ? 'Balanced' : 'Surplus'}
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        <div className="grid gap-3 lg:grid-cols-12 lg:items-end">
                                            <div className="lg:col-span-6">
                                                <div className={cn('text-4xl font-semibold tabular-nums', netTone)}>
                                                    {format(String(netAnimated), primaryDecimals)} {primaryCurrency}
                                                </div>
                                                {totals.net.secondary !== null && (
                                                    <div className="mt-1 text-xs tabular-nums text-muted-foreground">
                                                        {formatSecondary(totals.net.secondary, secondaryDecimals)}{' '}
                                                        {secondaryCurrency}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="lg:col-span-6">
                                                <Sparkline
                                                    series={series}
                                                    tone={
                                                        netIsNegative
                                                            ? 'negative'
                                                            : netN === 0
                                                              ? 'neutral'
                                                              : 'positive'
                                                    }
                                                    drawDurationMs={SMOOTH_ANIM_MS}
                                                />
                                            </div>
                                        </div>

                                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                                                <div className="text-xs text-muted-foreground">Total assets</div>
                                                <div className="mt-1 text-2xl font-semibold tabular-nums">
                                                    {format(totals.assets.primary, primaryDecimals)} {primaryCurrency}
                                                </div>
                                            </div>
                                            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                                                <div className="text-xs text-muted-foreground">Total liabilities</div>
                                                <div className="mt-1 text-2xl font-semibold tabular-nums">
                                                    {format(totals.liabilities.primary, primaryDecimals)} {primaryCurrency}
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Detailed breakdown (replaces former Financial health slot) */}
                            <div className="min-h-0 min-w-0 lg:col-span-6">
                                <Card className="h-full overflow-hidden shadow-sm">
                                    <div className="h-1 w-full bg-linear-to-r from-primary/70 via-primary to-primary/70" />
                                    <CardHeader className="pb-3">
                                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                                        <div className="min-w-0 space-y-1">
                                            <CardTitle className="text-base">
                                                Detailed breakdown
                                            </CardTitle>
                                            <CardDescription className="max-w-xl">
                                                Assets and liabilities—same columns for quick comparison.
                                            </CardDescription>
                                        </div>
                                        <div className="flex shrink-0 flex-wrap gap-2">
                                            <span className="inline-flex items-center rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                                                Assets
                                            </span>
                                            <span className="inline-flex items-center rounded-md border border-destructive/25 bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                                                Liabilities
                                            </span>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="min-h-0 px-0 pb-0 pt-0">
                                    <div className="overflow-x-auto lg:overflow-x-visible scrollbar-hide px-4 pb-5 sm:px-6 sm:pb-6">
                                        <table className="w-full min-w-[520px] table-fixed text-sm">
                                            <colgroup>
                                                <col className="w-[16%]" />
                                                <col className="w-[30%]" />
                                                <col className="w-[16%]" />
                                                <col className="w-[19%]" />
                                                <col className="w-[19%]" />
                                            </colgroup>
                                            <thead className="border-b border-border/60 bg-muted/30 text-muted-foreground">
                                                <tr>
                                                    <th className="h-11 px-3 text-left text-xs font-semibold uppercase tracking-wide">
                                                        Category
                                                    </th>
                                                    <th className="h-11 px-3 text-left text-xs font-semibold uppercase tracking-wide">
                                                        Item
                                                    </th>
                                                    <th className="h-11 px-3 text-left text-xs font-semibold uppercase tracking-wide">
                                                        Type
                                                    </th>
                                                    <th className="h-11 px-3 text-right text-xs font-semibold uppercase tracking-wide">
                                                        {primaryCurrency}
                                                    </th>
                                                    <th className="h-11 px-3 text-right text-xs font-semibold uppercase tracking-wide">
                                                        {secondaryCurrency}
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr className="bg-emerald-500/6 dark:bg-emerald-500/10">
                                                    <td
                                                        colSpan={5}
                                                        className="border-l-4 border-l-emerald-600 py-2.5 pl-3 pr-3 text-xs font-semibold uppercase tracking-wider text-emerald-900 dark:text-emerald-100"
                                                    >
                                                        Assets
                                                    </td>
                                                </tr>
                                                <tr className="border-b border-border/40">
                                                    <td className="h-10 px-3 text-muted-foreground">Current</td>
                                                    <td className="h-10 px-3">Cash</td>
                                                    <td className="h-10 px-3 text-muted-foreground">Liquid</td>
                                                    <td className="h-10 px-3 text-right tabular-nums">
                                                        {format(cash.primary, primaryDecimals)}
                                                    </td>
                                                    <td className="h-10 px-3 text-right tabular-nums text-muted-foreground">
                                                        {cash.secondary === null
                                                            ? '—'
                                                            : formatSecondary(cash.secondary, secondaryDecimals)}
                                                    </td>
                                                </tr>
                                                <tr className="border-b border-border/40">
                                                    <td className="h-10 px-3 text-muted-foreground">Current</td>
                                                    <td className="h-10 px-3">Receivable (AR)</td>
                                                    <td className="h-10 px-3 text-muted-foreground">Credit</td>
                                                    <td className="h-10 px-3 text-right tabular-nums">
                                                        {format(receivable.primary, primaryDecimals)}
                                                    </td>
                                                    <td className="h-10 px-3 text-right tabular-nums text-muted-foreground">
                                                        {receivable.secondary === null
                                                            ? '—'
                                                            : formatSecondary(
                                                                  receivable.secondary,
                                                                  secondaryDecimals,
                                                              )}
                                                    </td>
                                                </tr>
                                                <tr className="border-b border-border/60 bg-muted/20">
                                                    <td className="h-10 px-3 text-muted-foreground" />
                                                    <td className="h-10 px-3 font-semibold text-foreground">
                                                        Total assets
                                                    </td>
                                                    <td className="h-10 px-3 text-muted-foreground" />
                                                    <td className="h-10 px-3 text-right font-semibold tabular-nums">
                                                        {format(totals.assets.primary, primaryDecimals)}
                                                    </td>
                                                    <td className="h-10 px-3 text-right font-medium tabular-nums text-muted-foreground">
                                                        {totals.assets.secondary === null
                                                            ? '—'
                                                            : formatSecondary(
                                                                  totals.assets.secondary,
                                                                  secondaryDecimals,
                                                              )}
                                                    </td>
                                                </tr>

                                                <tr className="bg-destructive/6 dark:bg-destructive/10">
                                                    <td
                                                        colSpan={5}
                                                        className="border-l-4 border-l-destructive py-2.5 pl-3 pr-3 text-xs font-semibold uppercase tracking-wider text-destructive"
                                                    >
                                                        Liabilities
                                                    </td>
                                                </tr>
                                                <tr className="border-b border-border/40">
                                                    <td className="h-10 px-3 text-muted-foreground">Current</td>
                                                    <td className="h-10 px-3">Payable (AP)</td>
                                                    <td className="h-10 px-3 text-muted-foreground">Trade</td>
                                                    <td className="h-10 px-3 text-right tabular-nums">
                                                        {format(payable.primary, primaryDecimals)}
                                                    </td>
                                                    <td className="h-10 px-3 text-right tabular-nums text-muted-foreground">
                                                        {payable.secondary === null
                                                            ? '—'
                                                            : formatSecondary(payable.secondary, secondaryDecimals)}
                                                    </td>
                                                </tr>
                                                <tr className="bg-muted/25">
                                                    <td className="h-10 px-3 text-muted-foreground" />
                                                    <td className="h-10 px-3 font-semibold text-foreground">
                                                        Total liabilities
                                                    </td>
                                                    <td className="h-10 px-3 text-muted-foreground" />
                                                    <td className="h-10 px-3 text-right font-semibold tabular-nums">
                                                        {format(totals.liabilities.primary, primaryDecimals)}
                                                    </td>
                                                    <td className="h-10 px-3 text-right font-medium tabular-nums text-muted-foreground">
                                                        {totals.liabilities.secondary === null
                                                            ? '—'
                                                            : formatSecondary(
                                                                  totals.liabilities.secondary,
                                                                  secondaryDecimals,
                                                              )}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                            </div>
                        </div>

                        {!secondaryOk && (
                            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
                                Secondary currency totals are partially unavailable for some records.
                            </div>
                        )}
                    </div>
                </div>
            </>
        </TooltipProvider>
    );
}

BalanceSheet.layout = {
    breadcrumbs: [
        {
            title: 'Balance Sheet',
            href: reports.balanceSheet(),
        },
    ],
};
