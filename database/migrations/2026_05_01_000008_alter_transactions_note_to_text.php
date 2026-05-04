<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('transactions')) {
            return;
        }

        if (! Schema::hasColumn('transactions', 'note')) {
            return;
        }

        $driver = DB::getDriverName();

        // Avoid doctrine/dbal dependency by using driver-specific SQL.
        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE `transactions` MODIFY `note` TEXT NULL');
        } elseif ($driver === 'pgsql') {
            DB::statement('ALTER TABLE transactions ALTER COLUMN note TYPE TEXT');
            DB::statement('ALTER TABLE transactions ALTER COLUMN note DROP NOT NULL');
        } elseif ($driver === 'sqlite') {
            // SQLite requires table rebuild for column type changes.
            // We'll leave as-is to avoid destructive rebuild; note length is usually fine in SQLite.
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('transactions')) {
            return;
        }

        if (! Schema::hasColumn('transactions', 'note')) {
            return;
        }

        $driver = DB::getDriverName();

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE `transactions` MODIFY `note` VARCHAR(255) NULL');
        } elseif ($driver === 'pgsql') {
            DB::statement('ALTER TABLE transactions ALTER COLUMN note TYPE VARCHAR(255)');
            DB::statement('ALTER TABLE transactions ALTER COLUMN note DROP NOT NULL');
        } elseif ($driver === 'sqlite') {
            // No-op (see up()).
        }
    }
};
