<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // This migration may have partially run before (DDL is not transactional in MySQL),
        // so we guard on column presence to avoid duplicate index/constraint errors.
        if (! Schema::hasColumn('ledger_entries', 'settlement_id')) {
            if (DB::getDriverName() === 'sqlite') {
                /*
                 * SQLite cannot drop foreign keys by name. It also rebuilds the whole
                 * table for schema changes, so we simply add the new column + composite
                 * unique; the original single-column unique is dropped in its own call.
                 */
                Schema::table('ledger_entries', function (Blueprint $table) {
                    $table->foreignId('settlement_id')
                        ->nullable()
                        ->after('transaction_id')
                        ->constrained('transaction_settlements')
                        ->cascadeOnDelete();
                });

                Schema::table('ledger_entries', function (Blueprint $table) {
                    $table->dropUnique(['transaction_id']);
                    $table->unique(['transaction_id', 'settlement_id']);
                });
            } else {
                Schema::table('ledger_entries', function (Blueprint $table) {
                    /*
                     * MySQL cannot drop the unique index `ledger_entries_transaction_id_unique`
                     * while the foreign key on `transaction_id` still depends on it.
                     * Drop the FK first, then rebuild it after the new composite unique exists.
                     */
                    foreach (Schema::getForeignKeys('ledger_entries') as $foreignKey) {
                        $cols = $foreignKey['columns'] ?? [];

                        if ($cols === ['transaction_id']) {
                            $table->dropForeign($foreignKey['name']);
                        }
                    }

                    // Allow multiple ledger entries per transaction (base + settlement lines)
                    $table->dropUnique(['transaction_id']);
                    $table->foreignId('settlement_id')
                        ->nullable()
                        ->after('transaction_id')
                        ->constrained('transaction_settlements')
                        ->cascadeOnDelete();
                    $table->unique(['transaction_id', 'settlement_id']);

                    $table->foreign('transaction_id')
                        ->references('id')
                        ->on('transactions')
                        ->cascadeOnDelete();
                });
            }
        }

        // Rebuild ledger entries using accounting-correct rules.
        if (! Schema::hasTable('transactions')) {
            return;
        }

        DB::table('ledger_entries')->delete();

        $transactions = DB::table('transactions')->select([
            'id',
            'user_id',
            'type',
            'amount',
            'currency',
            'secondary_amount',
            'secondary_currency',
            'occurred_on',
            'note',
        ])->orderBy('occurred_on')->orderBy('id')->get();

        $settlementsByTx = [];
        if (Schema::hasTable('transaction_settlements')) {
            $settlements = DB::table('transaction_settlements')
                ->select(['id', 'transaction_id', 'user_id', 'amount', 'paid_on', 'note'])
                ->orderBy('paid_on')
                ->orderBy('id')
                ->get();

            foreach ($settlements as $s) {
                $settlementsByTx[$s->transaction_id] ??= [];
                $settlementsByTx[$s->transaction_id][] = $s;
            }
        }

        $now = now();

        foreach ($transactions as $t) {
            $primary = abs((float) $t->amount);
            $secondary = $t->secondary_amount === null ? null : abs((float) $t->secondary_amount);

            $debitPrimary = 0.0;
            $creditPrimary = 0.0;
            $debitSecondary = null;
            $creditSecondary = null;

            // Base transaction cash impact:
            // - income: cash + (credit)
            // - expense: cash - (debit)
            // - payable (borrow): cash + (credit)
            // - receivable (lend): cash - (debit)
            if (in_array($t->type, ['income', 'payable'], true)) {
                $creditPrimary = $primary;
                $creditSecondary = $secondary;
                $debitSecondary = $secondary !== null ? 0.0 : null;
            } elseif (in_array($t->type, ['expense', 'receivable'], true)) {
                $debitPrimary = $primary;
                $debitSecondary = $secondary;
                $creditSecondary = $secondary !== null ? 0.0 : null;
            } else {
                // Unknown type: skip
                continue;
            }

            DB::table('ledger_entries')->insert([
                'user_id' => $t->user_id,
                'transaction_id' => $t->id,
                'settlement_id' => null,
                'occurred_on' => $t->occurred_on,
                'type' => $t->type,
                'description' => $t->note,
                'primary_amount' => $primary,
                'primary_currency' => $t->currency,
                'secondary_amount' => $t->secondary_amount,
                'secondary_currency' => $t->secondary_currency,
                'debit_primary' => $debitPrimary,
                'credit_primary' => $creditPrimary,
                'debit_secondary' => $debitSecondary,
                'credit_secondary' => $creditSecondary,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            // Settlement lines (only for payable/receivable)
            if (! in_array($t->type, ['payable', 'receivable'], true)) {
                continue;
            }

            $txSettlements = $settlementsByTx[$t->id] ?? [];

            foreach ($txSettlements as $s) {
                $payPrimary = abs((float) $s->amount);

                // Derive secondary from transaction ratio when available.
                $paySecondary = null;
                if ($t->secondary_amount !== null && (float) $t->amount !== 0.0) {
                    $ratio = (float) $t->secondary_amount / (float) $t->amount;
                    $paySecondary = $payPrimary * $ratio;
                }

                $settleDebitPrimary = 0.0;
                $settleCreditPrimary = 0.0;
                $settleDebitSecondary = $paySecondary === null ? null : 0.0;
                $settleCreditSecondary = $paySecondary === null ? null : 0.0;

                // Settlement cash impact:
                // - payable settlement: cash - (debit)
                // - receivable settlement: cash + (credit)
                if ($t->type === 'payable') {
                    $settleDebitPrimary = $payPrimary;
                    if ($paySecondary !== null) {
                        $settleDebitSecondary = abs($paySecondary);
                    }
                } else { // receivable
                    $settleCreditPrimary = $payPrimary;
                    if ($paySecondary !== null) {
                        $settleCreditSecondary = abs($paySecondary);
                    }
                }

                DB::table('ledger_entries')->insert([
                    'user_id' => $s->user_id,
                    'transaction_id' => $t->id,
                    'settlement_id' => $s->id,
                    'occurred_on' => $s->paid_on,
                    'type' => $t->type,
                    'description' => $s->note ? ('Settlement: '.$s->note) : 'Settlement',
                    'primary_amount' => $payPrimary,
                    'primary_currency' => $t->currency,
                    'secondary_amount' => $paySecondary,
                    'secondary_currency' => $t->secondary_currency,
                    'debit_primary' => $settleDebitPrimary,
                    'credit_primary' => $settleCreditPrimary,
                    'debit_secondary' => $settleDebitSecondary,
                    'credit_secondary' => $settleCreditSecondary,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        // Best-effort rollback: remove settlement_id column and restore uniqueness per transaction.
        Schema::table('ledger_entries', function (Blueprint $table) {
            if (Schema::hasColumn('ledger_entries', 'settlement_id')) {
                $table->dropUnique(['transaction_id', 'settlement_id']);
                $table->dropForeign(['settlement_id']);
                $table->dropColumn('settlement_id');
                $table->unique(['transaction_id']);
            }
        });
    }
};
