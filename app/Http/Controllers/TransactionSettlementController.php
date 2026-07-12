<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Transaction;
use App\Models\TransactionSettlement;
use App\Services\TransactionLedgerSync;
use App\Support\PrimaryCashBalance;
use App\Support\SharedCatalog;
use App\Support\TransactionListSortOrder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class TransactionSettlementController extends Controller
{
    private function settlementCategoryTypeFor(Transaction $transaction): string
    {
        return $transaction->type === 'payable'
            ? 'settle_payable'
            : 'settle_receivable';
    }

    public function store(Request $request, Transaction $transaction): RedirectResponse
    {
        $user = $request->user();

        if ($transaction->user_id !== $user->id) {
            abort(403);
        }

        if (! in_array($transaction->type, ['payable', 'receivable'], true)) {
            return back()->withErrors([
                'settlement_amount' => 'Settlement is only available for Payable/Receivable.',
            ]);
        }

        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.000001'],
            'paid_on' => ['required', 'date'],
            'category_id' => ['required', 'integer'],
            'source' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string', 'max:65535'],
        ]);

        $expectedCategoryType = $this->settlementCategoryTypeFor($transaction);
        $category = Category::query()
            ->where('id', $data['category_id'])
            ->whereIn('user_id', SharedCatalog::visibleOwnerIds($user))
            ->where('type', $expectedCategoryType)
            ->first();
        if (! $category) {
            return back()->withErrors([
                'category_id' => 'Please select a valid category.',
            ]);
        }

        $total = abs((float) $transaction->amount);
        $current = (float) ($transaction->settled_amount ?? 0);
        $add = (float) $data['amount'];

        if ($current + $add > $total + 0.0000001) {
            return back()->withErrors([
                'amount' => 'Payment exceeds remaining amount.',
            ]);
        }

        if ($transaction->type === 'payable') {
            $cash = PrimaryCashBalance::forUserId($user->id);
            if ($cash + 0.0000001 < $add) {
                return back()->withErrors([
                    'amount' => __('You do not have enough cash to record this payment.'),
                ]);
            }
        }

        // Create the settlement, recompute the denormalized total, and re-sync the
        // ledger atomically. The obligation row is locked first so the guards above
        // can't be raced by a concurrent settlement (which would over-settle or
        // overspend cash). Guard failures throw ValidationException → same error
        // bag Inertia rendered before, and roll the whole thing back.
        DB::transaction(function () use ($user, $transaction, $category, $data, $add) {
            $locked = Transaction::query()->whereKey($transaction->id)->lockForUpdate()->firstOrFail();

            $total = abs((float) $locked->amount);
            $current = (float) ($locked->settled_amount ?? 0);

            if ($current + $add > $total + 0.0000001) {
                throw ValidationException::withMessages(['amount' => 'Payment exceeds remaining amount.']);
            }

            if ($locked->type === 'payable') {
                $cash = PrimaryCashBalance::forUserId($user->id);
                if ($cash + 0.0000001 < $add) {
                    throw ValidationException::withMessages([
                        'amount' => __('You do not have enough cash to record this payment.'),
                    ]);
                }
            }

            TransactionSettlement::query()->create([
                'transaction_id' => $locked->id,
                'user_id' => $user->id,
                'category_id' => $category->id,
                'sort_order' => TransactionListSortOrder::nextForUser($user->id),
                'amount' => $add,
                'paid_on' => $data['paid_on'],
                'source' => ($data['source'] ?? null) ? trim($data['source']) : null,
                'note' => ($data['note'] ?? null) ? trim($data['note']) : null,
            ]);

            $locked->settled_amount = TransactionSettlement::query()
                ->where('transaction_id', $locked->id)
                ->where('user_id', $user->id)
                ->sum('amount');
            $locked->saveOrFail();

            app(TransactionLedgerSync::class)->syncForTransaction($locked->fresh(['settlements']));
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Settlement added.')]);

        return back();
    }

    public function update(Request $request, Transaction $transaction, TransactionSettlement $settlement): RedirectResponse
    {
        $user = $request->user();

        if ($transaction->user_id !== $user->id) {
            abort(403);
        }

        if ($settlement->transaction_id !== $transaction->id || $settlement->user_id !== $user->id) {
            abort(404);
        }

        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.000001'],
            'paid_on' => ['required', 'date'],
            'category_id' => ['required', 'integer'],
            'source' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string', 'max:65535'],
        ]);

        $expectedCategoryType = $this->settlementCategoryTypeFor($transaction);
        $category = Category::query()
            ->where('id', $data['category_id'])
            ->whereIn('user_id', SharedCatalog::visibleOwnerIds($user))
            ->where('type', $expectedCategoryType)
            ->first();
        if (! $category) {
            return back()->withErrors([
                'category_id' => 'Please select a valid category.',
            ]);
        }

        $total = abs((float) $transaction->amount);
        $otherSum = (float) $transaction->settlements()
            ->where('id', '!=', $settlement->id)
            ->sum('amount');
        $nextAmount = (float) $data['amount'];

        if ($otherSum + $nextAmount > $total + 0.0000001) {
            return back()->withErrors([
                'amount' => 'Payment exceeds remaining amount.',
            ]);
        }

        if ($transaction->type === 'payable') {
            $cash = PrimaryCashBalance::forUserId($user->id);
            $previous = (float) $settlement->amount;
            $available = $cash + $previous;
            if ($available + 0.0000001 < $nextAmount) {
                return back()->withErrors([
                    'amount' => __('You do not have enough cash to record this payment.'),
                ]);
            }
        }

        // Update the settlement, recompute the total, and re-sync the ledger atomically
        // under a row lock (see store() for rationale).
        DB::transaction(function () use ($user, $transaction, $settlement, $category, $data, $nextAmount) {
            $locked = Transaction::query()->whereKey($transaction->id)->lockForUpdate()->firstOrFail();

            $total = abs((float) $locked->amount);
            $otherSum = (float) $locked->settlements()
                ->where('id', '!=', $settlement->id)
                ->sum('amount');

            if ($otherSum + $nextAmount > $total + 0.0000001) {
                throw ValidationException::withMessages(['amount' => 'Payment exceeds remaining amount.']);
            }

            if ($locked->type === 'payable') {
                $cash = PrimaryCashBalance::forUserId($user->id);
                $available = $cash + (float) $settlement->amount;
                if ($available + 0.0000001 < $nextAmount) {
                    throw ValidationException::withMessages([
                        'amount' => __('You do not have enough cash to record this payment.'),
                    ]);
                }
            }

            $settlement->fill([
                'category_id' => $category->id,
                'amount' => $nextAmount,
                'paid_on' => $data['paid_on'],
                'source' => ($data['source'] ?? null) ? trim($data['source']) : null,
                'note' => ($data['note'] ?? null) ? trim($data['note']) : null,
            ]);
            $settlement->saveOrFail();

            $locked->settled_amount = TransactionSettlement::query()
                ->where('transaction_id', $locked->id)
                ->where('user_id', $user->id)
                ->sum('amount');
            $locked->saveOrFail();

            app(TransactionLedgerSync::class)->syncForTransaction($locked->fresh(['settlements']));
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Settlement updated.')]);

        return back();
    }

    public function destroy(Request $request, Transaction $transaction, TransactionSettlement $settlement): RedirectResponse
    {
        $user = $request->user();

        if ($transaction->user_id !== $user->id) {
            abort(403);
        }

        if ($settlement->transaction_id !== $transaction->id || $settlement->user_id !== $user->id) {
            abort(404);
        }

        // Delete the settlement, recompute the total, and re-sync the ledger atomically.
        DB::transaction(function () use ($user, $transaction, $settlement) {
            $locked = Transaction::query()->whereKey($transaction->id)->lockForUpdate()->firstOrFail();

            $settlement->deleteOrFail();

            $locked->settled_amount = TransactionSettlement::query()
                ->where('transaction_id', $locked->id)
                ->where('user_id', $user->id)
                ->sum('amount');
            $locked->saveOrFail();

            app(TransactionLedgerSync::class)->syncForTransaction($locked->fresh(['settlements']));
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Settlement removed.')]);

        return back();
    }
}
