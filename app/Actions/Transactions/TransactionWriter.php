<?php

namespace App\Actions\Transactions;

use App\Models\Category;
use App\Models\Contact;
use App\Models\Transaction;
use App\Models\TransactionSettlement;
use App\Models\User;
use App\Services\TransactionLedgerSync;
use App\Support\Money;
use App\Support\PrimaryCashBalance;
use App\Support\SharedCatalog;
use App\Support\TransactionListSortOrder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Shared create/update pipeline for transactions. Centralizes amount derivation,
 * category/contact authorization, settled/cash guards, persistence and ledger sync,
 * so TransactionController@store and @update do not duplicate ~130 lines each.
 *
 * Business-rule failures throw ValidationException, which Inertia renders exactly
 * like the previous `back()->withErrors()` responses (same error keys/messages).
 */
class TransactionWriter
{
    public function __construct(private readonly TransactionLedgerSync $ledgerSync) {}

    /**
     * Create a new transaction for the user.
     *
     * @param  array<string, mixed>  $data  Validated request data.
     */
    public function create(User $user, array $data): Transaction
    {
        return $this->persist($user, $data, null);
    }

    /**
     * Update an existing transaction owned by the user.
     *
     * @param  array<string, mixed>  $data  Validated request data.
     */
    public function update(User $user, Transaction $transaction, array $data): Transaction
    {
        return $this->persist($user, $data, $transaction);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function persist(User $user, array $data, ?Transaction $transaction): Transaction
    {
        $isUpdate = $transaction !== null;
        $isObligation = in_array($data['type'], ['payable', 'receivable'], true);

        $primaryCurrency = $user->primary_currency ?: 'KWD';
        $secondaryCurrency = $user->secondary_currency ?: 'BDT';

        [$primaryAmount, $secondaryAmount, $rate] = $this->resolveAmounts($data, $primaryCurrency, $secondaryCurrency);

        $category = $this->resolveCategory($user, $data);
        $contactIds = $this->resolveContactIds($user, $data);

        // The opening "already settled" amount is only meaningful when creating an
        // obligation. On update, settlements are the single source of truth, so the
        // form value is ignored and we only guard against the total dropping below
        // what has already been settled.
        $openingSettled = $isUpdate || ! $isObligation
            ? null
            : $this->resolveOpeningSettled($data, $primaryAmount);

        if ($isUpdate && $isObligation) {
            $this->assertTotalCoversSettlements($transaction, $primaryAmount);
        }

        $this->assertSufficientCash($user, $data['type'], $primaryAmount, $transaction);

        $attributes = [
            'type' => $data['type'],
            'category_id' => $category->id,
            'contact_id' => null, // legacy field; kept nullable
            'amount' => $primaryAmount,
            'secondary_amount' => $secondaryAmount,
            // settled_amount is always derived from settlement records below; never
            // taken from the form (which would drop an opening amount on later edits).
            'settled_amount' => null,
            'currency' => $primaryCurrency,
            'secondary_currency' => $secondaryCurrency,
            'rate' => $rate,
            'occurred_on' => $data['occurred_on'],
            'note' => ($data['note'] ?? null) ? trim($data['note']) : null,
            'source' => ($data['source'] ?? null) ? trim($data['source']) : null,
        ];

        // All writes (transaction row, sort_order, contacts pivot, opening settlement,
        // settled_amount recompute, ledger sync) must land together or not at all —
        // a partial write would desync the ledger from settled_amount and corrupt the
        // derived cash balance.
        return DB::transaction(function () use (
            $user, $transaction, $isUpdate, $attributes, $contactIds, $openingSettled
        ): Transaction {
            if ($isUpdate) {
                $transaction->fill($attributes);
                $transaction->saveOrFail();
            } else {
                $transaction = Transaction::query()->create([
                    'user_id' => $user->id,
                    'sort_order' => null,
                    ...$attributes,
                ]);

                $transaction->sort_order = TransactionListSortOrder::nextForUser($user->id);
                $transaction->save();
            }

            // On create we only sync the pivot when contacts were supplied (preserves the
            // original behaviour where creating without contacts skips the sync entirely).
            if ($isUpdate || count($contactIds) > 0) {
                $transaction->contacts()->syncWithPivotValues(
                    $contactIds,
                    ['user_id' => $user->id],
                );
            }

            if ($openingSettled !== null && $openingSettled > 0) {
                $this->createOpeningSettlement($user, $transaction, $openingSettled);
            }

            // Keep the denormalized column in step with the settlement records so every
            // surface (list, detail, dashboard, balance sheet) reports the same figure.
            $this->recomputeSettledAmount($transaction);

            $this->ledgerSync->syncForTransaction($transaction->fresh(['settlements']) ?? $transaction);

            return $transaction;
        });
    }

    /** Recompute settled_amount as the sum of settlement records for the transaction. */
    private function recomputeSettledAmount(Transaction $transaction): void
    {
        if (! in_array($transaction->type, ['payable', 'receivable'], true)) {
            if ($transaction->settled_amount !== null) {
                $transaction->settled_amount = null;
                $transaction->saveOrFail();
            }

            return;
        }

        $sum = (float) TransactionSettlement::query()
            ->where('transaction_id', $transaction->id)
            ->sum('amount');

        $transaction->settled_amount = $sum;
        $transaction->saveOrFail();
    }

    /** Persist the opening amount as a real settlement dated on the transaction date. */
    private function createOpeningSettlement(User $user, Transaction $transaction, float $amount): void
    {
        TransactionSettlement::query()->create([
            'transaction_id' => $transaction->id,
            'user_id' => $user->id,
            'category_id' => $this->defaultSettlementCategoryId($user, $transaction->type),
            'sort_order' => TransactionListSortOrder::nextForUser($user->id),
            'amount' => $amount,
            'paid_on' => $transaction->occurred_on,
            'source' => null,
            'note' => null,
        ]);
    }

    /** Preferred settle_* category for the obligation type, or null when none exist. */
    private function defaultSettlementCategoryId(User $user, string $type): ?int
    {
        $settlementType = $type === 'payable' ? 'settle_payable' : 'settle_receivable';

        $categories = Category::query()
            ->whereIn('user_id', SharedCatalog::visibleOwnerIds($user))
            ->where('type', $settlementType)
            ->orderBy('name', 'asc')
            ->get(['id', 'name']);

        $preferredName = $type === 'payable'
            ? 'ধারের টাকা ফেরত দিলাম'
            : 'ধারের পাওনা আদায়';

        return $categories->firstWhere('name', $preferredName)?->id
            ?? $categories->first()?->id;
    }

    /**
     * Derive the missing primary/secondary amount from the rate when only one side
     * is provided. Each derived side is rounded to its own currency's decimals (KWD=3,
     * BDT=2), not a flat scale. Returns [primaryAmount, secondaryAmount, rate].
     *
     * @param  array<string, mixed>  $data
     * @return array{0: float|null, 1: float|null, 2: float|null}
     */
    private function resolveAmounts(array $data, string $primaryCurrency, string $secondaryCurrency): array
    {
        $primaryAmount = array_key_exists('primary_amount', $data) ? $data['primary_amount'] : null;
        $secondaryAmount = array_key_exists('secondary_amount', $data) ? $data['secondary_amount'] : null;
        $rate = array_key_exists('rate', $data) ? $data['rate'] : null;

        if ($primaryAmount === null && $secondaryAmount === null) {
            throw ValidationException::withMessages([
                'primary_amount' => 'Enter an amount.',
                'secondary_amount' => 'Enter an amount.',
            ]);
        }

        if ($rate !== null && (float) $rate <= 0) {
            throw ValidationException::withMessages([
                'rate' => 'Rate must be greater than 0.',
            ]);
        }

        if ($rate !== null) {
            if ($primaryAmount !== null && $secondaryAmount === null) {
                $secondaryAmount = Money::roundFor((float) $primaryAmount * (float) $rate, $secondaryCurrency);
            } elseif ($secondaryAmount !== null && $primaryAmount === null) {
                $primaryAmount = Money::roundFor((float) $secondaryAmount / (float) $rate, $primaryCurrency);
            }
        }

        return [$primaryAmount, $secondaryAmount, $rate];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function resolveCategory(User $user, array $data): Category
    {
        $category = Category::query()
            ->where('id', $data['category_id'])
            ->whereIn('user_id', SharedCatalog::visibleOwnerIds($user))
            ->where('type', $data['type'])
            ->first();

        if (! $category) {
            throw ValidationException::withMessages([
                'category_id' => 'Please select a valid category.',
            ]);
        }

        return $category;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return list<int>
     */
    private function resolveContactIds(User $user, array $data): array
    {
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
                throw ValidationException::withMessages([
                    'contact_ids' => 'Please select valid person(s).',
                ]);
            }
        }

        return $contactIds;
    }

    /**
     * The opening "already settled" amount supplied at creation. Applies only to
     * payable/receivable and cannot exceed the total. Returns the amount (or null).
     *
     * @param  array<string, mixed>  $data
     */
    private function resolveOpeningSettled(array $data, ?float $primaryAmount): ?float
    {
        $settledAmount = array_key_exists('settled_amount', $data) ? $data['settled_amount'] : null;

        if ($settledAmount === null) {
            return null;
        }

        $total = abs((float) ($primaryAmount ?? 0));
        $settled = (float) $settledAmount;
        if (Money::greaterThan($settled, $total)) {
            throw ValidationException::withMessages([
                'settled_amount' => 'Settled amount cannot be greater than total amount.',
            ]);
        }

        return $settled;
    }

    /**
     * When editing an obligation, the new total must still cover everything already
     * settled via settlement records; otherwise the row would become over-settled.
     */
    private function assertTotalCoversSettlements(Transaction $transaction, ?float $primaryAmount): void
    {
        $alreadySettled = (float) TransactionSettlement::query()
            ->where('transaction_id', $transaction->id)
            ->sum('amount');

        $total = abs((float) ($primaryAmount ?? 0));

        if (Money::greaterThan($alreadySettled, $total)) {
            throw ValidationException::withMessages([
                'primary_amount' => 'Total cannot be less than the amount already settled.',
            ]);
        }
    }

    /**
     * Expense/receivable consume cash. On update, credit back the transaction's own
     * previous outflow before checking (matches the original update guard).
     */
    private function assertSufficientCash(
        User $user,
        string $type,
        ?float $primaryAmount,
        ?Transaction $transaction,
    ): void {
        if (! in_array($type, ['expense', 'receivable'], true)) {
            return;
        }

        $need = abs((float) ($primaryAmount ?? 0));
        $balance = PrimaryCashBalance::forUserId($user->id);

        $oldOut = 0.0;
        if ($transaction !== null && in_array($transaction->type, ['expense', 'receivable'], true)) {
            $oldOut = abs((float) $transaction->amount);
        }

        $available = $balance + $oldOut;
        if (Money::lessThan($available, $need)) {
            throw ValidationException::withMessages([
                'primary_amount' => __('You do not have enough cash for this transaction.'),
            ]);
        }
    }
}
