<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('exchange_rate_api_url')->nullable()->after('secondary_currency');
            $table->string('exchange_rate_api_key')->nullable()->after('exchange_rate_api_url');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['exchange_rate_api_url', 'exchange_rate_api_key']);
        });
    }
};
