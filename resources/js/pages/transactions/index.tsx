import { Form, Head, Link, router } from '@inertiajs/react';
import {
    Eye,
    GripVertical,
    Loader2,
    Pencil,
    Plus,
    Printer,
    Search,
    Trash2,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { formatFixed } from '@/lib/money';
import {
    directionForType,
    formatDateDMY,
    isObligation,
    settledFor as settledForAmount,
    statusLabel,
    totalFor as totalForAmount,
} from '@/lib/transactions';
import {
    buildTransactionsExportTable,
    downloadTransactionsExcel,
    downloadTransactionsPdf,
    printTransactionsTable,
} from '@/lib/transactions-export';
import { show as contactsShow } from '@/routes/contacts';
import {
    destroy as transactionsDestroy,
    index as transactionsIndex,
    show as transactionsShow,
    store as transactionsStore,
    update as transactionsUpdate,
} from '@/routes/transactions';

type Props = {
    types: Record<string, string>;
    primaryCurrency: string;
    secondaryCurrency: string;
    primaryDecimals: number;
    secondaryDecimals: number;
    defaultRate: string | null;
    categoriesByType: Record<
        string,
        Array<{ id: number; name: string; type: string }>
    >;
    contacts: Array<{ id: number; name: string }>;
    transactions: Array<{
        id: string;
        kind: 'transaction' | 'settlement';
        transaction_id: number;
        settlement_id?: number;
        sort_order: number;
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
    }>;
    /** Net cash (primary currency) from ledger; used to gate spend/lend/settle-payable. */
    primaryCashBalance: number;
    /** List truncation info so the UI can warn instead of silently hiding rows. */
    listMeta?: {
        shown: number;
        total: number;
        limit: number;
        truncated: boolean;
    };
};

/** Paired dialog fields: shared label height + hint/error band so inputs align across columns. */
const TX_FIELD_COL = 'flex min-w-0 flex-col gap-1';
const TX_LABEL_WRAP = 'flex min-h-[1.75rem] flex-col justify-end';

export default function TransactionsIndex({
    types,
    primaryCurrency,
    secondaryCurrency,
    primaryDecimals,
    secondaryDecimals,
    defaultRate,
    categoriesByType,
    contacts,
    transactions,
    primaryCashBalance,
    listMeta,
}: Props) {
    const [orderedTxs, setOrderedTxs] = useState(transactions);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [tableSearch, setTableSearch] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterContact, setFilterContact] = useState<string>('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [exportSelectKey, setExportSelectKey] = useState(0);
    const [exporting, setExporting] = useState(false);

    // Reset the drag-ordered list whenever the server sends a fresh transactions
    // prop (after a reorder patch or any reload). Done during render via the
    // documented "adjust state when a prop changes" pattern instead of an effect,
    // so there is no extra commit/cascading render.
    const [prevTransactions, setPrevTransactions] = useState(transactions);

    if (transactions !== prevTransactions) {
        setPrevTransactions(transactions);
        setOrderedTxs(transactions);
    }

    const persistRowOrder = (ids: string[]) => {
        router.patch(
            '/transactions/reorder-rows',
            { ids },
            {
                preserveScroll: true,
                preserveState: false,
                only: ['transactions'],
            },
        );
    };

    const moveRow = (fromId: string, toId: string) => {
        if (fromId === toId) {
            return;
        }

        const fromIdx = orderedTxs.findIndex((t) => t.id === fromId);
        const toIdx = orderedTxs.findIndex((t) => t.id === toId);

        if (fromIdx < 0 || toIdx < 0) {
            return;
        }

        const next = [...orderedTxs];
        const [item] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, item);
        setOrderedTxs(next);
        persistRowOrder(next.map((t) => t.id));
    };
    const CONTACT_NONE = '__none__';
    const typeEntries = useMemo(() => Object.entries(types), [types]);

    // Keep transaction creation available even when cash is currently zero.
    // Validation/business rules are enforced on the server.
    const hasCash = primaryCashBalance > 1e-9;
    const cashBlocksType = (typeKey: string) => {
        void typeKey;
        void hasCash;

        return false;
    };
    const [createOpen, setCreateOpen] = useState(false);
    const [createType, setCreateType] = useState(
        typeEntries[0]?.[0] ?? 'income',
    );

    const [categoryId, setCategoryId] = useState<string>('');
    const [primaryAmount, setPrimaryAmount] = useState<string>('');
    const [secondaryAmount, setSecondaryAmount] = useState<string>('');
    const [rate, setRate] = useState<string>(defaultRate ?? '');
    const [source, setSource] = useState<string>('');
    const [settledAmount, setSettledAmount] = useState<string>('');
    const [contactIds, setContactIds] = useState<string[]>([]); // optional
    const [lastEdited, setLastEdited] = useState<'primary' | 'secondary'>(
        'primary',
    );

    const [editOpen, setEditOpen] = useState(false);
    const [editTx, setEditTx] = useState<Props['transactions'][number] | null>(
        null,
    );
    const [editType, setEditType] = useState<string>('income');
    const [editCategoryId, setEditCategoryId] = useState<string>('');
    const [editPrimaryAmount, setEditPrimaryAmount] = useState<string>('');
    const [editSecondaryAmount, setEditSecondaryAmount] = useState<string>('');
    const [editRate, setEditRate] = useState<string>(defaultRate ?? '');
    const [editSource, setEditSource] = useState<string>('');
    const [editNote, setEditNote] = useState<string>('');
    const [editSettledAmount, setEditSettledAmount] = useState<string>('');
    const [editContactIds, setEditContactIds] = useState<string[]>([]); // optional
    const [editDate, setEditDate] = useState<string>(
        new Date().toISOString().slice(0, 10),
    );
    const [editLastEdited, setEditLastEdited] = useState<
        'primary' | 'secondary'
    >('primary');

    const openCreate = (type: string) => {
        setCreateType(type);
        setCategoryId(pickCategoryId(categoriesByType[type] ?? [], ''));
        setPrimaryAmount('');
        setSecondaryAmount('');
        setRate(defaultRate ?? '');
        setSource('');
        setSettledAmount('');
        setContactIds([]);
        setLastEdited('primary');
        setCreateOpen(true);
    };

    const contactNameById = (id: string) =>
        contacts.find((c) => String(c.id) === id)?.name ?? id;

    const addContactId = (id: string) => {
        if (!id || id === CONTACT_NONE) {
            return;
        }

        setContactIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    };

    const removeContactId = (id: string) => {
        setContactIds((prev) => prev.filter((x) => x !== id));
    };

    const addEditContactId = (id: string) => {
        if (!id || id === CONTACT_NONE) {
            return;
        }

        setEditContactIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    };

    const removeEditContactId = (id: string) => {
        setEditContactIds((prev) => prev.filter((x) => x !== id));
    };

    const openEdit = (tx: Props['transactions'][number]) => {
        setEditTx(tx);
        setEditType(tx.type);
        setEditPrimaryAmount(tx.amount ?? '');
        setEditSecondaryAmount(tx.secondary_amount ?? '');
        setEditRate(tx.rate ?? defaultRate ?? '');
        setEditSource(tx.source ?? '');
        setEditNote(tx.note ?? '');
        setEditSettledAmount(tx.settled_amount ?? '');
        setEditContactIds(tx.contacts.map((c) => String(c.id)));
        setEditDate(
            typeof tx.occurred_on === 'string'
                ? tx.occurred_on
                : new Date().toISOString().slice(0, 10),
        );
        setEditLastEdited('primary');
        setEditCategoryId(tx.category ? String(tx.category.id) : '');
        setEditOpen(true);
    };

    // Deep-link support: on mount, read ?edit=<id> from the URL (an external
    // Auto-open the create dialog when navigating with ?create=TYPE (e.g. from the
    // header's "+ Add" dropdown). Strip the param afterwards to avoid re-opening.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const createType = params.get('create');

        if (!createType) {
            return;
        }

        // Use the param value as the type if it's valid, otherwise fall back.
        const validType = types[createType] ? createType : Object.keys(types)[0] ?? 'expense';

        // eslint-disable-next-line react-hooks/set-state-in-effect
        openCreate(validType);

        params.delete('create');
        const next = params.toString();
        const url = next
            ? `${window.location.pathname}?${next}`
            : window.location.pathname;
        window.history.replaceState({}, '', url);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // system) and open that transaction's edit dialog, then strip the param. This
    // is a legitimate mount-time effect syncing with the URL.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const editId = params.get('edit');

        if (!editId) {
            return;
        }

        const id = Number(editId);

        if (!Number.isFinite(id)) {
            return;
        }

        const tx = transactions.find(
            (t) => t.kind === 'transaction' && t.transaction_id === id,
        );

        if (!tx) {
            return;
        }

        // Opening from the URL is the intended side effect here, so the
        // set-state-in-effect heuristic is suppressed for this one call.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        openEdit(tx);

        // Clean the URL after opening to avoid re-opening after save/back/refresh.
        params.delete('edit');
        const next = params.toString();
        const url = next
            ? `${window.location.pathname}?${next}`
            : window.location.pathname;
        // Remove query param without navigation, so modal stays open.
        window.history.replaceState({}, '', url);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const categories = categoriesByType[createType] ?? [];
    const editCategories = categoriesByType[editType] ?? [];

    // Keep the current selection if still valid, otherwise default to the first
    // category (or empty when the type has none). Computed at the event that changes
    // the list rather than in an effect, so there is no cascading re-render.
    const pickCategoryId = (
        list: Array<{ id: number }>,
        currentId: string,
    ): string => {
        if (list.length === 0) {
            return '';
        }

        if (list.some((c) => String(c.id) === currentId)) {
            return currentId;
        }

        return String(list[0].id);
    };

    const changeEditType = (type: string) => {
        setEditType(type);
        setEditCategoryId(
            pickCategoryId(categoriesByType[type] ?? [], ''),
        );
    };

    const parsedRate = Number(rate);
    const canCalc = Number.isFinite(parsedRate) && parsedRate > 0;

    // Recompute the paired amount from a new FX rate. Runs at the rate input's
    // onChange (an event) rather than in an effect, avoiding a cascading render.
    const applyRateToCreate = (nextRate: string) => {
        setRate(nextRate);

        const r = Number(nextRate);

        if (!Number.isFinite(r) || r <= 0) {
            return;
        }

        if (lastEdited === 'primary') {
            if (primaryAmount === '') {
                return;
            }

            const p = Number(primaryAmount);

            if (Number.isFinite(p)) {
                setSecondaryAmount(formatFixed(p * r, secondaryDecimals));
            }
        } else {
            if (secondaryAmount === '') {
                return;
            }

            const s = Number(secondaryAmount);

            if (Number.isFinite(s)) {
                setPrimaryAmount(formatFixed(s / r, primaryDecimals));
            }
        }
    };

    const typeMeta = useCallback(
        (type: string) => {
            if (type === 'income') {
                return {
                    label: 'Income',
                    cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
                };
            }

            if (type === 'expense') {
                return {
                label: 'Expense',
                cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
            };
        }

        if (type === 'receivable') {
            return {
                label: 'Receivable',
                cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
            };
        }

        if (type === 'payable') {
            return {
                label: 'Payable',
                cls: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
            };
        }

        if (type === 'settle_payable') {
            return {
                label: types[type] ?? type,
                cls: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
            };
        }

        if (type === 'settle_receivable') {
            return {
                label: types[type] ?? type,
                cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
            };
        }

            return {
                label: types[type] ?? type,
                cls: 'bg-muted text-muted-foreground',
            };
        },
        [types],
    );

    // Row-object adapters over the pure helpers in @/lib/transactions.
    const settledFor = (t: Props['transactions'][number]) =>
        settledForAmount(t.settled_amount);

    const totalFor = (t: Props['transactions'][number]) =>
        totalForAmount(t.amount);

    const progressFor = (t: Props['transactions'][number]) => {
        const total = totalFor(t);
        const settled = settledFor(t);

        if (total === null || settled === null || total <= 0) {
            return null;
        }

        return Math.max(0, Math.min(1, settled / total));
    };

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
            return `transactions-${dateFrom}-to-${dateTo}`;
        }

        if (dateFrom) {
            return `transactions-from-${dateFrom}`;
        }

        if (dateTo) {
            return `transactions-until-${dateTo}`;
        }

        return 'transactions';
    }, [dateFrom, dateTo]);

    const hasActiveFilters =
        tableSearch.trim() !== '' ||
        filterType !== 'all' ||
        filterStatus !== 'all' ||
        filterContact !== 'all' ||
        Boolean(dateFrom) ||
        Boolean(dateTo);

    const filteredTxs = useMemo(() => {
        if (dateRangeInvalid) {
            return [];
        }

        let rows = orderedTxs;

        if (filterType !== 'all') {
            rows = rows.filter((t) => t.type === filterType);
        }

        if (filterStatus !== 'all') {
            rows = rows.filter((t) => {
                if (t.kind === 'settlement') {
                    return false;
                }

                if (t.settlement_status === null) {
                    return false;
                }

                return t.settlement_status === filterStatus;
            });
        }

        if (filterContact !== 'all') {
            rows = rows.filter((t) =>
                t.contacts.some((c) => String(c.id) === filterContact),
            );
        }

        if (dateFrom || dateTo) {
            rows = rows.filter((t) => {
                if (dateFrom && t.occurred_on < dateFrom) {
                    return false;
                }

                if (dateTo && t.occurred_on > dateTo) {
                    return false;
                }

                return true;
            });
        }

        const q = tableSearch.trim().toLowerCase();

        if (q) {
            rows = rows.filter((t) => {
                const meta = typeMeta(t.type);
                const parts = [
                    t.note,
                    t.source,
                    t.category?.name,
                    t.amount,
                    t.secondary_amount ?? '',
                    t.currency ?? '',
                    t.secondary_currency ?? '',
                    t.rate ?? '',
                    formatDateDMY(t.occurred_on),
                    t.occurred_on,
                    String(t.transaction_id),
                    meta.label,
                    t.kind,
                    t.settlement_status ?? '',
                    ...t.contacts.map((c) => c.name),
                ];
                const haystack = parts.filter(Boolean).join(' ').toLowerCase();

                return haystack.includes(q);
            });
        }

        return rows;
    }, [
        orderedTxs,
        tableSearch,
        filterType,
        filterStatus,
        filterContact,
        typeMeta,
        dateFrom,
        dateTo,
        dateRangeInvalid,
    ]);

    const getExportTableOptions = () => ({
        primaryDecimals,
        secondaryDecimals,
        primaryCurrency,
        secondaryCurrency,
        typeLabel: (type: string) => typeMeta(type).label,
        formatDate: formatDateDMY,
    });

    const handleExportFormat = (fmt: 'pdf' | 'excel') => {
        const { headers, body } = buildTransactionsExportTable(
            filteredTxs,
            getExportTableOptions(),
        );
        const period = periodLabelForExport;
        void (async () => {
            setExporting(true);

            try {
                if (fmt === 'pdf') {
                    await downloadTransactionsPdf(
                        headers,
                        body,
                        'Transactions',
                        exportFilenameBase,
                        period,
                    );
                } else {
                    await downloadTransactionsExcel(
                        headers,
                        body,
                        exportFilenameBase,
                        period,
                    );
                }
            } finally {
                setExporting(false);
                setExportSelectKey((k) => k + 1);
            }
        })();
    };

    const handlePrintTransactions = () => {
        const { headers, body } = buildTransactionsExportTable(
            filteredTxs,
            getExportTableOptions(),
        );
        printTransactionsTable(
            headers,
            body,
            'Transactions',
            periodLabelForExport,
        );
    };

    const editParsedRate = Number(editRate);
    const editCanCalc = Number.isFinite(editParsedRate) && editParsedRate > 0;

    const applyRateToEdit = (nextRate: string) => {
        setEditRate(nextRate);

        const r = Number(nextRate);

        if (!Number.isFinite(r) || r <= 0) {
            return;
        }

        if (editLastEdited === 'primary') {
            if (editPrimaryAmount === '') {
                return;
            }

            const p = Number(editPrimaryAmount);

            if (Number.isFinite(p)) {
                setEditSecondaryAmount(formatFixed(p * r, secondaryDecimals));
            }
        } else {
            if (editSecondaryAmount === '') {
                return;
            }

            const s = Number(editSecondaryAmount);

            if (Number.isFinite(s)) {
                setEditPrimaryAmount(formatFixed(s / r, primaryDecimals));
            }
        }
    };

    return (
        <>
            <Head title="Transactions" />

            <div className="flex min-h-0 flex-1 flex-col space-y-6 py-4 pb-6 sm:py-6">
                <div className="mb-0 flex flex-wrap items-start justify-between gap-4">
                    <Heading
                        title="Transactions"
                        description="Manage your income, expenses, payables and receivables"
                    />

                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogContent className="flex max-h-[90dvh] min-h-0 w-[calc(100%-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
                            <DialogHeader className="shrink-0 space-y-0.5 px-6 pt-4 pb-1.5">
                                <DialogTitle>New transaction</DialogTitle>
                                <DialogDescription>
                                    Add a {types[createType] ?? createType}{' '}
                                    transaction.
                                </DialogDescription>
                            </DialogHeader>

                            <Form
                                action={transactionsStore.url()}
                                method="post"
                                options={{ preserveScroll: true }}
                                className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
                                onSuccess={() => {
                                    setCreateOpen(false);
                                    setCategoryId('');
                                }}
                            >
                                {({ processing, errors }) => (
                                    <>
                                        <input
                                            type="hidden"
                                            name="type"
                                            value={createType}
                                        />

                                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-0">
                                        <div className="grid gap-1 md:grid-cols-2 md:items-start">
                                            <div className={TX_FIELD_COL}>
                                                <div className={TX_LABEL_WRAP}>
                                                    <Label
                                                        htmlFor="contact_id"
                                                        className="leading-snug"
                                                    >
                                                        Person (optional)
                                                    </Label>
                                                </div>
                                                {contactIds.map((id) => (
                                                    <input
                                                        key={id}
                                                        type="hidden"
                                                        name="contact_ids[]"
                                                        value={id}
                                                    />
                                                ))}
                                                <Select
                                                    value={CONTACT_NONE}
                                                    onValueChange={(v) => {
                                                        addContactId(v);
                                                    }}
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="Select person" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem
                                                            value={CONTACT_NONE}
                                                        >
                                                            Select person…
                                                        </SelectItem>
                                                        {contacts.map((c) => (
                                                            <SelectItem
                                                                key={c.id}
                                                                value={String(
                                                                    c.id,
                                                                )}
                                                            >
                                                                {c.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {contactIds.length > 0 ? (
                                                    <div className="flex flex-wrap gap-2">
                                                        {contactIds.map(
                                                            (id) => (
                                                                <div
                                                                    key={id}
                                                                    className="inline-flex items-center gap-1 rounded-full border border-sidebar-border/70 bg-muted/10 px-2 py-1 text-xs"
                                                                >
                                                                    <span className="max-w-[200px] truncate">
                                                                        {contactNameById(
                                                                            id,
                                                                        )}
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        className="text-muted-foreground hover:text-foreground"
                                                                        aria-label="Remove person"
                                                                        onClick={() =>
                                                                            removeContactId(
                                                                                id,
                                                                            )
                                                                        }
                                                                    >
                                                                        <X className="size-3" />
                                                                    </button>
                                                                </div>
                                                            ),
                                                        )}
                                                    </div>
                                                ) : null}
                                                {(contactIds.length === 0 ||
                                                    errors.contact_ids ||
                                                    errors.contact_id) && (
                                                    <div className="mt-0.5 space-y-0.5 text-xs leading-snug">
                                                        {contactIds.length ===
                                                            0 && (
                                                            <p className="text-muted-foreground">
                                                                You can add multiple
                                                                people by selecting
                                                                one-by-one.
                                                            </p>
                                                        )}
                                                        <InputError
                                                            message={
                                                                errors.contact_ids ??
                                                                errors.contact_id
                                                            }
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            <div
                                                className={`${TX_FIELD_COL} self-start`}
                                            >
                                                <div className={TX_LABEL_WRAP}>
                                                    <Label
                                                        htmlFor="source"
                                                        className="leading-snug"
                                                    >
                                                        Source (optional)
                                                    </Label>
                                                </div>
                                                <Input
                                                    id="source"
                                                    name="source"
                                                    placeholder="e.g. Cash, Bank, bKash"
                                                    value={source}
                                                    onChange={(e) =>
                                                        setSource(
                                                            e.target.value,
                                                        )
                                                    }
                                                />
                                                <InputError
                                                    className="mt-0.5"
                                                    message={errors.source}
                                                />
                                            </div>

                                            <div className={TX_FIELD_COL}>
                                                <div className={TX_LABEL_WRAP}>
                                                    <Label
                                                        htmlFor="primary_amount"
                                                        className="leading-snug"
                                                    >
                                                        Primary amount (
                                                        {primaryCurrency})
                                                    </Label>
                                                </div>
                                                <Input
                                                    id="primary_amount"
                                                    name="primary_amount"
                                                    type="text"
                                                    inputMode="decimal"
                                                    placeholder={formatFixed(
                                                        0,
                                                        primaryDecimals,
                                                    )}
                                                    value={primaryAmount}
                                                    onChange={(e) => {
                                                        setLastEdited(
                                                            'primary',
                                                        );
                                                        setPrimaryAmount(
                                                            e.target.value,
                                                        );

                                                        if (!canCalc) {
                                                            return;
                                                        }

                                                        const p = Number(
                                                            e.target.value,
                                                        );

                                                        if (
                                                            !Number.isFinite(p)
                                                        ) {
                                                            return;
                                                        }

                                                        const s =
                                                            p * parsedRate;
                                                        setSecondaryAmount(
                                                            e.target.value ===
                                                                ''
                                                                ? ''
                                                                : formatFixed(
                                                                      s,
                                                                      secondaryDecimals,
                                                                  ),
                                                        );
                                                    }}
                                                />
                                                <InputError
                                                    className="mt-0.5"
                                                    message={
                                                        errors.primary_amount
                                                    }
                                                />
                                            </div>

                                            <div className={TX_FIELD_COL}>
                                                <div className={TX_LABEL_WRAP}>
                                                    <Label
                                                        htmlFor="secondary_amount"
                                                        className="leading-snug"
                                                    >
                                                        Secondary amount (
                                                        {secondaryCurrency})
                                                    </Label>
                                                </div>
                                                <Input
                                                    id="secondary_amount"
                                                    name="secondary_amount"
                                                    type="text"
                                                    inputMode="decimal"
                                                    placeholder={formatFixed(
                                                        0,
                                                        secondaryDecimals,
                                                    )}
                                                    value={secondaryAmount}
                                                    onChange={(e) => {
                                                        setLastEdited(
                                                            'secondary',
                                                        );
                                                        setSecondaryAmount(
                                                            e.target.value,
                                                        );

                                                        if (!canCalc) {
                                                            return;
                                                        }

                                                        const s = Number(
                                                            e.target.value,
                                                        );

                                                        if (
                                                            !Number.isFinite(s)
                                                        ) {
                                                            return;
                                                        }

                                                        const p =
                                                            s / parsedRate;
                                                        setPrimaryAmount(
                                                            e.target.value ===
                                                                ''
                                                                ? ''
                                                                : formatFixed(
                                                                      p,
                                                                      primaryDecimals,
                                                                  ),
                                                        );
                                                    }}
                                                />
                                                <InputError
                                                    className="mt-0.5"
                                                    message={
                                                        errors.secondary_amount
                                                    }
                                                />
                                            </div>

                                            <div className={TX_FIELD_COL}>
                                                <div className={TX_LABEL_WRAP}>
                                                    <Label
                                                        htmlFor="occurred_on"
                                                        className="leading-snug"
                                                    >
                                                        Date
                                                    </Label>
                                                </div>
                                                <Input
                                                    id="occurred_on"
                                                    name="occurred_on"
                                                    type="date"
                                                    required
                                                    defaultValue={new Date()
                                                        .toISOString()
                                                        .slice(0, 10)}
                                                />
                                                <InputError
                                                    className="mt-0.5"
                                                    message={
                                                        errors.occurred_on
                                                    }
                                                />
                                            </div>

                                            <div className={TX_FIELD_COL}>
                                                <div className={TX_LABEL_WRAP}>
                                                    <Label
                                                        htmlFor="rate"
                                                        className="leading-snug"
                                                    >
                                                        Rate (1 {primaryCurrency}{' '}
                                                        = ? {secondaryCurrency})
                                                    </Label>
                                                </div>
                                                <Input
                                                    id="rate"
                                                    name="rate"
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={rate}
                                                    onChange={(e) =>
                                                        applyRateToCreate(
                                                            e.target.value,
                                                        )
                                                    }
                                                />
                                                <div className="mt-0.5 space-y-0.5">
                                                    <p className="text-xs leading-snug text-muted-foreground">
                                                        Loaded from your
                                                        configured API (you can
                                                        override).
                                                    </p>
                                                    <InputError
                                                        message={errors.rate}
                                                    />
                                                </div>
                                            </div>

                                            <div className={`${TX_FIELD_COL} md:col-span-2`}>
                                                <div className={TX_LABEL_WRAP}>
                                                    <Label
                                                        htmlFor="category_id"
                                                        className="leading-snug"
                                                    >
                                                        Category
                                                    </Label>
                                                </div>
                                                <input
                                                    type="hidden"
                                                    name="category_id"
                                                    value={categoryId}
                                                />
                                                <Select
                                                    value={categoryId}
                                                    onValueChange={
                                                        setCategoryId
                                                    }
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="Select category" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {categories.map((c) => (
                                                            <SelectItem
                                                                key={c.id}
                                                                value={String(
                                                                    c.id,
                                                                )}
                                                            >
                                                                {c.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {(categories.length === 0 ||
                                                    errors.category_id) && (
                                                    <div className="mt-0.5 space-y-0.5 text-xs leading-snug">
                                                        {categories.length ===
                                                            0 && (
                                                            <p className="text-muted-foreground">
                                                                No categories for
                                                                this type.
                                                                Create one in
                                                                Categories
                                                                first.
                                                            </p>
                                                        )}
                                                        <InputError
                                                            message={
                                                                errors.category_id
                                                            }
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            {(createType === 'payable' ||
                                                createType ===
                                                    'receivable') && (
                                                <div
                                                    className={`${TX_FIELD_COL} md:col-span-2`}
                                                >
                                                    <div className={TX_LABEL_WRAP}>
                                                        <Label
                                                            htmlFor="settled_amount"
                                                            className="leading-snug"
                                                        >
                                                            Settled amount
                                                            (optional)
                                                        </Label>
                                                    </div>
                                                    <Input
                                                        id="settled_amount"
                                                        name="settled_amount"
                                                        type="text"
                                                        inputMode="decimal"
                                                        placeholder={formatFixed(
                                                            0,
                                                            primaryDecimals,
                                                        )}
                                                        value={settledAmount}
                                                        onChange={(e) =>
                                                            setSettledAmount(
                                                                e.target.value,
                                                            )
                                                        }
                                                    />
                                                    <div className="mt-0.5 space-y-0.5">
                                                        <p className="text-xs leading-snug text-muted-foreground">
                                                            Only for
                                                            Payable/Receivable
                                                            (supports partial
                                                            settle).
                                                        </p>
                                                        <InputError
                                                            message={
                                                                errors.settled_amount
                                                            }
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            <div
                                                className={`${TX_FIELD_COL} md:col-span-2`}
                                            >
                                                <div className={TX_LABEL_WRAP}>
                                                    <Label
                                                        htmlFor="note"
                                                        className="leading-snug"
                                                    >
                                                        Note (optional)
                                                    </Label>
                                                </div>
                                                <Textarea
                                                    id="note"
                                                    name="note"
                                                    placeholder="Write details..."
                                                    rows={3}
                                                    className="min-h-20 resize-y"
                                                />
                                                <InputError
                                                    className="mt-0.5"
                                                    message={errors.note}
                                                />
                                            </div>
                                        </div>
                                        </div>

                                        <DialogFooter className="shrink-0 gap-2 border-t bg-background px-6 py-2">
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

                {listMeta?.truncated ? (
                    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
                        Showing the most recent {listMeta.shown} of{' '}
                        {listMeta.total} entries. Use the filters below to narrow
                        down older transactions.
                    </div>
                ) : null}

                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-sidebar-border/70 bg-card">
                    {orderedTxs.length === 0 ? (
                        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                            No transactions yet.
                        </div>
                    ) : (
                        <div className="flex w-full min-w-0 min-h-0 flex-1 flex-col">
                            <div className="space-y-2 border-b border-sidebar-border/70 p-4">
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid xl:grid-cols-[minmax(140px,360px)_112px_126px_112px_128px_128px_minmax(148px,156px)]">
                                    <div className="w-full max-w-[360px] min-w-0">
                                        <Label
                                            htmlFor="tx-table-search"
                                            className="text-xs text-muted-foreground"
                                        >
                                            Search
                                        </Label>
                                        <div className="relative mt-1">
                                            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                id="tx-table-search"
                                                value={tableSearch}
                                                onChange={(e) =>
                                                    setTableSearch(
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="Note, category, person, amount…"
                                                className="h-9 pl-9"
                                                autoComplete="off"
                                            />
                                        </div>
                                    </div>
                                    <div className="min-w-0">
                                        <Label
                                            htmlFor="tx-filter-type"
                                            className="text-xs text-muted-foreground"
                                        >
                                            Type
                                        </Label>
                                        <Select
                                            value={filterType}
                                            onValueChange={setFilterType}
                                        >
                                            <SelectTrigger
                                                id="tx-filter-type"
                                                className="mt-1 h-9 w-full max-w-full min-w-0 xl:text-xs"
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
                                    <div className="min-w-0">
                                        <Label
                                            htmlFor="tx-filter-status"
                                            className="text-xs text-muted-foreground"
                                        >
                                            Settlement status
                                        </Label>
                                        <Select
                                            value={filterStatus}
                                            onValueChange={setFilterStatus}
                                        >
                                            <SelectTrigger
                                                id="tx-filter-status"
                                                className="mt-1 h-9 w-full max-w-full min-w-0 xl:text-xs"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">
                                                    All
                                                </SelectItem>
                                                <SelectItem value="unsettled">
                                                    Unsettled
                                                </SelectItem>
                                                <SelectItem value="partial">
                                                    Partial
                                                </SelectItem>
                                                <SelectItem value="settled">
                                                    Settled
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="min-w-0">
                                        <Label
                                            htmlFor="tx-filter-contact"
                                            className="text-xs text-muted-foreground"
                                        >
                                            Person
                                        </Label>
                                        <Select
                                            value={filterContact}
                                            onValueChange={setFilterContact}
                                        >
                                            <SelectTrigger
                                                id="tx-filter-contact"
                                                className="mt-1 h-9 w-full max-w-full min-w-0 xl:text-xs"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">
                                                    All
                                                </SelectItem>
                                                {contacts.map((c) => (
                                                    <SelectItem
                                                        key={c.id}
                                                        value={String(c.id)}
                                                    >
                                                        {c.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="min-w-0">
                                        <Label
                                            htmlFor="tx-date-from"
                                            className="text-xs text-muted-foreground"
                                        >
                                            From date
                                        </Label>
                                        <Input
                                            id="tx-date-from"
                                            type="date"
                                            value={dateFrom}
                                            onChange={(e) =>
                                                setDateFrom(e.target.value)
                                            }
                                            className="mt-1 h-9 w-full min-w-0"
                                        />
                                    </div>
                                    <div className="min-w-0">
                                        <Label
                                            htmlFor="tx-date-to"
                                            className="text-xs text-muted-foreground"
                                        >
                                            To date
                                        </Label>
                                        <Input
                                            id="tx-date-to"
                                            type="date"
                                            value={dateTo}
                                            onChange={(e) =>
                                                setDateTo(e.target.value)
                                            }
                                            className="mt-1 h-9 w-full min-w-0"
                                        />
                                    </div>
                                    <div className="flex min-h-[52px] min-w-0 flex-col justify-end">
                                        <Label
                                            className="invisible text-xs text-muted-foreground select-none"
                                            aria-hidden
                                        >
                                            Export
                                        </Label>
                                        <div className="mt-1 flex max-w-full min-w-0 flex-nowrap items-center gap-1.5">
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
                                                    exporting ||
                                                    dateRangeInvalid ||
                                                    filteredTxs.length === 0
                                                }
                                            >
                                                <SelectTrigger
                                                    className="h-9 w-[108px] min-w-0 shrink-0 xl:w-[108px] xl:text-xs"
                                                    aria-label="Export transactions"
                                                >
                                                    {exporting ? (
                                                        <span className="flex items-center gap-1.5">
                                                            <Loader2 className="size-3.5 animate-spin" />
                                                            Exporting…
                                                        </span>
                                                    ) : (
                                                        <SelectValue placeholder="Export as…" />
                                                    )}
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
                                                onClick={
                                                    handlePrintTransactions
                                                }
                                                disabled={
                                                    dateRangeInvalid ||
                                                    filteredTxs.length === 0
                                                }
                                                aria-label="Print transactions"
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
                                            {filteredTxs.length}
                                        </span>{' '}
                                        of {orderedTxs.length}
                                        {hasActiveFilters && (
                                            <span className="ml-1">
                                                (filtered)
                                            </span>
                                        )}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {hasActiveFilters && (
                                            <>
                                                <span className="text-xs text-muted-foreground">
                                                    Clear filters to drag rows
                                                </span>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8"
                                                    onClick={() => {
                                                        setTableSearch('');
                                                        setFilterType('all');
                                                        setFilterStatus('all');
                                                        setFilterContact('all');
                                                        setDateFrom('');
                                                        setDateTo('');
                                                    }}
                                                >
                                                    Clear filters
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {filteredTxs.length === 0 ? (
                                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                                    {dateRangeInvalid ? (
                                        <>
                                            From date must be on or before To
                                            date.
                                        </>
                                    ) : (
                                        <>
                                            No transactions match your search,
                                            filters, or date range.
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div className="-mx-4 min-h-0 min-w-0 flex-1 overflow-auto px-4">
                                    <TooltipProvider delayDuration={150}>
                                        <table className="w-full min-w-[980px] border-separate border-spacing-0 text-sm table-fixed">
                                        <thead>
                                            <tr className="border-b border-sidebar-border/70 text-left font-medium">
                                                <th className="sticky top-0 z-20 w-14 bg-muted px-3 py-3 text-muted-foreground">
                                                    SL
                                                </th>
                                                <th className="sticky top-0 z-20 w-28 bg-muted px-3 py-3 text-muted-foreground">
                                                    Date
                                                </th>
                                                <th className="sticky top-0 z-20 w-28 bg-muted px-3 py-3 text-muted-foreground">
                                                    Type
                                                </th>
                                                <th className="sticky top-0 z-20 w-32 bg-muted px-3 py-3 text-muted-foreground">
                                                    Person
                                                </th>
                                                <th className="sticky top-0 z-20 w-28 bg-muted px-3 py-3 text-muted-foreground">
                                                    Category
                                                </th>
                                                <th className="sticky top-0 z-20 w-36 bg-muted px-3 py-3 text-muted-foreground">
                                                    Source
                                                </th>
                                                <th className="sticky top-0 z-20 w-32 bg-muted px-3 py-3 text-right text-muted-foreground">
                                                    Amount
                                                </th>
                                                <th className="sticky top-0 z-20 w-32 bg-muted px-3 py-3 text-muted-foreground">
                                                    Status
                                                </th>
                                                <th className="sticky top-0 z-20 w-24 bg-muted px-3 py-3 text-right text-muted-foreground">
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-sidebar-border/70">
                                            {filteredTxs.map((t, idx) => (
                                                <tr
                                                    key={t.id}
                                                    className="even:bg-muted/15 hover:bg-muted/30"
                                                    draggable={
                                                        !hasActiveFilters
                                                    }
                                                    onDragStart={(e) => {
                                                        if (hasActiveFilters) {
                                                            return;
                                                        }

                                                        setDraggingId(t.id);
                                                        e.dataTransfer.setData(
                                                            'text/plain',
                                                            String(t.id),
                                                        );
                                                        e.dataTransfer.effectAllowed =
                                                            'move';
                                                    }}
                                                    onDragEnd={() =>
                                                        setDraggingId(null)
                                                    }
                                                    onDragOver={(e) => {
                                                        if (
                                                            hasActiveFilters ||
                                                            draggingId === null
                                                        ) {
                                                            return;
                                                        }

                                                        e.preventDefault();
                                                        e.dataTransfer.dropEffect =
                                                            'move';
                                                    }}
                                                    onDrop={(e) => {
                                                        e.preventDefault();

                                                        if (hasActiveFilters) {
                                                            return;
                                                        }

                                                        const from =
                                                            e.dataTransfer.getData(
                                                                'text/plain',
                                                            );

                                                        if (!from) {
                                                            return;
                                                        }

                                                        moveRow(from, t.id);
                                                    }}
                                                >
                                                    <td className="px-3 py-3 align-middle text-muted-foreground">
                                                        <div
                                                            className="flex items-center gap-1"
                                                            title="Drag to reorder"
                                                        >
                                                            <GripVertical
                                                                aria-hidden="true"
                                                                className="size-4 text-muted-foreground/70"
                                                            />
                                                            <span className="sr-only">
                                                                Drag to reorder
                                                            </span>
                                                            <span className="tabular-nums">
                                                                {idx + 1}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 align-middle whitespace-nowrap text-muted-foreground tabular-nums">
                                                        {formatDateDMY(
                                                            t.occurred_on,
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-3 align-middle">
                                                        {(() => {
                                                            const m = typeMeta(
                                                                t.type,
                                                            );

                                                            return (
                                                                <span
                                                                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${m.cls}`}
                                                                >
                                                                    {m.label}
                                                                </span>
                                                            );
                                                        })()}
                                                    </td>
                                                    <td className="px-3 py-3 align-middle">
                                                        {t.contacts.length >
                                                        0 ? (
                                                            <Tooltip>
                                                                <TooltipTrigger
                                                                    asChild
                                                                >
                                                                    <Link
                                                                        href={contactsShow(
                                                                            {
                                                                                contact:
                                                                                    t
                                                                                        .contacts[0]!
                                                                                        .id,
                                                                            },
                                                                        )}
                                                                        className="block truncate font-medium hover:underline"
                                                                    >
                                                                        {
                                                                            t
                                                                                .contacts[0]!
                                                                                .name
                                                                        }
                                                                        {t
                                                                            .contacts
                                                                            .length >
                                                                        1
                                                                            ? ` +${t.contacts.length - 1}`
                                                                            : ''}
                                                                    </Link>
                                                                </TooltipTrigger>
                                                                <TooltipContent
                                                                    side="bottom"
                                                                    align="start"
                                                                    className="max-w-[560px] text-left leading-5 whitespace-pre-wrap"
                                                                >
                                                                    {t.contacts
                                                                        .map(
                                                                            (
                                                                                c,
                                                                            ) =>
                                                                                c.name,
                                                                        )
                                                                        .join(
                                                                            ', ',
                                                                        )}
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        ) : (
                                                            <div className="truncate text-muted-foreground">
                                                                —
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-3 align-middle">
                                                        {t.category?.name ? (
                                                            <Tooltip>
                                                                <TooltipTrigger
                                                                    asChild
                                                                >
                                                                    <div className="cursor-help truncate">
                                                                        {
                                                                            t
                                                                                .category
                                                                                .name
                                                                        }
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent
                                                                    side="bottom"
                                                                    align="start"
                                                                    className="max-w-[560px] text-left leading-5 whitespace-pre-wrap"
                                                                >
                                                                    {
                                                                        t
                                                                            .category
                                                                            .name
                                                                    }
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        ) : (
                                                            <div className="truncate text-muted-foreground">
                                                                —
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-3 align-middle">
                                                        {t.source ? (
                                                            <Tooltip>
                                                                <TooltipTrigger
                                                                    asChild
                                                                >
                                                                    <div className="cursor-help truncate text-muted-foreground">
                                                                        {
                                                                            t.source
                                                                        }
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent
                                                                    side="bottom"
                                                                    align="start"
                                                                    className="max-w-[560px] text-left leading-5 whitespace-pre-wrap"
                                                                >
                                                                    {t.source}
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        ) : (
                                                            <div className="truncate text-muted-foreground">
                                                                —
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-3 text-right align-middle whitespace-nowrap tabular-nums">
                                                        <div>
                                                            <div
                                                                className={`font-medium whitespace-nowrap ${
                                                                    directionForType(
                                                                        t.type,
                                                                    ) < 0
                                                                        ? 'text-destructive'
                                                                        : 'text-emerald-600 dark:text-emerald-400'
                                                                }`}
                                                            >
                                                                {directionForType(
                                                                    t.type,
                                                                ) < 0
                                                                    ? '- '
                                                                    : '+ '}
                                                                {formatFixed(
                                                                    Math.abs(
                                                                        Number(
                                                                            t.amount,
                                                                        ),
                                                                    ),
                                                                    primaryDecimals,
                                                                )}{' '}
                                                                <span className="text-xs font-normal text-muted-foreground">
                                                                    {t.currency}
                                                                </span>
                                                            </div>
                                                            {t.secondary_amount !=
                                                                null &&
                                                                t.secondary_currency &&
                                                                Number.isFinite(
                                                                    Number(
                                                                        t.secondary_amount,
                                                                    ),
                                                                ) &&
                                                                Math.abs(
                                                                    Number(
                                                                        t.secondary_amount,
                                                                    ),
                                                                ) > 0 && (
                                                                    <div className="mt-0.5 text-xs text-muted-foreground">
                                                                        {directionForType(
                                                                            t.type,
                                                                        ) < 0
                                                                            ? '- '
                                                                            : '+ '}
                                                                        {formatFixed(
                                                                            Math.abs(
                                                                                Number(
                                                                                    t.secondary_amount,
                                                                                ),
                                                                            ),
                                                                            secondaryDecimals,
                                                                        )}{' '}
                                                                        {
                                                                            t.secondary_currency
                                                                        }
                                                                    </div>
                                                                )}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 align-middle">
                                                        {isObligation(
                                                            t.type,
                                                        ) ? (
                                                            <div className="space-y-1">
                                                                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                                                    <span
                                                                        className={
                                                                            t.settlement_status ===
                                                                            'settled'
                                                                                ? 'inline-flex items-center rounded-md bg-emerald-500/15 px-2 py-1 font-medium text-emerald-700 dark:text-emerald-300'
                                                                                : t.settlement_status ===
                                                                                    'partial'
                                                                                  ? 'inline-flex items-center rounded-md bg-amber-500/15 px-2 py-1 font-medium text-amber-700 dark:text-amber-300'
                                                                                  : 'inline-flex items-center rounded-md bg-muted px-2 py-1 font-medium text-muted-foreground'
                                                                        }
                                                                    >
                                                                        <Tooltip>
                                                                            <TooltipTrigger
                                                                                asChild
                                                                            >
                                                                                <span className="cursor-help truncate">
                                                                                    {statusLabel(
                                                                                        t.settlement_status,
                                                                                    )}
                                                                                </span>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent
                                                                                side="bottom"
                                                                                align="start"
                                                                                className="max-w-[560px] text-left leading-5 whitespace-pre-wrap"
                                                                            >
                                                                                {`${statusLabel(
                                                                                    t.settlement_status,
                                                                                )} • Settled ${formatFixed(
                                                                                    settledFor(
                                                                                        t,
                                                                                    ) ??
                                                                                        0,
                                                                                    primaryDecimals,
                                                                                )} / ${formatFixed(
                                                                                    totalFor(
                                                                                        t,
                                                                                    ) ??
                                                                                        0,
                                                                                    primaryDecimals,
                                                                                )} ${t.currency}`}
                                                                            </TooltipContent>
                                                                        </Tooltip>
                                                                    </span>
                                                                </div>
                                                                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                                                    <div
                                                                        className={
                                                                            t.settlement_status ===
                                                                            'settled'
                                                                                ? 'h-full bg-emerald-500'
                                                                                : t.settlement_status ===
                                                                                    'partial'
                                                                                  ? 'h-full bg-amber-500'
                                                                                  : 'h-full bg-muted-foreground/30'
                                                                        }
                                                                        style={{
                                                                            width: `${Math.round(
                                                                                (progressFor(
                                                                                    t,
                                                                                ) ??
                                                                                    0) *
                                                                                    100,
                                                                            )}%`,
                                                                        }}
                                                                    />
                                                                </div>
                                                                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                                                                    <span className="tabular-nums">
                                                                        {formatFixed(
                                                                            settledFor(
                                                                                t,
                                                                            ) ??
                                                                                0,
                                                                            primaryDecimals,
                                                                        )}
                                                                        {' / '}
                                                                        {formatFixed(
                                                                            totalFor(
                                                                                t,
                                                                            ) ??
                                                                                0,
                                                                            primaryDecimals,
                                                                        )}{' '}
                                                                        {
                                                                            t.currency
                                                                        }
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted-foreground" />
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-3 align-middle">
                                                        <div className="flex justify-end gap-0">
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
                                                                                t.transaction_id,
                                                                        },
                                                                    )}
                                                                >
                                                                    <Eye className="size-4" />
                                                                </Link>
                                                            </Button>
                                                            {t.kind ===
                                                                'transaction' && (
                                                                <>
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        aria-label="Edit transaction"
                                                                        onClick={() =>
                                                                            openEdit(
                                                                                t,
                                                                            )
                                                                        }
                                                                    >
                                                                        <Pencil className="size-4" />
                                                                    </Button>
                                                                    <ConfirmDeleteDialog
                                                                        title="Delete transaction?"
                                                                        description="This permanently removes the transaction and its ledger entries. This cannot be undone."
                                                                        confirmLabel="Delete transaction"
                                                                        onConfirm={() =>
                                                                            router.delete(
                                                                                transactionsDestroy.url(
                                                                                    {
                                                                                        transaction:
                                                                                            t.transaction_id,
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
                                                                                aria-label="Delete transaction"
                                                                                className="text-destructive hover:text-destructive"
                                                                            >
                                                                                <Trash2 className="size-4" />
                                                                            </Button>
                                                                        }
                                                                    />
                                                                </>
                                                            )}
                                                            {t.kind ===
                                                                'settlement' &&
                                                            t.settlement_id ? (
                                                                <>
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        aria-label="Edit settlement"
                                                                        asChild
                                                                    >
                                                                        <Link
                                                                            href={transactionsShow.url(
                                                                                {
                                                                                    transaction:
                                                                                        t.transaction_id,
                                                                                },
                                                                                {
                                                                                    query: {
                                                                                        edit_settlement:
                                                                                            t.settlement_id,
                                                                                    },
                                                                                },
                                                                            )}
                                                                        >
                                                                            <Pencil className="size-4" />
                                                                        </Link>
                                                                    </Button>
                                                                    <ConfirmDeleteDialog
                                                                        title="Delete settlement?"
                                                                        description="This removes the settlement and updates the settled total. This cannot be undone."
                                                                        confirmLabel="Delete settlement"
                                                                        onConfirm={() =>
                                                                            router.delete(
                                                                                `/transactions/${t.transaction_id}/settlements/${t.settlement_id}`,
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
                                                                                aria-label="Delete settlement"
                                                                                className="text-destructive hover:text-destructive"
                                                                            >
                                                                                <Trash2 className="size-4" />
                                                                            </Button>
                                                                        }
                                                                    />
                                                                </>
                                                            ) : null}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    </TooltipProvider>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                    <DialogContent className="flex max-h-[90dvh] min-h-0 w-[calc(100%-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
                        <DialogHeader className="shrink-0 space-y-0.5 px-6 pt-4 pb-1.5">
                            <DialogTitle>Edit transaction</DialogTitle>
                            <DialogDescription>
                                Update fields and save
                            </DialogDescription>
                        </DialogHeader>

                        {editTx && (
                            <Form
                                action={transactionsUpdate.url({
                                    transaction: editTx.transaction_id,
                                })}
                                method="patch"
                                options={{ preserveScroll: true }}
                                className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
                                onSuccess={() => setEditOpen(false)}
                            >
                                {({ processing, errors }) => (
                                    <>
                                        <input
                                            type="hidden"
                                            name="type"
                                            value={editType}
                                        />

                                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-0">
                                        <div className="grid gap-1 md:grid-cols-2 md:items-start">
                                            <div className={TX_FIELD_COL}>
                                                <div className={TX_LABEL_WRAP}>
                                                    <Label
                                                        htmlFor="edit_contact_id"
                                                        className="leading-snug"
                                                    >
                                                        Person (optional)
                                                    </Label>
                                                </div>
                                                {editContactIds.map((id) => (
                                                    <input
                                                        key={id}
                                                        type="hidden"
                                                        name="contact_ids[]"
                                                        value={id}
                                                    />
                                                ))}
                                                <Select
                                                    value={CONTACT_NONE}
                                                    onValueChange={(v) => {
                                                        addEditContactId(v);
                                                    }}
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="Select person" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem
                                                            value={CONTACT_NONE}
                                                        >
                                                            Select person…
                                                        </SelectItem>
                                                        {contacts.map((c) => (
                                                            <SelectItem
                                                                key={c.id}
                                                                value={String(
                                                                    c.id,
                                                                )}
                                                            >
                                                                {c.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {editContactIds.length > 0 ? (
                                                    <div className="flex flex-wrap gap-2">
                                                        {editContactIds.map(
                                                            (id) => (
                                                                <div
                                                                    key={id}
                                                                    className="inline-flex items-center gap-1 rounded-full border border-sidebar-border/70 bg-muted/10 px-2 py-1 text-xs"
                                                                >
                                                                    <span className="max-w-[200px] truncate">
                                                                        {contactNameById(
                                                                            id,
                                                                        )}
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        className="text-muted-foreground hover:text-foreground"
                                                                        aria-label="Remove person"
                                                                        onClick={() =>
                                                                            removeEditContactId(
                                                                                id,
                                                                            )
                                                                        }
                                                                    >
                                                                        <X className="size-3" />
                                                                    </button>
                                                                </div>
                                                            ),
                                                        )}
                                                    </div>
                                                ) : null}
                                                {(editContactIds.length ===
                                                    0 ||
                                                    errors.contact_ids ||
                                                    errors.contact_id) && (
                                                    <div className="mt-0.5 space-y-0.5 text-xs leading-snug">
                                                        {editContactIds.length ===
                                                            0 && (
                                                            <p className="text-muted-foreground">
                                                                You can add multiple
                                                                people by selecting
                                                                one-by-one.
                                                            </p>
                                                        )}
                                                        <InputError
                                                            message={
                                                                errors.contact_ids ??
                                                                errors.contact_id
                                                            }
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            <div
                                                className={`${TX_FIELD_COL} self-start`}
                                            >
                                                <div className={TX_LABEL_WRAP}>
                                                    <Label
                                                        htmlFor="edit_source"
                                                        className="leading-snug"
                                                    >
                                                        Source (optional)
                                                    </Label>
                                                </div>
                                                <Input
                                                    id="edit_source"
                                                    name="source"
                                                    placeholder="e.g. Cash, Bank, bKash"
                                                    value={editSource}
                                                    onChange={(e) =>
                                                        setEditSource(
                                                            e.target.value,
                                                        )
                                                    }
                                                />
                                                <InputError
                                                    className="mt-0.5"
                                                    message={errors.source}
                                                />
                                            </div>

                                            <div className={TX_FIELD_COL}>
                                                <div className={TX_LABEL_WRAP}>
                                                    <Label
                                                        htmlFor="edit_primary_amount"
                                                        className="leading-snug"
                                                    >
                                                        Primary amount (
                                                        {primaryCurrency})
                                                    </Label>
                                                </div>
                                                <Input
                                                    id="edit_primary_amount"
                                                    name="primary_amount"
                                                    type="text"
                                                    inputMode="decimal"
                                                    placeholder={formatFixed(
                                                        0,
                                                        primaryDecimals,
                                                    )}
                                                    value={editPrimaryAmount}
                                                    onChange={(e) => {
                                                        setEditLastEdited(
                                                            'primary',
                                                        );
                                                        setEditPrimaryAmount(
                                                            e.target.value,
                                                        );

                                                        if (!editCanCalc) {
                                                            return;
                                                        }

                                                        const p = Number(
                                                            e.target.value,
                                                        );

                                                        if (
                                                            !Number.isFinite(p)
                                                        ) {
                                                            return;
                                                        }

                                                        const s =
                                                            p * editParsedRate;
                                                        setEditSecondaryAmount(
                                                            e.target.value ===
                                                                ''
                                                                ? ''
                                                                : formatFixed(
                                                                      s,
                                                                      secondaryDecimals,
                                                                  ),
                                                        );
                                                    }}
                                                />
                                                <InputError
                                                    className="mt-0.5"
                                                    message={
                                                        errors.primary_amount
                                                    }
                                                />
                                            </div>

                                            <div className={TX_FIELD_COL}>
                                                <div className={TX_LABEL_WRAP}>
                                                    <Label
                                                        htmlFor="edit_secondary_amount"
                                                        className="leading-snug"
                                                    >
                                                        Secondary amount (
                                                        {secondaryCurrency})
                                                    </Label>
                                                </div>
                                                <Input
                                                    id="edit_secondary_amount"
                                                    name="secondary_amount"
                                                    type="text"
                                                    inputMode="decimal"
                                                    placeholder={formatFixed(
                                                        0,
                                                        secondaryDecimals,
                                                    )}
                                                    value={editSecondaryAmount}
                                                    onChange={(e) => {
                                                        setEditLastEdited(
                                                            'secondary',
                                                        );
                                                        setEditSecondaryAmount(
                                                            e.target.value,
                                                        );

                                                        if (!editCanCalc) {
                                                            return;
                                                        }

                                                        const s = Number(
                                                            e.target.value,
                                                        );

                                                        if (
                                                            !Number.isFinite(s)
                                                        ) {
                                                            return;
                                                        }

                                                        const p =
                                                            s / editParsedRate;
                                                        setEditPrimaryAmount(
                                                            e.target.value ===
                                                                ''
                                                                ? ''
                                                                : formatFixed(
                                                                      p,
                                                                      primaryDecimals,
                                                                  ),
                                                        );
                                                    }}
                                                />
                                                <InputError
                                                    className="mt-0.5"
                                                    message={
                                                        errors.secondary_amount
                                                    }
                                                />
                                            </div>

                                            <div className={TX_FIELD_COL}>
                                                <div className={TX_LABEL_WRAP}>
                                                    <Label
                                                        htmlFor="edit_occurred_on"
                                                        className="leading-snug"
                                                    >
                                                        Date
                                                    </Label>
                                                </div>
                                                <Input
                                                    id="edit_occurred_on"
                                                    name="occurred_on"
                                                    type="date"
                                                    required
                                                    value={editDate}
                                                    onChange={(e) =>
                                                        setEditDate(
                                                            e.target.value,
                                                        )
                                                    }
                                                />
                                                <InputError
                                                    className="mt-0.5"
                                                    message={
                                                        errors.occurred_on
                                                    }
                                                />
                                            </div>

                                            <div className={TX_FIELD_COL}>
                                                <div className={TX_LABEL_WRAP}>
                                                    <Label
                                                        htmlFor="edit_rate"
                                                        className="leading-snug"
                                                    >
                                                        Rate (1 {primaryCurrency}{' '}
                                                        = ? {secondaryCurrency})
                                                    </Label>
                                                </div>
                                                <Input
                                                    id="edit_rate"
                                                    name="rate"
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={editRate}
                                                    onChange={(e) =>
                                                        applyRateToEdit(
                                                            e.target.value,
                                                        )
                                                    }
                                                />
                                                <div className="mt-0.5 space-y-0.5">
                                                    <p className="text-xs leading-snug text-muted-foreground">
                                                        Loaded from your
                                                        configured API (you can
                                                        override).
                                                    </p>
                                                    <InputError
                                                        message={errors.rate}
                                                    />
                                                </div>
                                            </div>

                                            <div className={TX_FIELD_COL}>
                                                <div className={TX_LABEL_WRAP}>
                                                    <Label
                                                        htmlFor="edit_category_id"
                                                        className="leading-snug"
                                                    >
                                                        Category
                                                    </Label>
                                                </div>
                                                <input
                                                    type="hidden"
                                                    name="category_id"
                                                    value={editCategoryId}
                                                />
                                                <Select
                                                    value={editCategoryId}
                                                    onValueChange={
                                                        setEditCategoryId
                                                    }
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="Select category" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {editCategories.map(
                                                            (c) => (
                                                                <SelectItem
                                                                    key={c.id}
                                                                    value={String(
                                                                        c.id,
                                                                    )}
                                                                >
                                                                    {c.name}
                                                                </SelectItem>
                                                            ),
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                                <InputError
                                                    className="mt-0.5"
                                                    message={
                                                        errors.category_id
                                                    }
                                                />
                                            </div>

                                            <div className={TX_FIELD_COL}>
                                                <div className={TX_LABEL_WRAP}>
                                                    <Label
                                                        htmlFor="edit_type"
                                                        className="leading-snug"
                                                    >
                                                        Type
                                                    </Label>
                                                </div>
                                                <Select
                                                    value={editType}
                                                    onValueChange={changeEditType}
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="Select type" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {typeEntries.map(
                                                            ([
                                                                value,
                                                                label,
                                                            ]) => (
                                                                <SelectItem
                                                                    key={value}
                                                                    value={
                                                                        value
                                                                    }
                                                                >
                                                                    {label}
                                                                </SelectItem>
                                                            ),
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                                <InputError
                                                    className="mt-0.5"
                                                    message={errors.type}
                                                />
                                            </div>

                                            {(editType === 'payable' ||
                                                editType === 'receivable') && (
                                                <div
                                                    className={`${TX_FIELD_COL} md:col-span-2`}
                                                >
                                                    <div className={TX_LABEL_WRAP}>
                                                        <Label className="leading-snug">
                                                            Settled so far
                                                        </Label>
                                                    </div>
                                                    <div className="rounded-md border border-sidebar-border/70 bg-muted/20 px-3 py-2 text-sm tabular-nums">
                                                        {formatFixed(
                                                            Math.max(
                                                                0,
                                                                Number(
                                                                    editSettledAmount ||
                                                                        0,
                                                                ),
                                                            ),
                                                            primaryDecimals,
                                                        )}{' '}
                                                        {primaryCurrency}
                                                    </div>
                                                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                                                        Add or edit payments from
                                                        the transaction’s
                                                        settlement view.
                                                    </p>
                                                </div>
                                            )}

                                            <div
                                                className={`${TX_FIELD_COL} md:col-span-2`}
                                            >
                                                <div className={TX_LABEL_WRAP}>
                                                    <Label
                                                        htmlFor="edit_note"
                                                        className="leading-snug"
                                                    >
                                                        Note (optional)
                                                    </Label>
                                                </div>
                                                <Textarea
                                                    id="edit_note"
                                                    name="note"
                                                    placeholder="Write details..."
                                                    rows={3}
                                                    className="min-h-20 resize-y"
                                                    value={editNote}
                                                    onChange={(e) =>
                                                        setEditNote(
                                                            e.target.value,
                                                        )
                                                    }
                                                />
                                                <InputError
                                                    className="mt-0.5"
                                                    message={errors.note}
                                                />
                                            </div>
                                        </div>
                                        </div>

                                        <DialogFooter className="shrink-0 gap-2 border-t bg-background px-6 py-2">
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

TransactionsIndex.layout = {
    breadcrumbs: [
        {
            title: 'Transactions',
            href: transactionsIndex(),
        },
    ],
};
