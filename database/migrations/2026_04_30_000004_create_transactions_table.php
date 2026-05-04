<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->nullable()->constrained('categories')->nullOnDelete();
            $table->string('type', 32);
            $table->decimal('amount', 18, 3);
            $table->string('currency', 3);
            $table->date('occurred_on');
            $table->string('note')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'type', 'occurred_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};
