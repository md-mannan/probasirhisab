<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Contact;
use App\Models\ExchangeRateSetting;
use App\Models\Transaction;
use App\Models\TransactionSettlement;
use App\Services\ExchangeRateService;
use App\Services\TransactionLedgerSync;
use App\Support\Currency;
use App\Support\PrimaryCashBalance;
use App\Support\SharedCatalog;
use App\Support\TransactionListSortOrder;
use App\Support\TransactionType;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class TransactionController extends Controller
{
    private function settlementStatusFromValues(string $type, float $amount, float $settled): ?string
    {
        if (! in_array($type, ['payable', 'receivable'], true)) {
            return null;
        }

        $total = abs($amount);
        if ($total <= 0) {
            return null;
        }

        if ($settled <= 0) {
            return 'unsettled';
        }

        if ($settled + 0.0000001 < $total) {
            return 'partial';
        }

        return 'settled';
    }

    private function settlementStatus(Transaction $t): ?string
    {
        if (! in_array($t->type, ['payable', 'receivable'], true)) {
            return null;
        }

        $total = abs((float) $t->amount);
        $settled = (float) ($t->settled_amount ?? 0);

        if ($total <= 0) {
            return null;
        }

        if ($settled <= 0) {
            return 'unsettled';
        }

        if ($settled + 0.0000001 < $total) {
            return 'partial';
        }

        return 'settled';
    }

    public function show(Request $request, Transaction $transaction): Response
    {
        $user = $request->user();

        if ($transaction->user_id !== $user->id) {
            abort(403);
        }

        $primaryCurrency = $user->primary_currency ?: 'KWD';
        $secondaryCurrency = $user->secondary_currency ?: 'BDT';

        $contacts = Contact::query()
            ->whereIn('user_id', SharedCatalog::visibleOwnerIds($user))
            ->orderBy('name', 'asc')
            ->get(['id', 'name']);

        $settlements = collect();
        if (in_array($transaction->type, ['payable', 'receivable'], true)) {
            $settlements = TransactionSettlement::query()
                ->where('transaction_id', $transaction->id)
                ->where('user_id', $user->id)
                ->orderBy('paid_on', 'desc')
                ->orderBy('id', 'desc')
                ->with('category:id,name,type')
                ->get()
                ->map(fn (TransactionSettlement $s) => [
                    'id' => $s->id,
                    'amount' => (string) $s->amount,
                    'paid_on' => $s->paid_on,
                    'source' => $s->source,
                    'note' => $s->note,
                    'category' => $s->category ? [
                        'id' => $s->category->id,
                        'name' => $s->category->name,
                        'type' => $s->category->type,
                    ] : null,
                ]);
        }

        $transaction->loadMissing(['category:id,name,type', 'contacts:id,name']);
        $computedSettled = null;
        if (in_array($transaction->type, ['payable', 'receivable'], true)) {
            $computedSettled = TransactionSettlement::query()
                ->where('transaction_id', $transaction->id)
                ->where('user_id', $user->id)
                ->sum('amount');
        }

        $settlementCategories = collect();
        $defaultSettlementCategoryId = null;
        if (in_array($transaction->type, ['payable', 'receivable'], true)) {
            $settlementCategoryType = $transaction->type === 'payable'
                ? 'settle_payable'
                : 'settle_receivable';
            $settlementCategories = Category::query()
                ->whereIn('user_id', SharedCatalog::visibleOwnerIds($user))
                ->where('type', $settlementCategoryType)
                ->orderBy('name', 'asc')
                ->get(['id', 'name', 'type'])
                ->values();

            $preferredName = $transaction->type === 'payable'
                ? 'ধারের টাকা ফেরত দিলাম'
                : 'ধারের পাওনা আদায়';

            $defaultSettlementCategoryId = $settlementCategories
                ->firstWhere('name', $preferredName)
                ?->id;

            if ($defaultSettlementCategoryId === null) {
                $defaultSettlementCategoryId = $settlementCategories->first()?->id;
            }
        }

        $categoriesByType = Category::query()
            ->whereIn('user_id', SharedCatalog::visibleOwnerIds($user))
            ->orderBy('type', 'asc')
            ->orderBy('name', 'asc')
            ->get(['id', 'name', 'type'])
            ->groupBy('type')
            ->map(fn ($items) => $items->values());

        return Inertia::render('transactions/show', [
            'types' => TransactionType::labels(),
            'primaryCurrency' => $primaryCurrency,
            'secondaryCurrency' => $secondaryCurrency,
            'primaryDecimals' => Currency::decimalsFor($primaryCurrency),
            'secondaryDecimals' => Currency::decimalsFor($secondaryCurrency),
            'contacts' => $contacts,
            'categoriesByType' => $categoriesByType,
            'settlementCategories' => $settlementCategories,
            'defaultSettlementCategoryId' => $defaultSettlementCategoryId,
            'transaction' => [
                'id' => $transaction->id,
                'type' => $transaction->type,
                'amount' => (string) $transaction->amount,
                'settled_amount' => $computedSettled === null ? null : (string) $computedSettled,
                'settlement_status' => $this->settlementStatus($transaction),
                'currency' => $transaction->currency,
                'secondary_amount' => $transaction->secondary_amount === null ? null : (string) $transaction->secondary_amount,
                'secondary_currency' => $transaction->secondary_currency,
                'rate' => $transaction->rate === null ? null : (string) $transaction->rate,
                'source' => $transaction->source,
                'occurred_on' => $transaction->occurred_on,
                'note' => $transaction->note,
                'contacts' => $transaction->contacts
                    ->map(fn (Contact $c) => ['id' => $c->id, 'name' => $c->name])
                    ->values(),
                'category' => $transaction->category ? [
                    'id' => $transaction->category->id,
                    'name' => $transaction->category->name,
                    'type' => $transaction->category->type,
                ] : null,
            ],
            'settlements' => $settlements,
        ]);
    }

    public function index(Request $request): Response
    {
        $user = $request->user();

        $primaryCurrency = $user->primary_currency ?: 'KWD';
        $secondaryCurrency = $user->secondary_currency ?: 'BDT';
        $primaryDecimals = Currency::decimalsFor($primaryCurrency);
        $secondaryDecimals = Currency::decimalsFor($secondaryCurrency);

        $contacts = Contact::query()
            ->whereIn('user_id', SharedCatalog::visibleOwnerIds($user))
            ->orderBy('name', 'asc')
            ->get(['id', 'name']);

        $defaultRate = null;
        $fx = ExchangeRateSetting::the();
        if (filled($fx->exchange_rate_api_url)) {
            $rate = app(ExchangeRateService::class)->getRate(
                $primaryCurrency,
                $secondaryCurrency,
                $fx->exchange_rate_api_url,
                $fx->exchange_rate_api_key,
            );

            if ($rate !== null) {
                $defaultRate = number_format($rate, $secondaryDecimals, '.', '');
            }
        }

        $transactions = Transaction::query()
            ->where('user_id', $user->id)
            ->with(['category:id,name,type', 'contacts:id,name'])
            ->withSum(['settlements as settlements_sum' => function ($q) use ($user) {
                $q->where('user_id', $user->id);
            }], 'amount')
            ->orderBy('sort_order')
            ->orderBy('occurred_on')
            ->orderBy('id')
            ->limit(600)
            ->get()
            ->map(function (Transaction $t) {
                $computedSettled = (float) ($t->settlements_sum ?? 0);

                return [
                    'id' => 't-'.$t->id,
                    'kind' => 'transaction',
                    'transaction_id' => $t->id,
                    'sort_order' => (int) ($t->sort_order ?? 0),
                    'type' => $t->type,
                    'amount' => (string) $t->amount,
                    'settled_amount' => in_array($t->type, ['payable', 'receivable'], true) ? (string) $computedSettled : null,
                    'settlement_status' => $this->settlementStatusFromValues(
                        $t->type,
                        (float) $t->amount,
                        $computedSettled,
                    ),
                    'currency' => $t->currency,
                    'secondary_amount' => $t->secondary_amount === null ? null : (string) $t->secondary_amount,
                    'secondary_currency' => $t->secondary_currency,
                    'rate' => $t->rate === null ? null : (string) $t->rate,
                    'source' => $t->source,
                    'occurred_on' => $t->occurred_on,
                    'note' => $t->note,
                    'contacts' => $t->contacts
                        ->map(fn (Contact $c) => ['id' => $c->id, 'name' => $c->name])
                        ->values(),
                    'category' => $t->category ? [
                        'id' => $t->category->id,
                        'name' => $t->category->name,
                        'type' => $t->category->type,
                    ] : null,
                ];
            });

        $settlements = TransactionSettlement::query()
            ->select('transaction_settlements.*')
            ->where('transaction_settlements.user_id', $user->id)
            ->whereHas('transaction', function ($q) use ($user): void {
                $q->where('transactions.user_id', $user->id)
                    ->whereIn('type', ['payable', 'receivable']);
            })
            ->join('transactions as t', 'transaction_settlements.transaction_id', '=', 't.id')
            ->with([
                'category:id,name,type',
                'transaction:id,type,sort_order,occurred_on,currency,secondary_currency,rate',
                'transaction.contacts:id,name',
            ])
            ->orderBy('transaction_settlements.sort_order')
            ->orderBy('paid_on')
            ->orderBy('transaction_settlements.id')
            ->limit(600)
            ->get()
            ->map(function (TransactionSettlement $s) {
                $t = $s->transaction;
                $isPayable = $t?->type === 'payable';
                $sign = $isPayable ? -1 : 1;
                $rate = $t?->rate === null ? null : (float) $t->rate;
                $secondary = ($rate !== null && $rate > 0)
                    ? (string) ((float) $s->amount * $rate)
                    : null;

                return [
                    'id' => 's-'.$s->id,
                    'kind' => 'settlement',
                    'settlement_id' => $s->id,
                    'transaction_id' => $s->transaction_id,
                    'sort_order' => (int) ($s->sort_order ?? 0),
                    'type' => $s->category?->type ?? 'settlement',
                    'amount' => (string) ($sign * (float) $s->amount),
                    'settled_amount' => null,
                    'settlement_status' => null,
                    'currency' => $t?->currency,
                    'secondary_amount' => $secondary,
                    'secondary_currency' => $t?->secondary_currency,
                    'rate' => $t?->rate === null ? null : (string) $t->rate,
                    'source' => $s->source,
                    'occurred_on' => $s->paid_on,
                    'note' => $s->note,
                    'contacts' => $t?->contacts
                        ? $t->contacts->map(fn (Contact $c) => ['id' => $c->id, 'name' => $c->name])->values()
                        : collect(),
                    'category' => $s->category ? [
                        'id' => $s->category->id,
                        'name' => $s->category->name,
                        'type' => $s->category->type,
                    ] : null,
                ];
            });

        $rows = $transactions->concat($settlements)->values();
        // LILO: list is ascending by sort_order (new rows get max+1 → bottom). Drag uses 1..n top-to-bottom.
        $rows = $rows->sort(function (array $a, array $b): int {
            $aSort = (int) ($a['sort_order'] ?? 0);
            $bSort = (int) ($b['sort_order'] ?? 0);
            if ($aSort !== $bSort) {
                return $aSort <=> $bSort;
            }

            $byDate = strcmp(
                (string) ($a['occurred_on'] ?? ''),
                (string) ($b['occurred_on'] ?? ''),
            );
            if ($byDate !== 0) {
                return $byDate;
            }

            return strcmp((string) ($a['id'] ?? ''), (string) ($b['id'] ?? ''));
        })->values();

        $categories = Category::query()
            ->whereIn('user_id', SharedCatalog::visibleOwnerIds($user))
            ->orderBy('type', 'asc')
            ->orderBy('name', 'asc')
            ->get(['id', 'name', 'type'])
            ->groupBy('type')
            ->map(fn ($items) => $items->values());

        $types = array_merge(TransactionType::labels(), [
            'settle_payable' => 'Settle payable',
            'settle_receivable' => 'Settle receivable',
            'settlement' => 'Settlement',
        ]);

        return Inertia::render('transactions/index', [
            'types' => $types,
            'categoriesByType' => $categories,
            'primaryCurrency' => $primaryCurrency,
            'secondaryCurrency' => $secondaryCurrency,
            'primaryDecimals' => $primaryDecimals,
            'secondaryDecimals' => $secondaryDecimals,
            'defaultRate' => $defaultRate,
            'contacts' => $contacts,
            'transactions' => $rows,
            'primaryCashBalance' => PrimaryCashBalance::forUserId($user->id),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'type' => ['required', 'string', Rule::in(TransactionType::values())],
            'category_id' => ['required', 'integer'],
            'contact_id' => ['nullable', 'integer'], // legacy single person
            'contact_ids' => ['nullable', 'array', 'max:10'],
            'contact_ids.*' => ['integer', 'distinct'],
            'primary_amount' => ['nullable', 'numeric'],
            'secondary_amount' => ['nullable', 'numeric'],
            'settled_amount' => ['nullable', 'numeric', 'min:0'],
            'rate' => ['nullable', 'numeric'],
            'occurred_on' => ['required', 'date'],
            'note' => ['nullable', 'string', 'max:5000'],
            'source' => ['nullable', 'string', 'max:255'],
        ]);

        $primaryCurrency = $user->primary_currency ?: 'KWD';
        $secondaryCurrency = $user->secondary_currency ?: 'BDT';

        $primaryAmount = array_key_exists('primary_amount', $data) ? $data['primary_amount'] : null;
        $secondaryAmount = array_key_exists('secondary_amount', $data) ? $data['secondary_amount'] : null;
        $settledAmount = array_key_exists('settled_amount', $data) ? $data['settled_amount'] : null;
        $rate = array_key_exists('rate', $data) ? $data['rate'] : null;

        if ($primaryAmount === null && $secondaryAmount === null) {
            return back()->withErrors([
                'primary_amount' => 'Enter an amount.',
                'secondary_amount' => 'Enter an amount.',
            ]);
        }

        if ($rate !== null && (float) $rate <= 0) {
            return back()->withErrors(['rate' => 'Rate must be greater than 0.']);
        }

        if ($rate !== null) {
            if ($primaryAmount !== null && $secondaryAmount === null) {
                $secondaryAmount = (float) $primaryAmount * (float) $rate;
            } elseif ($secondaryAmount !== null && $primaryAmount === null) {
                $primaryAmount = (float) $secondaryAmount / (float) $rate;
            }
        }

        $category = Category::query()
            ->where('id', $data['category_id'])
            ->whereIn('user_id', SharedCatalog::visibleOwnerIds($user))
            ->where('type', $data['type'])
            ->first();

        if (! $category) {
            return back()->withErrors([
                'category_id' => 'Please select a valid category.',
            ]);
        }

        $contactIds = [];
        if (! empty($data['contact_ids']) && is_array($data['contact_ids'])) {
            $contactIds = array_values(array_map('intval', $data['contact_ids']));
        } elseif (array_key_exists('contact_id', $data) && $data['contact_id'] !== null) {
            $contactIds = [(int) $data['contact_id']];
        }

        if (count($contactIds) > 0) {
            $owned = Contact::query()
                ->whereIn('user_id', SharedCatalog::visibleOwnerIds($user))
                ->whereIn('id', $contactIds, 'and', false)
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->all();

            sort($owned);
            $unique = array_values(array_unique($contactIds));
            sort($unique);
            if ($owned !== $unique) {
                return back()->withErrors([
                    'contact_ids' => 'Please select valid person(s).',
                ]);
            }
        }

        if (in_array($data['type'], ['payable', 'receivable'], true)) {
            $total = abs((float) ($primaryAmount ?? 0));
            $settled = (float) ($settledAmount ?? 0);
            if ($settled > $total + 0.0000001) {
                return back()->withErrors([
                    'settled_amount' => 'Settled amount cannot be greater than total amount.',
                ]);
            }
        } else {
            $settledAmount = null;
        }

        if (in_array($data['type'], ['expense', 'receivable'], true)) {
            $need = abs((float) ($primaryAmount ?? 0));
            $balance = PrimaryCashBalance::forUserId($user->id);
            if ($balance + 0.0000001 < $need) {
                return back()->withErrors([
                    'primary_amount' => __('You do not have enough cash for this transaction.'),
                ]);
            }
        }

        $transaction = Transaction::query()->create([
            'user_id' => $user->id,
            'type' => $data['type'],
            'category_id' => $category->id,
            'contact_id' => null, // legacy field; kept nullable
            'amount' => $primaryAmount,
            'secondary_amount' => $secondaryAmount,
            'settled_amount' => $settledAmount,
            'currency' => $primaryCurrency,
            'secondary_currency' => $secondaryCurrency,
            'rate' => $rate,
            'occurred_on' => $data['occurred_on'],
            'sort_order' => null,
            'note' => $data['note'] ? trim($data['note']) : null,
            'source' => $data['source'] ? trim($data['source']) : null,
        ]);

        $transaction->sort_order = TransactionListSortOrder::nextForUser($user->id);
        $transaction->save();

        if (count($contactIds) > 0) {
            $transaction->contacts()->syncWithPivotValues(
                $contactIds,
                ['user_id' => $user->id],
            );
        }

        app(TransactionLedgerSync::class)->syncForTransaction($transaction);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Transaction created.')]);

        return back();
    }

    public function update(Request $request, Transaction $transaction): RedirectResponse
    {
        $user = $request->user();

        if ($transaction->user_id !== $user->id) {
            abort(403);
        }

        $data = $request->validate([
            'type' => ['required', 'string', Rule::in(TransactionType::values())],
            'category_id' => ['required', 'integer'],
            'contact_id' => ['nullable', 'integer'], // legacy single person
            'contact_ids' => ['nullable', 'array', 'max:10'],
            'contact_ids.*' => ['integer', 'distinct'],
            'primary_amount' => ['nullable', 'numeric'],
            'secondary_amount' => ['nullable', 'numeric'],
            'settled_amount' => ['nullable', 'numeric', 'min:0'],
            'rate' => ['nullable', 'numeric'],
            'occurred_on' => ['required', 'date'],
            'note' => ['nullable', 'string', 'max:5000'],
            'source' => ['nullable', 'string', 'max:255'],
        ]);

        $primaryCurrency = $user->primary_currency ?: 'KWD';
        $secondaryCurrency = $user->secondary_currency ?: 'BDT';

        $primaryAmount = array_key_exists('primary_amount', $data) ? $data['primary_amount'] : null;
        $secondaryAmount = array_key_exists('secondary_amount', $data) ? $data['secondary_amount'] : null;
        $settledAmount = array_key_exists('settled_amount', $data) ? $data['settled_amount'] : null;
        $rate = array_key_exists('rate', $data) ? $data['rate'] : null;

        if ($primaryAmount === null && $secondaryAmount === null) {
            return back()->withErrors([
                'primary_amount' => 'Enter an amount.',
                'secondary_amount' => 'Enter an amount.',
            ]);
        }

        if ($rate !== null && (float) $rate <= 0) {
            return back()->withErrors(['rate' => 'Rate must be greater than 0.']);
        }

        if ($rate !== null) {
            if ($primaryAmount !== null && $secondaryAmount === null) {
                $secondaryAmount = (float) $primaryAmount * (float) $rate;
            } elseif ($secondaryAmount !== null && $primaryAmount === null) {
                $primaryAmount = (float) $secondaryAmount / (float) $rate;
            }
        }

        $category = Category::query()
            ->where('id', $data['category_id'])
            ->whereIn('user_id', SharedCatalog::visibleOwnerIds($user))
            ->where('type', $data['type'])
            ->first();

        if (! $category) {
            return back()->withErrors([
                'category_id' => 'Please select a valid category.',
            ]);
        }

        $contactIds = [];
        if (! empty($data['contact_ids']) && is_array($data['contact_ids'])) {
            $contactIds = array_values(array_map('intval', $data['contact_ids']));
        } elseif (array_key_exists('contact_id', $data) && $data['contact_id'] !== null) {
            $contactIds = [(int) $data['contact_id']];
        }

        if (count($contactIds) > 0) {
            $owned = Contact::query()
                ->whereIn('user_id', SharedCatalog::visibleOwnerIds($user))
                ->whereIn('id', $contactIds, 'and', false)
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->all();

            sort($owned);
            $unique = array_values(array_unique($contactIds));
            sort($unique);
            if ($owned !== $unique) {
                return back()->withErrors([
                    'contact_ids' => 'Please select valid person(s).',
                ]);
            }
        }

        if (in_array($data['type'], ['payable', 'receivable'], true)) {
            $total = abs((float) ($primaryAmount ?? 0));
            $settled = (float) ($settledAmount ?? 0);
            if ($settled > $total + 0.0000001) {
                return back()->withErrors([
                    'settled_amount' => 'Settled amount cannot be greater than total amount.',
                ]);
            }
        } else {
            $settledAmount = null;
        }

        if (in_array($data['type'], ['expense', 'receivable'], true)) {
            $need = abs((float) ($primaryAmount ?? 0));
            $balance = PrimaryCashBalance::forUserId($user->id);
            $oldOut = in_array($transaction->type, ['expense', 'receivable'], true)
                ? abs((float) $transaction->amount)
                : 0.0;
            $available = $balance + $oldOut;
            if ($available + 0.0000001 < $need) {
                return back()->withErrors([
                    'primary_amount' => __('You do not have enough cash for this transaction.'),
                ]);
            }
        }

        $transaction->fill([
            'type' => $data['type'],
            'category_id' => $category->id,
            'contact_id' => null,
            'amount' => $primaryAmount,
            'secondary_amount' => $secondaryAmount,
            'settled_amount' => $settledAmount,
            'currency' => $primaryCurrency,
            'secondary_currency' => $secondaryCurrency,
            'rate' => $rate,
            'occurred_on' => $data['occurred_on'],
            'note' => $data['note'] ? trim($data['note']) : null,
            'source' => $data['source'] ? trim($data['source']) : null,
        ]);

        $transaction->saveOrFail();

        $transaction->contacts()->syncWithPivotValues(
            $contactIds,
            ['user_id' => $user->id],
        );

        app(TransactionLedgerSync::class)->syncForTransaction($transaction);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Transaction updated.')]);

        return back();
    }

    public function destroy(Request $request, Transaction $transaction): RedirectResponse
    {
        if ($transaction->user_id !== $request->user()->id) {
            abort(403);
        }

        $transaction->deleteOrFail();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Transaction deleted.')]);

        return to_route('transactions.index');
    }

    public function reorder(Request $request): RedirectResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:200'],
            'ids.*' => ['integer', 'distinct'],
        ]);

        /** @var array<int,int> $ids */
        $ids = array_values(array_map('intval', $data['ids']));

        $ownedCount = Transaction::query()
            ->where('user_id', $user->id)
            ->whereIn('id', $ids, 'and', false)
            ->count('*');

        if ($ownedCount !== count($ids)) {
            abort(403);
        }

        DB::transaction(function () use ($user, $ids): void {
            foreach ($ids as $i => $id) {
                Transaction::query()
                    ->where('user_id', $user->id)
                    ->where('id', $id)
                    ->update(['sort_order' => $i + 1]);
            }
        }, 3);

        return back();
    }

    public function reorderRows(Request $request): RedirectResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:600'],
            'ids.*' => ['string', 'distinct'],
        ]);

        /** @var array<int,string> $ids */
        $ids = array_values(array_map('strval', $data['ids']));

        $txIds = [];
        $settlementIds = [];
        foreach ($ids as $raw) {
            if (str_starts_with($raw, 't-')) {
                $txIds[] = (int) substr($raw, 2);
            } elseif (str_starts_with($raw, 's-')) {
                $settlementIds[] = (int) substr($raw, 2);
            } else {
                abort(422);
            }
        }

        $txIds = array_values(array_filter($txIds, fn ($id) => $id > 0));
        $settlementIds = array_values(array_filter($settlementIds, fn ($id) => $id > 0));

        $ownedTxCount = count($txIds) === 0 ? 0 : Transaction::query()
            ->where('user_id', $user->id)
            ->whereIn('id', $txIds, 'and', false)
            ->count('*');

        $ownedSettlementCount = count($settlementIds) === 0 ? 0 : TransactionSettlement::query()
            ->where('user_id', $user->id)
            ->whereIn('id', $settlementIds, 'and', false)
            ->count('*');

        if ($ownedTxCount !== count($txIds) || $ownedSettlementCount !== count($settlementIds)) {
            abort(403);
        }

        DB::transaction(function () use ($user, $ids): void {
            foreach ($ids as $i => $raw) {
                $order = $i + 1;
                if (str_starts_with($raw, 't-')) {
                    $id = (int) substr($raw, 2);
                    Transaction::query()
                        ->where('user_id', $user->id)
                        ->where('id', $id)
                        ->update(['sort_order' => $order]);
                } else {
                    $id = (int) substr($raw, 2);
                    TransactionSettlement::query()
                        ->where('user_id', $user->id)
                        ->where('id', $id)
                        ->update(['sort_order' => $order]);
                }
            }
        }, 3);

        return back();
    }
}
