<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Indexes for hot paths (dashboard aggregates, trends) without changing query logic.
     */
    public function up(): void
    {
        if (Schema::hasTable('transactions')) {
            Schema::table('transactions', function (Blueprint $table) {
                if (! $this->indexExists('transactions', 'transactions_user_occurred_id_idx')) {
                    $table->index(
                        ['user_id', 'occurred_on', 'id'],
                        'transactions_user_occurred_id_idx',
                    );
                }
            });
        }

        if (Schema::hasTable('transaction_settlements')) {
            Schema::table('transaction_settlements', function (Blueprint $table) {
                if (! $this->indexExists('transaction_settlements', 'ts_user_paid_on_idx')) {
                    $table->index(
                        ['user_id', 'paid_on'],
                        'ts_user_paid_on_idx',
                    );
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('transactions')) {
            Schema::table('transactions', function (Blueprint $table) {
                if ($this->indexExists('transactions', 'transactions_user_occurred_id_idx')) {
                    $table->dropIndex('transactions_user_occurred_id_idx');
                }
            });
        }

        if (Schema::hasTable('transaction_settlements')) {
            Schema::table('transaction_settlements', function (Blueprint $table) {
                if ($this->indexExists('transaction_settlements', 'ts_user_paid_on_idx')) {
                    $table->dropIndex('ts_user_paid_on_idx');
                }
            });
        }
    }

    private function indexExists(string $table, string $indexName): bool
    {
        $connection = Schema::getConnection();
        $driver = $connection->getDriverName();

        if ($driver === 'sqlite') {
            $indexes = $connection->select("PRAGMA index_list('{$table}')");

            foreach ($indexes as $row) {
                if (($row->name ?? null) === $indexName) {
                    return true;
                }
            }

            return false;
        }

        $database = $connection->getDatabaseName();

        $result = $connection->selectOne(
            'SELECT COUNT(*) AS c FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? AND index_name = ?',
            [$database, $table, $indexName],
        );

        return isset($result->c) && (int) $result->c > 0;
    }
};
