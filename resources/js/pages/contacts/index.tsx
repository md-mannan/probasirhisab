import { Head, Link } from '@inertiajs/react';
import Heading from '@/components/heading';
import {
    index as contactsIndex,
    show as contactsShow,
} from '@/routes/contacts';

type Props = {
    primaryCurrency: string;
    secondaryCurrency: string;
    primaryDecimals: number;
    secondaryDecimals: number;
    contacts: Array<{
        id: number;
        name: string;
        income_primary: string;
        receivable_outstanding_primary: string;
        payable_outstanding_primary: string;
        net_primary: string;
        created_at: string;
    }>;
};

export default function ContactsIndex({
    primaryCurrency,
    primaryDecimals,
    contacts,
}: Props) {
    const formatFixed = (value: number, decimals: number) => {
        if (!Number.isFinite(value)) {
            return '—';
        }

        return value.toFixed(decimals);
    };

    return (
        <>
            <Head title="People" />

            <div className="min-w-0 space-y-6 py-4 pb-6 sm:py-6">
                <div className="mb-0 min-w-0">
                    <Heading
                        title="People"
                        description="Everyone on this workspace. Income by person + payable/receivable outstanding (expenses are handled globally)."
                    />
                </div>

                <div className="rounded-xl border border-sidebar-border/70 bg-card">
                    {contacts.length === 0 ? (
                        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                            No people yet. Add users from Settings → Users and
                            they will appear here.
                        </div>
                    ) : (
                        <div className="max-h-[calc(100dvh-13rem)] overflow-auto">
                            <table className="w-full min-w-[980px] border-separate border-spacing-0 text-sm">
                                <thead>
                                    <tr className="border-b border-sidebar-border/70 text-left font-medium">
                                        <th className="sticky top-0 z-20 w-16 bg-muted px-4 py-3 text-muted-foreground">
                                            SL
                                        </th>
                                        <th className="sticky top-0 z-20 bg-muted px-4 py-3 text-muted-foreground">
                                            Name
                                        </th>
                                        <th className="sticky top-0 z-20 w-44 bg-muted px-4 py-3 text-right text-muted-foreground">
                                            Income
                                        </th>
                                        <th className="sticky top-0 z-20 w-52 bg-muted px-4 py-3 text-right text-muted-foreground">
                                            Outstanding
                                        </th>
                                        <th className="sticky top-0 z-20 w-44 bg-muted px-4 py-3 text-right text-muted-foreground">
                                            Net (AR − AP)
                                        </th>
                                        <th className="sticky top-0 z-20 w-28 bg-muted px-4 py-3 text-right text-muted-foreground">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-sidebar-border/70">
                                    {contacts.map((c, idx) => {
                                        const income = Number(c.income_primary);
                                        const rOut = Number(
                                            c.receivable_outstanding_primary,
                                        );
                                        const pOut = Number(
                                            c.payable_outstanding_primary,
                                        );
                                        const net = Number(c.net_primary);

                                        return (
                                            <tr
                                                key={c.id}
                                                className="even:bg-muted/15 hover:bg-muted/30"
                                            >
                                                <td className="px-4 py-3 align-middle text-muted-foreground">
                                                    {idx + 1}
                                                </td>
                                                <td className="px-4 py-3 align-middle">
                                                    <Link
                                                        href={contactsShow({
                                                            contact: c.id,
                                                        })}
                                                        className="font-medium hover:underline"
                                                    >
                                                        {c.name}
                                                    </Link>
                                                </td>
                                                <td className="px-4 py-3 text-right align-middle tabular-nums">
                                                    {formatFixed(
                                                        income,
                                                        primaryDecimals,
                                                    )}{' '}
                                                    <span className="text-xs text-muted-foreground">
                                                        {primaryCurrency}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right align-middle tabular-nums">
                                                    <div className="text-xs text-muted-foreground">
                                                        Receivable:{' '}
                                                        <span className="font-medium text-foreground">
                                                            {formatFixed(
                                                                rOut,
                                                                primaryDecimals,
                                                            )}
                                                        </span>{' '}
                                                        {primaryCurrency}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Payable:{' '}
                                                        <span className="font-medium text-foreground">
                                                            {formatFixed(
                                                                pOut,
                                                                primaryDecimals,
                                                            )}
                                                        </span>{' '}
                                                        {primaryCurrency}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right align-middle font-medium tabular-nums">
                                                    <span
                                                        className={
                                                            net < 0
                                                                ? 'text-destructive'
                                                                : 'text-emerald-600 dark:text-emerald-400'
                                                        }
                                                    >
                                                        {formatFixed(
                                                            net,
                                                            primaryDecimals,
                                                        )}
                                                    </span>{' '}
                                                    <span className="text-xs text-muted-foreground">
                                                        {primaryCurrency}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 align-middle">
                                                    <div className="flex justify-end gap-1">
                                                        <Link
                                                            href={contactsShow({
                                                                contact: c.id,
                                                            })}
                                                            className="text-sm font-medium text-primary hover:underline"
                                                        >
                                                            View
                                                        </Link>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

ContactsIndex.layout = {
    breadcrumbs: [
        {
            title: 'People',
            href: contactsIndex(),
        },
    ],
};
