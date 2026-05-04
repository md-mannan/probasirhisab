<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->decimal('secondary_amount', 18, 3)->nullable()->after('amount');
            $table->string('secondary_currency', 3)->nullable()->after('currency');
            $table->decimal('rate', 18, 8)->nullable()->after('secondary_currency');
            $table->string('source')->nullable()->after('note');
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropColumn(['secondary_amount', 'secondary_currency', 'rate', 'source']);
        });
    }
};
