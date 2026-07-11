import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Eye } from 'lucide-react';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { index as contactsIndex } from '@/routes/contacts';
import { show as transactionsShow } from '@/routes/transactions';

type Props = {
    primaryCurrency: string;
    secondaryCurrency: string;
    primaryDecimals: number;
    secondaryDecimals: number;
    contact: {
        id: number;
        name: string;
    };
    transactions: Array<{
        id: number;
        type: string;
        amount: string;
        settled_amount: string | null;
        currency: string;
        secondary_amount: string | null;
        secondary_currency: string | null;
        rate: string | null;
        source: string | null;
        occurred_on: string;
        note: string | null;
        category: { id: number; name: string; type: string } | null;
    }>;
};

export default function ContactShow({
    primaryCurrency,
    secondaryCurrency,
    primaryDecimals,
    secondaryDecimals,
    contact,
    transactions,
}: Props) {
    const formatFixed = (value: number, decimals: number) => {
        if (!Number.isFinite(value)) {
return '—';
}

        return value.toFixed(decimals);
    };

    const directionForType = (type: string) => {
        if (type === 'payable') {
return -1;
}

        return 1; // income + receivable
    };

    const outstandingFor = (t: Props['transactions'][number]) => {
        if (t.type !== 'payable' && t.type !== 'receivable') {
return null;
}

        const total = Math.abs(Number(t.amount));
        const settled = Math.max(0, Number(t.settled_amount ?? 0));

        if (!Number.isFinite(total) || !Number.isFinite(settled)) {
return null;
}

        return Math.max(0, total - settled);
    };

    return (
        <>
            <Head title={contact.name} />

            <div className="min-w-0 space-y-6 py-4 pb-6 sm:py-6">
                <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                        <Heading
                            title={contact.name}
                            description="Income + payable/receivable (expenses are not shown here)"
                        />
                    </div>
                    <Button
                        variant="outline"
                        className="w-full shrink-0 sm:w-auto"
                        asChild
                    >
                        <Link href={contactsIndex()}>
                            <ArrowLeft className="mr-2 size-4 shrink-0" />
                            Back
                        </Link>
                    </Button>
                </div>

                <div className="rounded-xl border border-sidebar-border/70 bg-card">
                    {transactions.length === 0 ? (
                        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                            No transactions for this person yet.
                        </div>
                    ) : (
                        <div className="overflow-x-auto overflow-y-visible">
                            <TooltipProvider delayDuration={150}>
                                <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-sm">
                                <thead>
                                    <tr className="border-b border-sidebar-border/70 text-left font-medium">
                                        <th className="sticky top-16 z-20 w-16 bg-muted/40 px-4 py-3 text-muted-foreground backdrop-blur supports-backdrop-filter:bg-muted/30">
                                            SL
                                        </th>
                                        <th className="sticky top-16 z-20 w-32 bg-muted/40 px-4 py-3 text-muted-foreground backdrop-blur supports-backdrop-filter:bg-muted/30">
                                            Date
                                        </th>
                                        <th className="sticky top-16 z-20 bg-muted/40 px-4 py-3 text-muted-foreground backdrop-blur supports-backdrop-filter:bg-muted/30">
                                            Note
                                        </th>
                                        <th className="sticky top-16 z-20 w-28 bg-muted/40 px-4 py-3 text-muted-foreground backdrop-blur supports-backdrop-filter:bg-muted/30">
                                            Type
                                        </th>
                                        <th className="sticky top-16 z-20 w-40 bg-muted/40 px-4 py-3 text-muted-foreground backdrop-blur supports-backdrop-filter:bg-muted/30">
                                            Source
                                        </th>
                                        <th className="sticky top-16 z-20 w-48 bg-muted/40 px-4 py-3 text-muted-foreground backdrop-blur supports-backdrop-filter:bg-muted/30">
                                            Category
                                        </th>
                                        <th className="sticky top-16 z-20 w-44 bg-muted/40 px-4 py-3 text-right text-muted-foreground backdrop-blur supports-backdrop-filter:bg-muted/30">
                                            Amount
                                        </th>
                                        <th className="sticky top-16 z-20 w-44 bg-muted/40 px-4 py-3 text-right text-muted-foreground backdrop-blur supports-backdrop-filter:bg-muted/30">
                                            Outstanding
                                        </th>
                                        <th className="sticky top-16 z-20 w-24 bg-muted/40 px-4 py-3 text-right text-muted-foreground backdrop-blur supports-backdrop-filter:bg-muted/30">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-sidebar-border/70">
                                    {transactions.map((t, idx) => {
                                        const out = outstandingFor(t);

                                        return (
                                            <tr
                                                key={t.id}
                                                className="even:bg-muted/15 hover:bg-muted/30"
                                            >
                                                <td className="px-4 py-3 align-middle text-muted-foreground">
                                                    {idx + 1}
                                                </td>
                                                <td className="px-4 py-3 align-middle tabular-nums text-muted-foreground">
                                                    {t.occurred_on}
                                                </td>
                                                <td className="px-4 py-3 align-middle">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="max-w-[260px] cursor-help truncate font-medium leading-5">
                                                                {t.note ?? '—'}
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent
                                                            side="bottom"
                                                            align="start"
                                                            className="max-w-[560px] whitespace-pre-wrap text-left leading-5"
                                                        >
                                                            {t.note ?? '—'}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </td>
                                                <td className="px-4 py-3 align-middle">
                                                    {t.type}
                                                </td>
                                                <td className="px-4 py-3 align-middle">
                                                    <div className="truncate text-muted-foreground">
                                                        {t.source ?? '—'}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 align-middle">
                                                    <div className="truncate">
                                                        {t.category?.name ?? (
                                                            <span className="text-muted-foreground">
                                                                —
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 align-middle text-right tabular-nums font-medium whitespace-nowrap">
                                                    <div
                                                        className={
                                                            directionForType(
                                                                t.type,
                                                            ) < 0
                                                                ? 'text-destructive'
                                                                : 'text-emerald-600 dark:text-emerald-400'
                                                        }
                                                    >
                                                        {directionForType(
                                                            t.type,
                                                        ) < 0
                                                            ? '- '
                                                            : '+ '}
                                                        <span className="tabular-nums">
                                                            {formatFixed(
                                                                Math.abs(
                                                                    Number(
                                                                        t.amount,
                                                                    ),
                                                                ),
                                                                primaryDecimals,
                                                            )}
                                                        </span>{' '}
                                                        <span className="text-xs font-normal text-muted-foreground">
                                                            {primaryCurrency}
                                                        </span>
                                                    </div>
                                                    {t.secondary_amount &&
                                                        t.secondary_currency && (
                                                            <div className="text-xs text-muted-foreground">
                                                                ≈{' '}
                                                                {formatFixed(
                                                                    Number(
                                                                        t.secondary_amount,
                                                                    ),
                                                                    secondaryDecimals,
                                                                )}{' '}
                                                                {secondaryCurrency}
                                                            </div>
                                                        )}
                                                </td>
                                                <td className="px-4 py-3 align-middle text-right tabular-nums text-muted-foreground whitespace-nowrap">
                                                    {out === null ? (
                                                        '—'
                                                    ) : (
                                                        <>
                                                            <span className="tabular-nums">
                                                                {formatFixed(
                                                                    out,
                                                                    primaryDecimals,
                                                                )}
                                                            </span>{' '}
                                                            <span className="text-xs font-normal text-muted-foreground">
                                                                {primaryCurrency}
                                                            </span>
                                                        </>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 align-middle">
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
                                                                            t.id,
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
            </div>
        </>
    );
}

ContactShow.layout = {
    breadcrumbs: [
        { title: 'People', href: contactsIndex() },
        { title: 'Details', href: contactsIndex() },
    ],
};

