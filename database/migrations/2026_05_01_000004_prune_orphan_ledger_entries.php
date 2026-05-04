<?php

use App\Models\LedgerEntry;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('ledger_entries')) {
            return;
        }

        LedgerEntry::query()->whereDoesntHave('transaction')->delete();
    }

    public function down(): void
    {
        // Non-reversible data cleanup.
    }
};
