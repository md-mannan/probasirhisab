<?php

use App\Models\Category;
use App\Models\Transaction;
use App\Models\TransactionSettlement;
use App\Services\TransactionLedgerSync;
use App\Support\TransactionListSortOrder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

/**
 * Convert legacy opening "already settled" amounts into real settlement records.
 *
 * Previously a payable/receivable created with settled_amount > 0 stored that value
 * only in the denormalized column: it never posted to the ledger (so it did not
 * affect cash) and was dropped the moment a real settlement was added. Going forward
 * TransactionWriter records the opening amount as a settlement; this backfills the
 * same for existing rows so every surface and the cash balance are consistent.
 *
 * Only rows with an opening amount and NO settlement records are touched, so it is
 * safe to re-run. It intentionally shifts affected cash balances to the correct value.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('transactions') || ! Schema::hasTable('transaction_settlements')) {
            return;
        }

        $sync = app(TransactionLedgerSync::class);

        Transaction::query()
            ->whereIn('type', ['payable', 'receivable'])
            ->whereNotNull('settled_amount')
            ->where('settled_amount', '>', 0)
            ->whereDoesntHave('settlements')
            ->chunkById(200, function ($transactions) use ($sync): void {
                foreach ($transactions as $transaction) {
                    TransactionSettlement::query()->create([
                        'transaction_id' => $transaction->id,
                        'user_id' => $transaction->user_id,
                        'category_id' => $this->defaultSettlementCategoryId($transaction),
                        'sort_order' => TransactionListSortOrder::nextForUser($transaction->user_id),
                        'amount' => $transaction->settled_amount,
                        'paid_on' => $transaction->occurred_on,
                        'source' => null,
                        'note' => null,
                    ]);

                    // settled_amount already equals the opening amount, so it stays in
                    // step with the new settlement record. Re-sync posts the ledger line.
                    $sync->syncForTransaction($transaction->fresh(['settlements']) ?? $transaction);
                }
            });
    }

    public function down(): void
    {
        // Non-reversible data migration (mirrors prune_orphan_ledger_entries).
    }

    private function defaultSettlementCategoryId(Transaction $transaction): ?int
    {
        $settlementType = $transaction->type === 'payable' ? 'settle_payable' : 'settle_receivable';

        $preferredName = $transaction->type === 'payable'
            ? 'ধারের টাকা ফেরত দিলাম'
            : 'ধারের পাওনা আদায়';

        $categories = Category::query()
            ->where('user_id', $transaction->user_id)
            ->where('type', $settlementType)
            ->orderBy('name')
            ->get(['id', 'name']);

        return $categories->firstWhere('name', $preferredName)?->id
            ?? $categories->first()?->id;
    }
};
