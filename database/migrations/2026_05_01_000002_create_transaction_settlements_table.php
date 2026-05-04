<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transaction_settlements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('transaction_id')->constrained('transactions')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->decimal('amount', 18, 3);
            $table->date('paid_on');
            $table->string('note')->nullable();
            $table->timestamps();

            $table->index(['transaction_id', 'paid_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transaction_settlements');
    }
};
