<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transaction_settlements', function (Blueprint $table) {
            $table->unsignedBigInteger('sort_order')->nullable()->after('category_id');
            $table->index(['user_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::table('transaction_settlements', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'sort_order']);
            $table->dropColumn('sort_order');
        });
    }
};
