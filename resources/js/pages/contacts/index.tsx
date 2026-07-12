import { Form, Head, Link, router } from '@inertiajs/react';
import { Pencil, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    destroy as contactsDestroy,
    index as contactsIndex,
    show as contactsShow,
    store as contactsStore,
    update as contactsUpdate,
} from '@/routes/contacts';

type ContactRow = {
    id: number | null;
    name: string;
    is_group: boolean;
    member_ids: number[] | null;
    income_primary: string;
    expense_primary: string;
    receivable_total_primary: string;
    payable_total_primary: string;
    asset_primary: string;
    liability_primary: string;
    net_primary: string;
};

type Props = {
    primaryCurrency: string;
    secondaryCurrency: string;
    primaryDecimals: number;
    secondaryDecimals: number;
    contacts: ContactRow[];
    totals: ContactRow;
};

export default function ContactsIndex({
    primaryCurrency,
    primaryDecimals,
    contacts,
    totals,
}: Props) {
    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');

    const openEdit = (c: ContactRow) => {
        if (c.id === null) {
            return;
        }

        setEditId(c.id);
        setEditName(c.name);
        setEditOpen(true);
    };

    const fmt = (value: string) => {
        const n = Number(value);

        return Number.isFinite(n) ? n.toFixed(primaryDecimals) : '—';
    };

    // Money cell: value + faint currency code, optional colour tone.
    const money = (value: string, tone?: string) => (
        <>
            <span className={tone ? `font-medium ${tone}` : ''}>
                {fmt(value)}
            </span>{' '}
            <span className="text-xs text-muted-foreground">
                {primaryCurrency}
            </span>
        </>
    );

    const netTone = (value: string) =>
        Number(value) < 0
            ? 'text-destructive'
            : 'text-emerald-600 dark:text-emerald-400';

    return (
        <>
            <Head title="People" />

            <div className="min-w-0 space-y-6 py-4 pb-6 sm:py-6">
                <div className="mb-0 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                        <Heading
                            title="People"
                            description="Financial overview per person — income, expense, what you lent/borrowed, and what's still owed."
                        />
                    </div>
                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger asChild>
                            <Button className="w-full shrink-0 sm:w-auto">
                                Add person
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add person</DialogTitle>
                                <DialogDescription>
                                    Add anyone you deal with — they don’t need an
                                    app login.
                                </DialogDescription>
                            </DialogHeader>

                            <Form
                                action={contactsStore.url()}
                                method="post"
                                options={{ preserveScroll: true }}
                                className="grid gap-4"
                                onSuccess={() => setCreateOpen(false)}
                            >
                                {({ processing, errors }) => (
                                    <>
                                        <div className="grid gap-2">
                                            <Label htmlFor="name">Name</Label>
                                            <Input
                                                id="name"
                                                name="name"
                                                placeholder="e.g. Karim (brother), Landlord"
                                                required
                                            />
                                            <InputError message={errors.name} />
                                        </div>

                                        <DialogFooter>
                                            <Button
                                                type="submit"
                                                disabled={processing}
                                            >
                                                Add
                                            </Button>
                                        </DialogFooter>
                                    </>
                                )}
                            </Form>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="rounded-xl border border-sidebar-border/70 bg-card">
                    {contacts.length === 0 ? (
                        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                            No people yet. Add someone you lend to or borrow
                            from, then tag them on a transaction.
                        </div>
                    ) : (
                        <div className="max-h-[calc(100dvh-13rem)] overflow-auto">
                            <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-sm">
                                <thead>
                                    <tr className="text-left font-medium">
                                        <th className="sticky top-0 z-20 w-12 bg-muted px-3 py-3 text-muted-foreground">
                                            SL
                                        </th>
                                        <th className="sticky top-0 z-20 bg-muted px-3 py-3 text-muted-foreground">
                                            Name
                                        </th>
                                        <th className="sticky top-0 z-20 bg-muted px-3 py-3 text-right text-muted-foreground">
                                            Income
                                        </th>
                                        <th className="sticky top-0 z-20 bg-muted px-3 py-3 text-right text-muted-foreground">
                                            Expense
                                        </th>
                                        <th className="sticky top-0 z-20 bg-muted px-3 py-3 text-right text-muted-foreground">
                                            Receivable
                                            <span className="block text-[11px] font-normal">
                                                lent (total)
                                            </span>
                                        </th>
                                        <th className="sticky top-0 z-20 bg-muted px-3 py-3 text-right text-muted-foreground">
                                            Payable
                                            <span className="block text-[11px] font-normal">
                                                borrowed (total)
                                            </span>
                                        </th>
                                        <th className="sticky top-0 z-20 bg-muted px-3 py-3 text-right text-muted-foreground">
                                            Asset
                                            <span className="block text-[11px] font-normal">
                                                still owed to you
                                            </span>
                                        </th>
                                        <th className="sticky top-0 z-20 bg-muted px-3 py-3 text-right text-muted-foreground">
                                            Liability
                                            <span className="block text-[11px] font-normal">
                                                still owed by you
                                            </span>
                                        </th>
                                        <th className="sticky top-0 z-20 bg-muted px-3 py-3 text-right text-muted-foreground">
                                            Net
                                            <span className="block text-[11px] font-normal">
                                                asset − liability
                                            </span>
                                        </th>
                                        <th className="sticky top-0 z-20 w-24 bg-muted px-3 py-3 text-right text-muted-foreground">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-sidebar-border/70">
                                    {contacts.map((c, idx) => (
                                        <tr
                                            key={
                                                c.is_group
                                                    ? `g-${c.member_ids?.join('-')}`
                                                    : `c-${c.id}`
                                            }
                                            className={
                                                c.is_group
                                                    ? 'bg-primary/5 hover:bg-primary/10'
                                                    : 'even:bg-muted/15 hover:bg-muted/30'
                                            }
                                        >
                                            <td className="px-3 py-3 align-middle text-muted-foreground">
                                                {idx + 1}
                                            </td>
                                            <td className="px-3 py-3 align-middle">
                                                {c.is_group ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                                                            <Users className="size-3" />
                                                            Group
                                                        </span>
                                                        <span className="font-medium">
                                                            {c.name}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <Link
                                                        href={contactsShow({
                                                            contact:
                                                                c.id as number,
                                                        })}
                                                        className="font-medium hover:underline"
                                                    >
                                                        {c.name}
                                                    </Link>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 text-right align-middle tabular-nums">
                                                {money(c.income_primary)}
                                            </td>
                                            <td className="px-3 py-3 text-right align-middle tabular-nums">
                                                {money(c.expense_primary)}
                                            </td>
                                            <td className="px-3 py-3 text-right align-middle tabular-nums">
                                                {money(
                                                    c.receivable_total_primary,
                                                )}
                                            </td>
                                            <td className="px-3 py-3 text-right align-middle tabular-nums">
                                                {money(c.payable_total_primary)}
                                            </td>
                                            <td className="px-3 py-3 text-right align-middle tabular-nums">
                                                {money(
                                                    c.asset_primary,
                                                    'text-emerald-600 dark:text-emerald-400',
                                                )}
                                            </td>
                                            <td className="px-3 py-3 text-right align-middle tabular-nums">
                                                {money(
                                                    c.liability_primary,
                                                    'text-destructive',
                                                )}
                                            </td>
                                            <td className="px-3 py-3 text-right align-middle tabular-nums">
                                                {money(
                                                    c.net_primary,
                                                    netTone(c.net_primary),
                                                )}
                                            </td>
                                            <td className="px-3 py-3 align-middle">
                                                {c.is_group ? (
                                                    <div className="flex justify-end text-xs text-muted-foreground">
                                                        joint
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-end gap-1">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            onClick={() =>
                                                                openEdit(c)
                                                            }
                                                            size="icon"
                                                            aria-label="Edit person"
                                                        >
                                                            <Pencil className="size-4" />
                                                        </Button>
                                                        <ConfirmDeleteDialog
                                                            title="Delete person?"
                                                            description={
                                                                <>
                                                                    “{c.name}”
                                                                    will be
                                                                    removed.
                                                                    Transactions
                                                                    tagged with
                                                                    this person
                                                                    keep their
                                                                    record but
                                                                    lose the
                                                                    link. This
                                                                    cannot be
                                                                    undone.
                                                                </>
                                                            }
                                                            confirmLabel="Delete person"
                                                            onConfirm={() =>
                                                                router.delete(
                                                                    contactsDestroy.url(
                                                                        {
                                                                            contact:
                                                                                c.id as number,
                                                                        },
                                                                    ),
                                                                    {
                                                                        preserveScroll:
                                                                            true,
                                                                    },
                                                                )
                                                            }
                                                            trigger={
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    className="text-destructive hover:text-destructive"
                                                                    size="icon"
                                                                    aria-label="Delete person"
                                                                >
                                                                    <Trash2 className="size-4" />
                                                                </Button>
                                                            }
                                                        />
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-sidebar-border font-semibold">
                                        <td className="sticky bottom-0 z-10 bg-muted px-3 py-3" />
                                        <td className="sticky bottom-0 z-10 bg-muted px-3 py-3">
                                            {totals.name}
                                        </td>
                                        <td className="sticky bottom-0 z-10 bg-muted px-3 py-3 text-right tabular-nums">
                                            {money(totals.income_primary)}
                                        </td>
                                        <td className="sticky bottom-0 z-10 bg-muted px-3 py-3 text-right tabular-nums">
                                            {money(totals.expense_primary)}
                                        </td>
                                        <td className="sticky bottom-0 z-10 bg-muted px-3 py-3 text-right tabular-nums">
                                            {money(
                                                totals.receivable_total_primary,
                                            )}
                                        </td>
                                        <td className="sticky bottom-0 z-10 bg-muted px-3 py-3 text-right tabular-nums">
                                            {money(totals.payable_total_primary)}
                                        </td>
                                        <td className="sticky bottom-0 z-10 bg-muted px-3 py-3 text-right tabular-nums">
                                            {money(
                                                totals.asset_primary,
                                                'text-emerald-600 dark:text-emerald-400',
                                            )}
                                        </td>
                                        <td className="sticky bottom-0 z-10 bg-muted px-3 py-3 text-right tabular-nums">
                                            {money(
                                                totals.liability_primary,
                                                'text-destructive',
                                            )}
                                        </td>
                                        <td className="sticky bottom-0 z-10 bg-muted px-3 py-3 text-right tabular-nums">
                                            {money(
                                                totals.net_primary,
                                                netTone(totals.net_primary),
                                            )}
                                        </td>
                                        <td className="sticky bottom-0 z-10 bg-muted px-3 py-3" />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit person</DialogTitle>
                        <DialogDescription>Update the name.</DialogDescription>
                    </DialogHeader>

                    {editId !== null && (
                        <Form
                            action={contactsUpdate.url({ contact: editId })}
                            method="patch"
                            options={{ preserveScroll: true }}
                            className="grid gap-4"
                            onSuccess={() => setEditOpen(false)}
                        >
                            {({ processing, errors }) => (
                                <>
                                    <div className="grid gap-2">
                                        <Label htmlFor="edit_name">Name</Label>
                                        <Input
                                            id="edit_name"
                                            name="name"
                                            value={editName}
                                            onChange={(e) =>
                                                setEditName(e.target.value)
                                            }
                                            required
                                        />
                                        <InputError message={errors.name} />
                                    </div>

                                    <DialogFooter>
                                        <Button
                                            type="submit"
                                            disabled={processing}
                                        >
                                            Save
                                        </Button>
                                    </DialogFooter>
                                </>
                            )}
                        </Form>
                    )}
                </DialogContent>
            </Dialog>
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
