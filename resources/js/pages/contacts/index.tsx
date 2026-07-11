import { Form, Head, Link, router } from '@inertiajs/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
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

    const [createOpen, setCreateOpen] = useState(false);

    const [editOpen, setEditOpen] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');

    const openEdit = (c: Props['contacts'][number]) => {
        setEditId(c.id);
        setEditName(c.name);
        setEditOpen(true);
    };

    return (
        <>
            <Head title="People" />

            <div className="min-w-0 space-y-6 py-4 pb-6 sm:py-6">
                <div className="mb-0 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                        <Heading
                            title="People"
                            description="Income by person + payable/receivable outstanding (expenses are handled globally)"
                        />
                    </div>

                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger asChild>
                            <Button className="w-full shrink-0 sm:w-auto">
                                <Plus className="mr-2 size-4 shrink-0" />
                                Add person
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add person</DialogTitle>
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
                                                required
                                                placeholder="Person name"
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
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="rounded-xl border border-sidebar-border/70 bg-card">
                    {contacts.length === 0 ? (
                        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                            No people yet. Add your brothers first.
                        </div>
                    ) : (
                        <div className="overflow-x-auto overflow-y-visible">
                            <table className="w-full min-w-[980px] border-separate border-spacing-0 text-sm">
                                <thead>
                                    <tr className="border-b border-sidebar-border/70 text-left font-medium">
                                        <th className="sticky top-0 z-20 w-16 bg-muted/40 px-4 py-3 text-muted-foreground backdrop-blur supports-backdrop-filter:bg-muted/30">
                                            SL
                                        </th>
                                        <th className="sticky top-0 z-20 bg-muted/40 px-4 py-3 text-muted-foreground backdrop-blur supports-backdrop-filter:bg-muted/30">
                                            Name
                                        </th>
                                        <th className="sticky top-0 z-20 w-44 bg-muted/40 px-4 py-3 text-right text-muted-foreground backdrop-blur supports-backdrop-filter:bg-muted/30">
                                            Income
                                        </th>
                                        <th className="sticky top-0 z-20 w-52 bg-muted/40 px-4 py-3 text-right text-muted-foreground backdrop-blur supports-backdrop-filter:bg-muted/30">
                                            Outstanding
                                        </th>
                                        <th className="sticky top-0 z-20 w-44 bg-muted/40 px-4 py-3 text-right text-muted-foreground backdrop-blur supports-backdrop-filter:bg-muted/30">
                                            Net (AR − AP)
                                        </th>
                                        <th className="sticky top-0 z-20 w-28 bg-muted/40 px-4 py-3 text-right text-muted-foreground backdrop-blur supports-backdrop-filter:bg-muted/30">
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
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            aria-label="Edit person"
                                                            onClick={() =>
                                                                openEdit(c)
                                                            }
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
                                                                    linked to
                                                                    this person
                                                                    keep their
                                                                    record. This
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
                                                                                c.id,
                                                                        },
                                                                    ),
                                                                    {
                                                                        preserveScroll: true,
                                                                    },
                                                                )
                                                            }
                                                            trigger={
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    aria-label="Delete person"
                                                                    className="text-destructive hover:text-destructive"
                                                                >
                                                                    <Trash2 className="size-4" />
                                                                </Button>
                                                            }
                                                        />
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

                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit person</DialogTitle>
                            <DialogDescription>
                                Update the name.
                            </DialogDescription>
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
                                            <Label htmlFor="edit_name">
                                                Name
                                            </Label>
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
