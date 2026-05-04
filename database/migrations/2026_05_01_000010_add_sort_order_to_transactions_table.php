<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('transactions')) {
            return;
        }

        Schema::table('transactions', function (Blueprint $table) {
            if (! Schema::hasColumn('transactions', 'sort_order')) {
                $table->unsignedInteger('sort_order')->nullable()->after('occurred_on');
                $table->index(['user_id', 'sort_order', 'id']);
            }
        });

        // Backfill: preserve current "latest first" display by default.
        // We set sort_order = id for all rows; UI will order by sort_order DESC initially.
        if (Schema::hasColumn('transactions', 'sort_order')) {
            DB::statement('UPDATE `transactions` SET `sort_order` = `id` WHERE `sort_order` IS NULL');
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('transactions')) {
            return;
        }

        if (! Schema::hasColumn('transactions', 'sort_order')) {
            return;
        }

        Schema::table('transactions', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'sort_order', 'id']);
            $table->dropColumn('sort_order');
        });
    }
};
