<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->foreignId('contact_id')->nullable()->after('category_id')->constrained('contacts')->nullOnDelete();
            $table->index(['user_id', 'contact_id', 'occurred_on']);
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropForeign(['contact_id']);
            $table->dropIndex(['user_id', 'contact_id', 'occurred_on']);
            $table->dropColumn('contact_id');
        });
    }
};
