<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transaction_settlements', function (Blueprint $table) {
            $table->string('source')->nullable()->after('paid_on');
        });
    }

    public function down(): void
    {
        Schema::table('transaction_settlements', function (Blueprint $table) {
            $table->dropColumn('source');
        });
    }
};
