<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * People are now sourced from system users. Each contact gains a link to the user
 * it represents (member_user_id). Existing manually-created contacts are matched to
 * a user by exact (case-insensitive) name where possible so their transaction history
 * (contact_transaction pivot + transactions.contact_id) is preserved.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('contacts')) {
            return;
        }

        if (! Schema::hasColumn('contacts', 'member_user_id')) {
            Schema::table('contacts', function (Blueprint $table): void {
                $table->foreignId('member_user_id')
                    ->nullable()
                    ->after('user_id')
                    ->constrained('users')
                    ->nullOnDelete();
                $table->index(['user_id', 'member_user_id']);
            });
        }

        // Backfill: match existing contacts to a user by trimmed, case-insensitive name.
        if (Schema::hasTable('users')) {
            $users = DB::table('users')->select(['id', 'name'])->get();
            $byName = [];
            foreach ($users as $u) {
                $byName[mb_strtolower(trim((string) $u->name))] ??= $u->id;
            }

            $contacts = DB::table('contacts')
                ->whereNull('member_user_id')
                ->select(['id', 'name'])
                ->get();

            foreach ($contacts as $c) {
                $key = mb_strtolower(trim((string) $c->name));
                if (isset($byName[$key])) {
                    DB::table('contacts')
                        ->where('id', $c->id)
                        ->update(['member_user_id' => $byName[$key]]);
                }
            }
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('contacts') || ! Schema::hasColumn('contacts', 'member_user_id')) {
            return;
        }

        Schema::table('contacts', function (Blueprint $table): void {
            $table->dropIndex(['user_id', 'member_user_id']);
            $table->dropConstrainedForeignId('member_user_id');
        });
    }
};
