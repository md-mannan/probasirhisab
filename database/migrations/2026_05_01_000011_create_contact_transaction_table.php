<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contact_transaction', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contact_id')->constrained('contacts')->cascadeOnDelete();
            $table->foreignId('transaction_id')->constrained('transactions')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['contact_id', 'transaction_id']);
            $table->index(['user_id', 'contact_id']);
            $table->index(['user_id', 'transaction_id']);
        });

        // Backfill from legacy transactions.contact_id if present.
        if (Schema::hasTable('transactions') && Schema::hasColumn('transactions', 'contact_id')) {
            $rows = DB::table('transactions')
                ->whereNotNull('contact_id')
                ->select(['id', 'user_id', 'contact_id'])
                ->get();

            foreach ($rows as $r) {
                DB::table('contact_transaction')->updateOrInsert(
                    [
                        'contact_id' => $r->contact_id,
                        'transaction_id' => $r->id,
                    ],
                    [
                        'user_id' => $r->user_id,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ],
                );
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_transaction');
    }
};
