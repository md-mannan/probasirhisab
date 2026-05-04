<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ledger_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('transaction_id')->constrained('transactions')->cascadeOnDelete();

            $table->date('occurred_on');
            $table->string('type', 32);
            $table->string('description')->nullable();

            $table->decimal('primary_amount', 18, 3);
            $table->string('primary_currency', 3);

            $table->decimal('secondary_amount', 18, 3)->nullable();
            $table->string('secondary_currency', 3)->nullable();

            $table->decimal('debit_primary', 18, 3)->default(0);
            $table->decimal('credit_primary', 18, 3)->default(0);

            $table->decimal('debit_secondary', 18, 3)->nullable();
            $table->decimal('credit_secondary', 18, 3)->nullable();

            $table->timestamps();

            $table->unique(['transaction_id']);
            $table->index(['user_id', 'occurred_on', 'id']);
        });

        // Backfill existing transactions into ledger entries (best-effort).
        if (Schema::hasTable('transactions')) {
            $rows = DB::table('transactions')->select([
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

            foreach ($rows as $t) {
                $primary = (float) $t->amount;
                $signed = in_array($t->type, ['expense', 'payable'], true) ? -abs($primary) : abs($primary);

                $debitPrimary = $signed < 0 ? abs($signed) : 0.0;
                $creditPrimary = $signed > 0 ? abs($signed) : 0.0;

                $secondarySigned = null;
                $debitSecondary = null;
                $creditSecondary = null;

                if ($t->secondary_amount !== null && $t->secondary_currency !== null) {
                    $secondary = (float) $t->secondary_amount;
                    $secondarySigned = in_array($t->type, ['expense', 'payable'], true)
                        ? -abs($secondary)
                        : abs($secondary);

                    $debitSecondary = $secondarySigned < 0 ? abs($secondarySigned) : 0.0;
                    $creditSecondary = $secondarySigned > 0 ? abs($secondarySigned) : 0.0;
                }

                DB::table('ledger_entries')->insert([
                    'user_id' => $t->user_id,
                    'transaction_id' => $t->id,
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
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('ledger_entries');
    }
};
