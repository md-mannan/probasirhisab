<?php

use App\Http\Controllers\CategoryController;
use App\Http\Controllers\ContactController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DashboardTileOrderController;
use App\Http\Controllers\InstallController;
use App\Http\Controllers\LedgerController;
use App\Http\Controllers\Reports\BalanceSheetController;
use App\Http\Controllers\TransactionController;
use App\Http\Controllers\TransactionSettlementController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::middleware('install.guest')->group(function () {
    Route::get('install', [InstallController::class, 'show'])->name('install.show');
    Route::post('install/locale', [InstallController::class, 'setLocale'])->name('install.locale');
    Route::post('install', [InstallController::class, 'store'])->name('install.store');
});

Route::get('/', function (Request $request) {
    if (Auth::check()) {
        return redirect()->route('dashboard');
    }

    return Inertia::render('auth/login', [
        'status' => $request->session()->get('status'),
    ]);
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', DashboardController::class)->name('dashboard');
    Route::patch('dashboard/tile-order', DashboardTileOrderController::class)->name('dashboard.tile-order');

    Route::get('categories', [CategoryController::class, 'index'])->name('categories.index');
    Route::post('categories', [CategoryController::class, 'store'])->name('categories.store');
    Route::patch('categories/{category}', [CategoryController::class, 'update'])->name('categories.update');
    Route::delete('categories/{category}', [CategoryController::class, 'destroy'])->name('categories.destroy');

    // People are sourced from system users; the list is read-only (no manual add/edit/delete).
    Route::get('contacts', [ContactController::class, 'index'])->name('contacts.index');
    Route::get('contacts/{contact}', [ContactController::class, 'show'])->name('contacts.show');

    Route::get('transactions', [TransactionController::class, 'index'])->name('transactions.index');
    Route::patch('transactions/reorder', [TransactionController::class, 'reorder'])->name('transactions.reorder');
    Route::patch('transactions/reorder-rows', [TransactionController::class, 'reorderRows'])->name('transactions.reorderRows');
    Route::get('transactions/{transaction}', [TransactionController::class, 'show'])->name('transactions.show');
    Route::post('transactions', [TransactionController::class, 'store'])->name('transactions.store');
    Route::patch('transactions/{transaction}', [TransactionController::class, 'update'])->name('transactions.update');
    Route::delete('transactions/{transaction}', [TransactionController::class, 'destroy'])->name('transactions.destroy');

    Route::get('ledger', [LedgerController::class, 'index'])->name('ledger.index');

    Route::get('reports/balance-sheet', [BalanceSheetController::class, 'index'])
        ->name('reports.balance-sheet');

    Route::post('transactions/{transaction}/settlements', [TransactionSettlementController::class, 'store'])
        ->name('transactions.settlements.store');
    Route::patch('transactions/{transaction}/settlements/{settlement}', [TransactionSettlementController::class, 'update'])
        ->name('transactions.settlements.update');
    Route::delete('transactions/{transaction}/settlements/{settlement}', [TransactionSettlementController::class, 'destroy'])
        ->name('transactions.settlements.destroy');
});

require __DIR__.'/settings.php';
