<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('ledger_entries')) {
            return;
        }

        if (! Schema::hasColumn('ledger_entries', 'description')) {
            return;
        }

        $driver = DB::getDriverName();

        // Avoid doctrine/dbal dependency by using driver-specific SQL.
        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE `ledger_entries` MODIFY `description` TEXT NULL');
        } elseif ($driver === 'pgsql') {
            DB::statement('ALTER TABLE ledger_entries ALTER COLUMN description TYPE TEXT');
            DB::statement('ALTER TABLE ledger_entries ALTER COLUMN description DROP NOT NULL');
        } elseif ($driver === 'sqlite') {
            // SQLite requires table rebuild for column type changes.
            // We'll leave as-is to avoid destructive rebuild.
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('ledger_entries')) {
            return;
        }

        if (! Schema::hasColumn('ledger_entries', 'description')) {
            return;
        }

        $driver = DB::getDriverName();

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE `ledger_entries` MODIFY `description` VARCHAR(255) NULL');
        } elseif ($driver === 'pgsql') {
            DB::statement('ALTER TABLE ledger_entries ALTER COLUMN description TYPE VARCHAR(255)');
            DB::statement('ALTER TABLE ledger_entries ALTER COLUMN description DROP NOT NULL');
        } elseif ($driver === 'sqlite') {
            // No-op (see up()).
        }
    }
};
