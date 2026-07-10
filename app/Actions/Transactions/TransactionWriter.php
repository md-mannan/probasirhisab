<?php

namespace App\Actions\Transactions;

use App\Models\Category;
use App\Models\Contact;
use App\Models\Transaction;
use App\Models\User;
use App\Services\TransactionLedgerSync;
use App\Support\Money;
use App\Support\PrimaryCashBalance;
use App\Support\SharedCatalog;
use App\Support\TransactionListSortOrder;
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

        $primaryCurrency = $user->primary_currency ?: 'KWD';
        $secondaryCurrency = $user->secondary_currency ?: 'BDT';

        [$primaryAmount, $secondaryAmount, $rate] = $this->resolveAmounts($data);

        $category = $this->resolveCategory($user, $data);
        $contactIds = $this->resolveContactIds($user, $data);

        $settledAmount = $this->resolveSettledAmount($data, $primaryAmount);

        $this->assertSufficientCash($user, $data['type'], $primaryAmount, $transaction);

        $attributes = [
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
            'note' => ($data['note'] ?? null) ? trim($data['note']) : null,
            'source' => ($data['source'] ?? null) ? trim($data['source']) : null,
        ];

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

        $this->ledgerSync->syncForTransaction($transaction);

        return $transaction;
    }

    /**
     * Derive the missing primary/secondary amount from the rate when only one side
     * is provided. Returns [primaryAmount, secondaryAmount, rate].
     *
     * @param  array<string, mixed>  $data
     * @return array{0: float|null, 1: float|null, 2: float|null}
     */
    private function resolveAmounts(array $data): array
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
                $secondaryAmount = Money::round((float) $primaryAmount * (float) $rate);
            } elseif ($secondaryAmount !== null && $primaryAmount === null) {
                $primaryAmount = Money::round((float) $secondaryAmount / (float) $rate);
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
     * Settled amount only applies to payable/receivable and cannot exceed the total.
     *
     * @param  array<string, mixed>  $data
     */
    private function resolveSettledAmount(array $data, ?float $primaryAmount): ?float
    {
        if (! in_array($data['type'], ['payable', 'receivable'], true)) {
            return null;
        }

        $settledAmount = array_key_exists('settled_amount', $data) ? $data['settled_amount'] : null;

        $total = abs((float) ($primaryAmount ?? 0));
        $settled = (float) ($settledAmount ?? 0);
        if (Money::greaterThan($settled, $total)) {
            throw ValidationException::withMessages([
                'settled_amount' => 'Settled amount cannot be greater than total amount.',
            ]);
        }

        return $settledAmount;
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
