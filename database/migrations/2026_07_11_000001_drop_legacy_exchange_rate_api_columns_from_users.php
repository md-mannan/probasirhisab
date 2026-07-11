<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The per-user exchange_rate_api_url/key columns were superseded by the single
 * global exchange_rate_settings table (see 2026_05_04_000002). Nothing reads the
 * user columns anymore, so drop them.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        Schema::table('users', function (Blueprint $table): void {
            foreach (['exchange_rate_api_url', 'exchange_rate_api_key'] as $column) {
                if (Schema::hasColumn('users', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        Schema::table('users', function (Blueprint $table): void {
            if (! Schema::hasColumn('users', 'exchange_rate_api_url')) {
                $table->string('exchange_rate_api_url')->nullable()->after('secondary_currency');
            }
            if (! Schema::hasColumn('users', 'exchange_rate_api_key')) {
                $table->string('exchange_rate_api_key')->nullable()->after('exchange_rate_api_url');
            }
        });
    }
};
