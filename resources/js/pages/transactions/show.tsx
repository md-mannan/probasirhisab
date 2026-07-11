import { Head, Link, router, useForm } from '@inertiajs/react';
import { ArrowLeft, Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { destroy as transactionsDestroy, update as transactionsUpdate, index as transactionsIndex } from '@/routes/transactions';
import * as settlementRoutes from '@/routes/transactions/settlements';

type Props = {
    types: Record<string, string>;
    primaryCurrency: string;
    secondaryCurrency: string;
    primaryDecimals: number;
    secondaryDecimals: number;
    contacts: Array<{ id: number; name: string }>;
    categoriesByType: Record<string, Array<{ id: number; name: string; type: string }>>;
    settlementCategories: Array<{ id: number; name: string; type: string }>;
    defaultSettlementCategoryId: number | null;
    transaction: {
        id: number;
        type: string;
        amount: string;
        settled_amount: string | null;
        settlement_status: 'unsettled' | 'partial' | 'settled' | null;
        currency: string;
        secondary_amount: string | null;
        secondary_currency: string | null;
        rate: string | null;
        source: string | null;
        occurred_on: string;
        note: string | null;
        contacts: Array<{ id: number; name: string }>;
        category: { id: number; name: string; type: string } | null;
    };
    settlements: Array<{
        id: number;
        amount: string;
        paid_on: string;
        source: string | null;
        note: string | null;
        category: { id: number; name: string; type: string } | null;
    }>;
};

export default function TransactionShow({
    types,
    primaryCurrency,
    secondaryCurrency,
    primaryDecimals,
    secondaryDecimals,
    categoriesByType,
    settlementCategories,
    defaultSettlementCategoryId,
    transaction,
    settlements,
}: Props) {
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

    const formatRate = (rate: string | null) => {
        const n = Number(rate);

        if (!Number.isFinite(n)) {
return '—';
}

        return formatFixed(n, secondaryDecimals);
    };

    const statusLabel = (status: Props['transaction']['settlement_status']) => {
        if (status === 'unsettled') {
return 'Unsettled';
}

        if (status === 'partial') {
return 'Partial';
}

        if (status === 'settled') {
return 'Settled';
}

        return '—';
    };

    const isSettleable = transaction.type === 'payable' || transaction.type === 'receivable';
    const isSimple = transaction.type === 'income' || transaction.type === 'expense';
    const total = Math.abs(Number(transaction.amount));
    const settled = Number(transaction.settled_amount ?? 0);
    const remaining = Math.max(0, total - settled);
    const isFullySettled = isSettleable && remaining <= 0.0000001;
    const hasFx = Boolean(transaction.rate && transaction.secondary_currency);
    const directionForType = (type: string) => {
        if (type === 'expense' || type === 'payable') {
return -1;
}

        return 1;
    };

    const settlementSectionRef = useRef<HTMLDivElement | null>(null);
    const [settleModalOpen, setSettleModalOpen] = useState(false);
    const [editSettlementOpen, setEditSettlementOpen] = useState(false);
    const [editSettlementId, setEditSettlementId] = useState<number | null>(null);
    const [viewSettlement, setViewSettlement] = useState<
        Props['settlements'][number] | null
    >(null);
    const [editTxOpen, setEditTxOpen] = useState(false);

    const editTxForm = useForm({
        type: transaction.type,
        category_id: transaction.category?.id ? String(transaction.category.id) : '',
        primary_amount: transaction.amount ?? '',
        secondary_amount: transaction.secondary_amount ?? '',
        rate: transaction.rate ?? '',
        occurred_on: transaction.occurred_on,
        source: transaction.source ?? '',
        note: transaction.note ?? '',
        settled_amount: transaction.settled_amount ?? '',
    });

    const editCategories = categoriesByType[editTxForm.data.type] ?? [];

    const settlementForm = useForm({
        amount: '',
        paid_on: new Date().toISOString().slice(0, 10),
        category_id:
            defaultSettlementCategoryId !== null
                ? String(defaultSettlementCategoryId)
                : (settlementCategories[0]?.id ? String(settlementCategories[0].id) : ''),
        source: '',
        note: '',
    });

    const editSettlementForm = useForm({
        amount: '',
        paid_on: new Date().toISOString().slice(0, 10),
        category_id:
            defaultSettlementCategoryId !== null
                ? String(defaultSettlementCategoryId)
                : (settlementCategories[0]?.id ? String(settlementCategories[0].id) : ''),
        source: '',
        note: '',
    });

    const openViewSettlement = (s: Props['settlements'][number]) => {
        setViewSettlement(s);
    };

    const openEditSettlement = (s: Props['settlements'][number]) => {
        setEditSettlementId(s.id);
        editSettlementForm.setData({
            amount: s.amount ?? '',
            paid_on: s.paid_on ?? new Date().toISOString().slice(0, 10),
            category_id: s.category?.id ? String(s.category.id) : editSettlementForm.data.category_id,
            source: s.source ?? '',
            note: s.note ?? '',
        });
        editSettlementForm.clearErrors();
        setEditSettlementOpen(true);
    };

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const editId = params.get('edit_settlement');

        if (!editId) {
return;
}

        const id = Number(editId);

        if (!Number.isFinite(id)) {
return;
}

        const s = settlements.find((x) => x.id === id);

        if (!s) {
return;
}

        openEditSettlement(s);

        params.delete('edit_settlement');
        const next = params.toString();
        const url = next ? `${window.location.pathname}?${next}` : window.location.pathname;
        window.history.replaceState({}, '', url);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const settlementAmountNumber = Number(settlementForm.data.amount);
    const settlementExceedsRemaining =
        Number.isFinite(settlementAmountNumber) &&
        settlementForm.data.amount !== '' &&
        settlementAmountNumber > remaining + 0.0000001;

    const settlementSecondaryAmount = (() => {
        const amt = Number(settlementForm.data.amount);
        const r = Number(transaction.rate);

        if (!Number.isFinite(amt) || !Number.isFinite(r) || r <= 0) {
return null;
}

        return amt * r;
    })();

    const settlementBadgeClass = (status: Props['transaction']['settlement_status']) => {
        if (status === 'settled') {
            return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
        }

        if (status === 'partial') {
            return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
        }

        if (status === 'unsettled') {
            return 'bg-muted text-muted-foreground';
        }

        return 'bg-muted text-muted-foreground';
    };

    return (
        <>
            <Head title="Transaction" />

            <div className="space-y-4 py-4 pb-6 sm:py-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-lg font-semibold">
                            Transaction Details
                        </h1>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button variant="outline" size="sm" asChild>
                            <Link href={transactionsIndex()}>
                                <ArrowLeft className="mr-2 size-4" />
                                Return
                            </Link>
                        </Button>
                        {isSettleable && (
                            <>
                                <Button
                                    variant={isFullySettled ? 'outline' : 'secondary'}
                                    size="sm"
                                    type="button"
                                    onClick={() => {
                                        if (isFullySettled) {
return;
}

                                        setSettleModalOpen(true);
                                    }}
                                    disabled={isFullySettled}
                                    className={
                                        isFullySettled
                                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-300'
                                            : undefined
                                    }
                                >
                                    {isFullySettled ? (
                                        <>
                                            Settled
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="mr-2 size-4" />
                                            Settle
                                        </>
                                    )}
                                </Button>

                                <Dialog
                                    open={settleModalOpen}
                                    onOpenChange={setSettleModalOpen}
                                >
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Add settlement payment</DialogTitle>
                                            <DialogDescription>
                                                Record a payment for this{' '}
                                                {types[transaction.type] ??
                                                    transaction.type}{' '}
                                                transaction.
                                            </DialogDescription>
                                        </DialogHeader>

                                        <form
                                            className="grid gap-4"
                                            onSubmit={(e) => {
                                                e.preventDefault();
                                                settlementForm.post(
                                                    settlementRoutes.store.url({
                                                        transaction: transaction.id,
                                                    }),
                                                    {
                                                        preserveScroll: true,
                                                        onSuccess: () => {
                                                            settlementForm.reset(
                                                                'amount',
                                                                'note',
                                                            );
                                                            setSettleModalOpen(false);
                                                        },
                                                    },
                                                );
                                            }}
                                        >
                                            <div className="grid gap-2">
                                                <Label htmlFor="settlement_category_id">
                                                    Category
                                                </Label>
                                                <input
                                                    type="hidden"
                                                    name="category_id"
                                                    value={settlementForm.data.category_id}
                                                />
                                                <Select
                                                    value={settlementForm.data.category_id}
                                                    onValueChange={(v) =>
                                                        settlementForm.setData('category_id', v)
                                                    }
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="Select category" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {settlementCategories.map((c) => (
                                                            <SelectItem
                                                                key={c.id}
                                                                value={String(c.id)}
                                                            >
                                                                {c.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <InputError
                                                    message={settlementForm.errors.category_id}
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="settlement_amount">
                                                    Payment amount
                                                </Label>
                                                <Input
                                                    id="settlement_amount"
                                                    name="amount"
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={settlementForm.data.amount}
                                                    onChange={(e) => {
                                                        const next = e.target.value;
                                                        settlementForm.setData('amount', next);

                                                        const n = Number(next);

                                                        if (
                                                            next !== '' &&
                                                            Number.isFinite(n) &&
                                                            n > remaining + 0.0000001
                                                        ) {
                                                            settlementForm.setError(
                                                                'amount',
                                                                `Amount cannot be greater than remaining (${formatFixed(
                                                                    remaining,
                                                                    primaryDecimals,
                                                                )} ${transaction.currency}).`,
                                                            );
                                                        } else {
                                                            settlementForm.clearErrors('amount');
                                                        }
                                                    }}
                                                    placeholder={formatFixed(
                                                        0,
                                                        primaryDecimals,
                                                    )}
                                                />
                                                <div className="text-xs text-muted-foreground">
                                                    {transaction.rate && settlementSecondaryAmount !== null
                                                        ? `≈ ${formatFixed(settlementSecondaryAmount, secondaryDecimals)} ${secondaryCurrency}`
                                                        : `Secondary: —`}
                                                </div>
                                                <InputError
                                                    message={settlementForm.errors.amount}
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="settlement_paid_on">
                                                    Paid on
                                                </Label>
                                                <Input
                                                    id="settlement_paid_on"
                                                    name="paid_on"
                                                    type="date"
                                                    value={settlementForm.data.paid_on}
                                                    onChange={(e) =>
                                                        settlementForm.setData(
                                                            'paid_on',
                                                            e.target.value,
                                                        )
                                                    }
                                                />
                                                <InputError
                                                    message={settlementForm.errors.paid_on}
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="settlement_source">
                                                    Source (optional)
                                                </Label>
                                                <Input
                                                    id="settlement_source"
                                                    name="source"
                                                    value={settlementForm.data.source}
                                                    onChange={(e) =>
                                                        settlementForm.setData('source', e.target.value)
                                                    }
                                                    placeholder="e.g. Cash, Bank, bKash"
                                                />
                                                <InputError message={settlementForm.errors.source} />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="settlement_note">
                                                    Note (optional)
                                                </Label>
                                                <Input
                                                    id="settlement_note"
                                                    name="note"
                                                    value={settlementForm.data.note}
                                                    onChange={(e) =>
                                                        settlementForm.setData(
                                                            'note',
                                                            e.target.value,
                                                        )
                                                    }
                                                    placeholder="e.g. Part payment"
                                                />
                                                <InputError
                                                    message={settlementForm.errors.note}
                                                />
                                            </div>

                                            <DialogFooter>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() =>
                                                        setSettleModalOpen(false)
                                                    }
                                                    disabled={settlementForm.processing}
                                                >
                                                    Cancel
                                                </Button>
                                                <Button
                                                    type="submit"
                                                    disabled={
                                                        settlementForm.processing ||
                                                        settlementExceedsRemaining
                                                    }
                                                >
                                                    <Plus className="mr-2 size-4" />
                                                    Add payment
                                                </Button>
                                            </DialogFooter>
                                        </form>
                                    </DialogContent>
                                </Dialog>

                                <Dialog open={editSettlementOpen} onOpenChange={setEditSettlementOpen}>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Edit settlement payment</DialogTitle>
                                            <DialogDescription>
                                                Update this settlement entry.
                                            </DialogDescription>
                                        </DialogHeader>

                                        <form
                                            className="grid gap-4"
                                            onSubmit={(e) => {
                                                e.preventDefault();

                                                if (editSettlementId === null) {
return;
}

                                                editSettlementForm.patch(
                                                    `/transactions/${transaction.id}/settlements/${editSettlementId}`,
                                                    {
                                                        preserveScroll: true,
                                                        onSuccess: () => {
                                                            setEditSettlementOpen(false);
                                                        },
                                                    },
                                                );
                                            }}
                                        >
                                            <div className="grid gap-2">
                                                <Label htmlFor="edit_settlement_category_id">
                                                    Category
                                                </Label>
                                                <input
                                                    type="hidden"
                                                    name="category_id"
                                                    value={editSettlementForm.data.category_id}
                                                />
                                                <Select
                                                    value={editSettlementForm.data.category_id}
                                                    onValueChange={(v) =>
                                                        editSettlementForm.setData('category_id', v)
                                                    }
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="Select category" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {settlementCategories.map((c) => (
                                                            <SelectItem key={c.id} value={String(c.id)}>
                                                                {c.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <InputError message={editSettlementForm.errors.category_id} />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="edit_settlement_amount">
                                                    Payment amount
                                                </Label>
                                                <Input
                                                    id="edit_settlement_amount"
                                                    name="amount"
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={editSettlementForm.data.amount}
                                                    onChange={(e) =>
                                                        editSettlementForm.setData('amount', e.target.value)
                                                    }
                                                />
                                                <InputError message={editSettlementForm.errors.amount} />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="edit_settlement_paid_on">
                                                    Paid on
                                                </Label>
                                                <Input
                                                    id="edit_settlement_paid_on"
                                                    name="paid_on"
                                                    type="date"
                                                    value={editSettlementForm.data.paid_on}
                                                    onChange={(e) =>
                                                        editSettlementForm.setData('paid_on', e.target.value)
                                                    }
                                                />
                                                <InputError message={editSettlementForm.errors.paid_on} />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="edit_settlement_source">
                                                    Source (optional)
                                                </Label>
                                                <Input
                                                    id="edit_settlement_source"
                                                    name="source"
                                                    value={editSettlementForm.data.source}
                                                    onChange={(e) =>
                                                        editSettlementForm.setData('source', e.target.value)
                                                    }
                                                    placeholder="e.g. Cash, Bank, bKash"
                                                />
                                                <InputError message={editSettlementForm.errors.source} />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="edit_settlement_note">
                                                    Note (optional)
                                                </Label>
                                                <Input
                                                    id="edit_settlement_note"
                                                    name="note"
                                                    value={editSettlementForm.data.note}
                                                    onChange={(e) =>
                                                        editSettlementForm.setData('note', e.target.value)
                                                    }
                                                    placeholder="e.g. Part payment"
                                                />
                                                <InputError message={editSettlementForm.errors.note} />
                                            </div>

                                            <DialogFooter>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => setEditSettlementOpen(false)}
                                                    disabled={editSettlementForm.processing}
                                                >
                                                    Cancel
                                                </Button>
                                                <Button type="submit" disabled={editSettlementForm.processing}>
                                                    <Pencil className="mr-2 size-4" />
                                                    Update
                                                </Button>
                                            </DialogFooter>
                                        </form>
                                    </DialogContent>
                                </Dialog>

                                <Dialog
                                    open={viewSettlement !== null}
                                    onOpenChange={(open) => {
                                        if (!open) {
                                            setViewSettlement(null);
                                        }
                                    }}
                                >
                                    <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg">
                                        <DialogHeader>
                                            <DialogTitle>Payment details</DialogTitle>
                                            <DialogDescription>
                                                Settlement line for this transaction (read-only).
                                            </DialogDescription>
                                        </DialogHeader>
                                        {viewSettlement && (
                                            <div className="grid gap-3 text-sm">
                                                <div className="overflow-hidden rounded-lg border border-sidebar-border/70">
                                                    <div className="grid grid-cols-[minmax(0,7.5rem)_1fr] gap-x-3 border-b border-sidebar-border/70 px-3 py-2 text-sm last:border-b-0">
                                                        <div className="text-xs text-muted-foreground">
                                                            Date
                                                        </div>
                                                        <div className="min-w-0 tabular-nums font-normal">
                                                            {formatDateDMY(viewSettlement.paid_on)}
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-[minmax(0,7.5rem)_1fr] gap-x-3 border-b border-sidebar-border/70 px-3 py-2 text-sm last:border-b-0">
                                                        <div className="text-xs text-muted-foreground">
                                                            Category
                                                        </div>
                                                        <div className="min-w-0 font-normal">
                                                            {viewSettlement.category?.name ?? (
                                                                <span className="text-muted-foreground">
                                                                    —
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-[minmax(0,7.5rem)_1fr] gap-x-3 border-b border-sidebar-border/70 px-3 py-2 text-sm last:border-b-0">
                                                        <div className="text-xs text-muted-foreground">
                                                            Amount
                                                        </div>
                                                        <div className="min-w-0 tabular-nums font-normal">
                                                            {formatFixed(
                                                                Number(viewSettlement.amount),
                                                                primaryDecimals,
                                                            )}{' '}
                                                            {transaction.currency}
                                                        </div>
                                                    </div>
                                                    {transaction.rate && (
                                                        <div className="grid grid-cols-[minmax(0,7.5rem)_1fr] gap-x-3 border-b border-sidebar-border/70 px-3 py-2 text-sm last:border-b-0">
                                                            <div className="text-xs text-muted-foreground">
                                                                Secondary
                                                            </div>
                                                            <div className="min-w-0 tabular-nums text-muted-foreground">
                                                                {formatFixed(
                                                                    Number(viewSettlement.amount) *
                                                                        Number(transaction.rate),
                                                                    secondaryDecimals,
                                                                )}{' '}
                                                                {secondaryCurrency}
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="grid grid-cols-[minmax(0,7.5rem)_1fr] gap-x-3 border-b border-sidebar-border/70 px-3 py-2 text-sm last:border-b-0">
                                                        <div className="text-xs text-muted-foreground">
                                                            Source
                                                        </div>
                                                        <div className="min-w-0 whitespace-pre-wrap wrap-break-word font-normal">
                                                            {viewSettlement.source?.trim()
                                                                ? viewSettlement.source
                                                                : '—'}
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-[minmax(0,7.5rem)_1fr] gap-x-3 px-3 py-2 text-sm">
                                                        <div className="text-xs text-muted-foreground">
                                                            Note
                                                        </div>
                                                        <div className="min-w-0 whitespace-pre-wrap wrap-break-word font-normal">
                                                            {viewSettlement.note?.trim()
                                                                ? viewSettlement.note
                                                                : '—'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <DialogFooter className="gap-3 sm:gap-3">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => setViewSettlement(null)}
                                            >
                                                Close
                                            </Button>
                                            {viewSettlement && (
                                                <Button
                                                    type="button"
                                                    onClick={() => {
                                                        const s = viewSettlement;
                                                        setViewSettlement(null);
                                                        openEditSettlement(s);
                                                    }}
                                                >
                                                    <Pencil className="mr-2 size-4" />
                                                    Edit
                                                </Button>
                                            )}
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </>
                        )}
                        <Button variant="secondary" size="sm" asChild>
                            <button
                                type="button"
                                onClick={() => {
                                    editTxForm.setData({
                                        type: transaction.type,
                                        category_id: transaction.category?.id ? String(transaction.category.id) : '',
                                        primary_amount: transaction.amount ?? '',
                                        secondary_amount: transaction.secondary_amount ?? '',
                                        rate: transaction.rate ?? '',
                                        occurred_on: transaction.occurred_on,
                                        source: transaction.source ?? '',
                                        note: transaction.note ?? '',
                                        settled_amount: transaction.settled_amount ?? '',
                                    });
                                    editTxForm.clearErrors();
                                    setEditTxOpen(true);
                                }}
                            >
                                <Pencil className="mr-2 size-4" />
                                Edit Transaction
                            </button>
                        </Button>

                        <Dialog open={editTxOpen} onOpenChange={setEditTxOpen}>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Edit transaction</DialogTitle>
                                    <DialogDescription>Update fields and save</DialogDescription>
                                </DialogHeader>

                                <form
                                    className="grid gap-4"
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        editTxForm.patch(
                                            transactionsUpdate.url({ transaction: transaction.id }),
                                            {
                                                preserveScroll: true,
                                                onSuccess: () => setEditTxOpen(false),
                                            },
                                        );
                                    }}
                                >
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="grid gap-2 md:col-span-2">
                                            <Label htmlFor="edit_tx_type">Type</Label>
                                            <input type="hidden" name="type" value={editTxForm.data.type} />
                                            <Select
                                                value={editTxForm.data.type}
                                                onValueChange={(v) => {
                                                    editTxForm.setData('type', v);
                                                    const nextCats = categoriesByType[v] ?? [];

                                                    if (nextCats.length > 0) {
                                                        editTxForm.setData('category_id', String(nextCats[0].id));
                                                    } else {
                                                        editTxForm.setData('category_id', '');
                                                    }
                                                }}
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Select type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Object.entries(types).map(([value, label]) => (
                                                        <SelectItem key={value} value={value}>
                                                            {label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <InputError message={editTxForm.errors.type} />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="edit_tx_occurred_on">Date</Label>
                                            <Input
                                                id="edit_tx_occurred_on"
                                                name="occurred_on"
                                                type="date"
                                                value={editTxForm.data.occurred_on}
                                                onChange={(e) => editTxForm.setData('occurred_on', e.target.value)}
                                            />
                                            <InputError message={editTxForm.errors.occurred_on} />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="edit_tx_category_id">Category</Label>
                                            <input type="hidden" name="category_id" value={editTxForm.data.category_id} />
                                            <Select
                                                value={editTxForm.data.category_id}
                                                onValueChange={(v) => editTxForm.setData('category_id', v)}
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Select category" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {editCategories.map((c) => (
                                                        <SelectItem key={c.id} value={String(c.id)}>
                                                            {c.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <InputError message={editTxForm.errors.category_id} />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="edit_tx_primary_amount">
                                                Primary amount ({primaryCurrency})
                                            </Label>
                                            <Input
                                                id="edit_tx_primary_amount"
                                                name="primary_amount"
                                                type="text"
                                                inputMode="decimal"
                                                value={editTxForm.data.primary_amount}
                                                onChange={(e) => editTxForm.setData('primary_amount', e.target.value)}
                                            />
                                            <InputError message={editTxForm.errors.primary_amount} />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="edit_tx_secondary_amount">
                                                Secondary amount ({secondaryCurrency})
                                            </Label>
                                            <Input
                                                id="edit_tx_secondary_amount"
                                                name="secondary_amount"
                                                type="text"
                                                inputMode="decimal"
                                                value={editTxForm.data.secondary_amount ?? ''}
                                                onChange={(e) => editTxForm.setData('secondary_amount', e.target.value)}
                                            />
                                            <InputError message={editTxForm.errors.secondary_amount} />
                                        </div>

                                        <div className="grid gap-2 md:col-span-2">
                                            <Label htmlFor="edit_tx_rate">
                                                Rate (1 {primaryCurrency} = ? {secondaryCurrency})
                                            </Label>
                                            <Input
                                                id="edit_tx_rate"
                                                name="rate"
                                                type="text"
                                                inputMode="decimal"
                                                value={editTxForm.data.rate ?? ''}
                                                onChange={(e) => editTxForm.setData('rate', e.target.value)}
                                            />
                                            <InputError message={editTxForm.errors.rate} />
                                        </div>

                                        {(editTxForm.data.type === 'payable' ||
                                            editTxForm.data.type === 'receivable') && (
                                            <div className="grid gap-2 md:col-span-2">
                                                <Label htmlFor="edit_tx_settled_amount">
                                                    Settled amount (optional)
                                                </Label>
                                                <Input
                                                    id="edit_tx_settled_amount"
                                                    name="settled_amount"
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={editTxForm.data.settled_amount ?? ''}
                                                    onChange={(e) => editTxForm.setData('settled_amount', e.target.value)}
                                                />
                                                <InputError message={editTxForm.errors.settled_amount} />
                                            </div>
                                        )}

                                        <div className="grid gap-2 md:col-span-2">
                                            <Label htmlFor="edit_tx_source">Source (optional)</Label>
                                            <Input
                                                id="edit_tx_source"
                                                name="source"
                                                value={editTxForm.data.source ?? ''}
                                                onChange={(e) => editTxForm.setData('source', e.target.value)}
                                                placeholder="e.g. Cash, Bank, bKash"
                                            />
                                            <InputError message={editTxForm.errors.source} />
                                        </div>

                                        <div className="grid gap-2 md:col-span-2">
                                            <Label htmlFor="edit_tx_note">Note (optional)</Label>
                                            <Textarea
                                                id="edit_tx_note"
                                                name="note"
                                                rows={3}
                                                className="resize-y"
                                                value={editTxForm.data.note ?? ''}
                                                onChange={(e) => editTxForm.setData('note', e.target.value)}
                                                placeholder="Write details..."
                                            />
                                            <InputError message={editTxForm.errors.note} />
                                        </div>
                                    </div>

                                    <DialogFooter>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setEditTxOpen(false)}
                                            disabled={editTxForm.processing}
                                        >
                                            Cancel
                                        </Button>
                                        <Button type="submit" disabled={editTxForm.processing}>
                                            <Pencil className="mr-2 size-4" />
                                            Update
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                        <ConfirmDeleteDialog
                            title="Delete transaction?"
                            description="This permanently removes the transaction and its ledger entries. This cannot be undone."
                            confirmLabel="Delete transaction"
                            onConfirm={() =>
                                router.delete(
                                    transactionsDestroy.url({
                                        transaction: transaction.id,
                                    }),
                                )
                            }
                            trigger={
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                >
                                    <Trash2 className="mr-2 size-4" />
                                    Delete Transaction
                                </Button>
                            }
                        />
                    </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="space-y-4 min-w-0">
                        {isSimple ? (
                    <Card>
                        <CardHeader className="space-y-1">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div className="space-y-1">
                                    <CardTitle className="text-base">
                                        {types[transaction.type] ??
                                            transaction.type}
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                            #{transaction.id} • {formatDateDMY(transaction.occurred_on)}
                                        {transaction.contacts.length > 0
                                            ? ` • ${transaction.contacts
                                                  .map((c) => c.name)
                                                  .join(', ')}`
                                            : ''}
                                    </CardDescription>
                                </div>
                                <div className="text-right">
                                    <div
                                        className={
                                            directionForType(transaction.type) < 0
                                                ? 'text-xl font-semibold tabular-nums text-destructive'
                                                : 'text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400'
                                        }
                                    >
                                        {directionForType(transaction.type) < 0 ? '- ' : '+ '}
                                        {formatFixed(
                                            Math.abs(Number(transaction.amount)),
                                            primaryDecimals,
                                        )}{' '}
                                        <span className="text-base font-medium text-muted-foreground">
                                            {transaction.currency}
                                        </span>
                                    </div>
                                    {transaction.secondary_amount &&
                                        transaction.secondary_currency && (
                                            <div className="mt-0.5 text-xs text-muted-foreground">
                                                ≈{' '}
                                                {formatFixed(
                                                    Number(transaction.secondary_amount),
                                                    secondaryDecimals,
                                                )}{' '}
                                                {transaction.secondary_currency}
                                            </div>
                                        )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="grid gap-3">
                            <div className="overflow-hidden rounded-lg border border-sidebar-border/70">
                                <div className="grid grid-cols-[120px_1fr] text-sm">
                                    <div className="border-b border-sidebar-border/70 bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground">
                                        Date
                                    </div>
                                    <div className="border-b border-sidebar-border/70 px-3 py-2 font-medium tabular-nums">
                                        {formatDateDMY(transaction.occurred_on)}
                                    </div>

                                    <div className="border-b border-sidebar-border/70 bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground">
                                        Category
                                    </div>
                                    <div className="border-b border-sidebar-border/70 px-3 py-2 font-medium">
                                        {transaction.category?.name ?? '—'}
                                    </div>

                                    <div className="border-b border-sidebar-border/70 bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground">
                                        Source
                                    </div>
                                    <div className="border-b border-sidebar-border/70 px-3 py-2 font-medium">
                                        {transaction.source ?? '—'}
                                    </div>

                                    <div className="bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground">
                                        FX
                                    </div>
                                    <div className="px-3 py-2 font-medium tabular-nums">
                                        {hasFx
                                            ? `1 ${primaryCurrency} = ${formatRate(
                                                  transaction.rate,
                                              )} ${secondaryCurrency}`
                                            : '—'}
                                    </div>
                                </div>
                            </div>

                            {transaction.note && (
                                <div className="overflow-hidden rounded-lg border border-sidebar-border/70">
                                    <div className="grid grid-cols-[110px_1fr] text-sm">
                                        <div className="bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground">
                                            Note
                                        </div>
                                        <div className="px-3 py-2 text-sm leading-6 whitespace-pre-wrap wrap-break-word text-foreground">
                                            {transaction.note}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                        ) : (
                    <Card>
                        <CardHeader className="space-y-1">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <CardTitle className="text-base">
                                            {types[transaction.type] ??
                                                transaction.type}
                                        </CardTitle>
                                        {transaction.settlement_status && (
                                            <span
                                                className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${settlementBadgeClass(
                                                    transaction.settlement_status,
                                                )}`}
                                            >
                                                {statusLabel(
                                                    transaction.settlement_status,
                                                )}
                                            </span>
                                        )}
                                    </div>
                                    <CardDescription className="text-xs">
                            #{transaction.id} • {formatDateDMY(transaction.occurred_on)}
                                        {transaction.contacts.length > 0
                                            ? ` • ${transaction.contacts
                                                  .map((c) => c.name)
                                                  .join(', ')}`
                                            : ''}
                                    </CardDescription>
                                </div>

                                <div className="shrink-0 text-right">
                                    <div className="text-[11px] text-muted-foreground">
                                        Amount
                                    </div>
                                    <div className="text-xl font-semibold tabular-nums">
                                        {formatFixed(
                                            Math.abs(
                                                Number(transaction.amount),
                                            ),
                                            primaryDecimals,
                                        )}{' '}
                                        {transaction.currency}
                                    </div>
                                    {transaction.secondary_amount &&
                                        transaction.secondary_currency && (
                                            <div className="text-xs text-muted-foreground">
                                                ≈{' '}
                                                {formatFixed(
                                                    Number(
                                                        transaction.secondary_amount,
                                                    ),
                                                    secondaryDecimals,
                                                )}{' '}
                                                {transaction.secondary_currency}
                                            </div>
                                        )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="grid gap-3">
                            <div className="overflow-hidden rounded-lg border border-sidebar-border/70">
                                <div className="grid grid-cols-[120px_1fr] text-sm">
                                    <div className="border-b border-sidebar-border/70 bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground">
                                        Date
                                    </div>
                                    <div className="border-b border-sidebar-border/70 px-3 py-2 font-medium tabular-nums">
                                        {formatDateDMY(transaction.occurred_on)}
                                    </div>

                                    <div className="border-b border-sidebar-border/70 bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground">
                                        Category
                                    </div>
                                    <div className="border-b border-sidebar-border/70 px-3 py-2 font-medium">
                                        {transaction.category?.name ?? '—'}
                                    </div>

                                    <div className="border-b border-sidebar-border/70 bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground">
                                        Source
                                    </div>
                                    <div className="border-b border-sidebar-border/70 px-3 py-2 font-medium">
                                        {transaction.source ?? '—'}
                                    </div>

                                    <div className="bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground">
                                        FX
                                    </div>
                                    <div className="px-3 py-2 font-medium tabular-nums">
                                        {hasFx
                                            ? `1 ${primaryCurrency} = ${formatRate(
                                                  transaction.rate,
                                              )} ${secondaryCurrency}`
                                            : '—'}
                                    </div>
                                </div>
                            </div>

                            {transaction.note && (
                                <div className="overflow-hidden rounded-lg border border-sidebar-border/70">
                                    <div className="grid grid-cols-[110px_1fr] text-sm">
                                        <div className="bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground">
                                            Note
                                        </div>
                                        <div className="px-3 py-2 text-sm leading-6 whitespace-pre-wrap wrap-break-word text-foreground">
                                            {transaction.note}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                        )}
                    </div>

                    <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
                        {isSettleable ? (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Settlement</CardTitle>
                                    <CardDescription>
                                        Current position (auto-updated).
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="grid gap-3">
                                    <div className="grid gap-2 rounded-lg border border-sidebar-border/70 bg-muted/10 p-3">
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="text-muted-foreground">
                                                Total
                                            </span>
                                            <span className="font-medium tabular-nums">
                                                {formatFixed(
                                                    total,
                                                    primaryDecimals,
                                                )}{' '}
                                                {transaction.currency}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="text-muted-foreground">
                                                Settled
                                            </span>
                                            <span className="font-medium tabular-nums">
                                                {formatFixed(
                                                    settled,
                                                    primaryDecimals,
                                                )}{' '}
                                                {transaction.currency}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="text-muted-foreground">
                                                Remaining
                                            </span>
                                            <span className="font-medium tabular-nums">
                                                {formatFixed(
                                                    remaining,
                                                    primaryDecimals,
                                                )}{' '}
                                                {transaction.currency}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                        <div
                                            className={
                                                remaining <= 0
                                                    ? 'h-full bg-emerald-500'
                                                    : settled > 0
                                                      ? 'h-full bg-amber-500'
                                                      : 'h-full bg-muted-foreground/30'
                                            }
                                            style={{
                                                width: `${Math.round(
                                                    total > 0
                                                        ? (settled / total) *
                                                              100
                                                        : 0,
                                                )}%`,
                                            }}
                                        />
                                    </div>

                                    <div className="text-xs text-muted-foreground tabular-nums">
                                        {formatFixed(
                                            Math.max(
                                                0,
                                                Math.min(total, settled),
                                            ),
                                            primaryDecimals,
                                        )}{' '}
                                        / {formatFixed(total, primaryDecimals)}{' '}
                                        {transaction.currency}
                                    </div>
                                </CardContent>
                            </Card>
                        ) : null}
                    </div>
                </div>

                {isSettleable && (
                    <Card className="min-w-0 overflow-hidden">
                        <CardHeader>
                            <CardTitle>Settlement history</CardTitle>
                            <CardDescription>
                                Payments recorded for this transaction.
                            </CardDescription>
                        </CardHeader>
                        <CardContent
                            className="grid min-w-0 gap-3"
                            ref={settlementSectionRef}
                        >
                            {settlements.length === 0 ? (
                                <div className="text-sm text-muted-foreground">
                                    No payments added yet.
                                </div>
                            ) : (
                                <div className="min-w-0 space-y-2">
                                    <div className="grid gap-2 sm:hidden">
                                        {settlements.map((s) => (
                                            <div
                                                key={s.id}
                                                className="rounded-lg border border-sidebar-border/70 bg-muted/10 p-3"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="text-xs text-muted-foreground">
                                                            Date
                                                        </div>
                                                        <div className="font-medium tabular-nums">
                                                            {formatDateDMY(s.paid_on)}
                                                        </div>
                                                        <div className="mt-1 text-xs text-muted-foreground">
                                                            Note
                                                        </div>
                                                        <div className="truncate text-sm">
                                                            {s.note ?? '—'}
                                                        </div>
                                                    </div>
                                                    <div className="shrink-0 text-right">
                                                        <div className="text-xs text-muted-foreground">
                                                            Amount
                                                        </div>
                                                        <div className="font-semibold tabular-nums">
                                                            {formatFixed(
                                                                Number(s.amount),
                                                                primaryDecimals,
                                                            )}{' '}
                                                            {transaction.currency}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground tabular-nums">
                                                            {transaction.rate
                                                                ? `≈ ${formatFixed(
                                                                      Number(s.amount) *
                                                                          Number(transaction.rate),
                                                                      secondaryDecimals,
                                                                  )} ${secondaryCurrency}`
                                                                : '—'}
                                                        </div>
                                                        <div className="mt-1 inline-flex items-center justify-end gap-1 whitespace-nowrap">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                aria-label="View payment"
                                                                onClick={() => openViewSettlement(s)}
                                                            >
                                                                <Eye className="size-4" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                aria-label="Edit payment"
                                                                onClick={() => openEditSettlement(s)}
                                                            >
                                                                <Pencil className="size-4" />
                                                            </Button>
                                                            <ConfirmDeleteDialog
                                                                title="Delete payment?"
                                                                description="This removes the settlement and updates the settled total. This cannot be undone."
                                                                confirmLabel="Delete payment"
                                                                onConfirm={() =>
                                                                    router.delete(
                                                                        settlementRoutes.destroy.url(
                                                                            {
                                                                                transaction:
                                                                                    transaction.id,
                                                                                settlement:
                                                                                    s.id,
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
                                                                        aria-label="Delete payment"
                                                                        className="text-destructive hover:text-destructive"
                                                                    >
                                                                        <Trash2 className="size-4" />
                                                                    </Button>
                                                                }
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="hidden min-w-0 overflow-x-auto sm:block">
                                        <TooltipProvider delayDuration={150}>
                                            <table className="w-full min-w-[820px] table-fixed border-separate border-spacing-0 text-sm font-normal leading-snug">
                                            <colgroup>
                                                <col className="w-[12%]" />
                                                <col className="w-[17%]" />
                                                <col className="w-[15%]" />
                                                <col className="w-[15%]" />
                                                <col className="min-w-0 w-[27%]" />
                                                <col className="w-[14%]" />
                                            </colgroup>
                                            <thead>
                                                <tr className="border-b border-sidebar-border/70 text-left font-normal">
                                                    <th className="bg-muted/40 px-3 py-2.5 pr-4 text-xs font-normal uppercase tracking-wide text-muted-foreground">
                                                        Date
                                                    </th>
                                                    <th className="border-l border-sidebar-border/50 bg-muted/40 px-3 py-2.5 pl-4 text-xs font-normal uppercase tracking-wide text-muted-foreground">
                                                        Category
                                                    </th>
                                                    <th className="bg-muted/40 px-3 py-2.5 text-right text-xs font-normal uppercase tracking-wide text-muted-foreground">
                                                        Amount
                                                    </th>
                                                    <th className="bg-muted/40 px-3 py-2.5 text-right text-xs font-normal uppercase tracking-wide text-muted-foreground">
                                                        Secondary
                                                    </th>
                                                    <th className="min-w-0 bg-muted/40 px-3 py-2.5 text-xs font-normal uppercase tracking-wide text-muted-foreground">
                                                        Note
                                                    </th>
                                                    <th className="bg-muted/40 px-2 py-2.5 text-right text-xs font-normal uppercase tracking-wide text-muted-foreground">
                                                        Action
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-sidebar-border/60">
                                                {settlements.map((s) => (
                                                    <tr
                                                        key={s.id}
                                                        className="transition-colors hover:bg-muted/25"
                                                    >
                                                        <td className="px-3 py-2.5 pr-4 align-middle text-sm tabular-nums text-foreground/90">
                                                            {formatDateDMY(s.paid_on)}
                                                        </td>
                                                        <td className="border-l border-sidebar-border/50 py-2.5 pl-4 pr-3 align-middle text-sm">
                                                            <div
                                                                className="truncate text-foreground/90"
                                                                title={
                                                                    s.category?.name ?? undefined
                                                                }
                                                            >
                                                                {s.category?.name ?? (
                                                                    <span className="text-muted-foreground">
                                                                        —
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right align-middle text-sm tabular-nums font-normal whitespace-nowrap text-foreground/90">
                                                            {formatFixed(
                                                                Number(s.amount),
                                                                primaryDecimals,
                                                            )}{' '}
                                                            {transaction.currency}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right align-middle text-sm tabular-nums font-normal text-muted-foreground whitespace-nowrap">
                                                            {transaction.rate
                                                                ? `${formatFixed(
                                                                      Number(s.amount) *
                                                                          Number(transaction.rate),
                                                                      secondaryDecimals,
                                                                  )} ${secondaryCurrency}`
                                                                : '—'}
                                                        </td>
                                                        <td className="min-w-0 px-3 py-2.5 align-middle text-sm">
                                                            {s.note ? (
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <div className="min-w-0 cursor-help truncate font-normal text-foreground/90">
                                                                            {s.note}
                                                                        </div>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent
                                                                        side="bottom"
                                                                        align="start"
                                                                        className="max-w-[560px] whitespace-pre-wrap text-left leading-5"
                                                                    >
                                                                        {s.note}
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            ) : (
                                                                <div className="truncate text-muted-foreground">
                                                                    —
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-2 py-2.5 text-right align-middle">
                                                            <div className="inline-flex items-center justify-end gap-0.5 whitespace-nowrap">
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    aria-label="View payment"
                                                                    onClick={() => openViewSettlement(s)}
                                                                >
                                                                    <Eye className="size-4" />
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    aria-label="Edit payment"
                                                                    onClick={() => openEditSettlement(s)}
                                                                >
                                                                    <Pencil className="size-4" />
                                                                </Button>
                                                                <ConfirmDeleteDialog
                                                                    title="Delete payment?"
                                                                    description="This removes the settlement and updates the settled total. This cannot be undone."
                                                                    confirmLabel="Delete payment"
                                                                    onConfirm={() =>
                                                                        router.delete(
                                                                            settlementRoutes.destroy.url(
                                                                                {
                                                                                    transaction:
                                                                                        transaction.id,
                                                                                    settlement:
                                                                                        s.id,
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
                                                                            aria-label="Delete payment"
                                                                            className="text-destructive hover:text-destructive"
                                                                        >
                                                                            <Trash2 className="size-4" />
                                                                        </Button>
                                                                    }
                                                                />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            </table>
                                        </TooltipProvider>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </>
    );
}

TransactionShow.layout = {
    breadcrumbs: [
        {
            title: 'Transactions',
            href: transactionsIndex(),
        },
        {
            title: 'View Transaction',
            href: transactionsIndex(),
        },
    ],
};

