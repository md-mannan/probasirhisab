<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('transaction_settlements')) {
            return;
        }

        if (! Schema::hasColumn('transaction_settlements', 'note')) {
            return;
        }

        $driver = DB::getDriverName();

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE `transaction_settlements` MODIFY `note` TEXT NULL');
        } elseif ($driver === 'pgsql') {
            DB::statement('ALTER TABLE transaction_settlements ALTER COLUMN note TYPE TEXT');
            DB::statement('ALTER TABLE transaction_settlements ALTER COLUMN note DROP NOT NULL');
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('transaction_settlements')) {
            return;
        }

        if (! Schema::hasColumn('transaction_settlements', 'note')) {
            return;
        }

        $driver = DB::getDriverName();

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE `transaction_settlements` MODIFY `note` VARCHAR(255) NULL');
        } elseif ($driver === 'pgsql') {
            DB::statement('ALTER TABLE transaction_settlements ALTER COLUMN note TYPE VARCHAR(255)');
            DB::statement('ALTER TABLE transaction_settlements ALTER COLUMN note DROP NOT NULL');
        }
    }
};
