<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('exchange_rate_settings', function (Blueprint $table) {
            $table->id();
            $table->string('exchange_rate_api_url', 2048)->nullable();
            $table->string('exchange_rate_api_key', 255)->nullable();
            $table->timestamps();
        });

        if (Schema::hasTable('users')) {
            $source = DB::table('users')
                ->whereNotNull('exchange_rate_api_url')
                ->orderBy('id')
                ->first();

            if ($source !== null) {
                DB::table('exchange_rate_settings')->insert([
                    'exchange_rate_api_url' => $source->exchange_rate_api_url,
                    'exchange_rate_api_key' => $source->exchange_rate_api_key,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                return;
            }
        }

        DB::table('exchange_rate_settings')->insert([
            'exchange_rate_api_url' => null,
            'exchange_rate_api_key' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('exchange_rate_settings');
    }
};
