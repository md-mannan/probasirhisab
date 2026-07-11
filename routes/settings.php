<?php

use App\Http\Controllers\Settings\BrandingController;
use App\Http\Controllers\Settings\CurrencyController;
use App\Http\Controllers\Settings\DatabaseBackupController;
use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\Settings\SecurityController;
use App\Http\Controllers\Settings\UserManagementController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth'])->group(function () {
    Route::redirect('settings', '/settings/profile');

    Route::get('settings/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('settings/profile', [ProfileController::class, 'update'])->name('profile.update');

    Route::get('settings/currency', [CurrencyController::class, 'edit'])->name('currency.edit');
    Route::patch('settings/currency', [CurrencyController::class, 'update'])->name('currency.update');
});

Route::middleware(['auth', 'verified', 'staff'])->group(function () {
    Route::get('settings/branding', [BrandingController::class, 'edit'])->name('settings.branding.edit');
    Route::post('settings/branding', [BrandingController::class, 'update'])
        ->middleware('throttle:20,1')
        ->name('settings.branding.update');
    Route::delete('settings/branding', [BrandingController::class, 'destroy'])->name('settings.branding.destroy');

    Route::get('settings/database', [DatabaseBackupController::class, 'edit'])->name('settings.database.edit');
    Route::get('settings/database/download', [DatabaseBackupController::class, 'download'])
        ->middleware('throttle:20,1')
        ->name('settings.database.download');
    Route::post('settings/database/restore', [DatabaseBackupController::class, 'restore'])
        ->middleware('throttle:3,10')
        ->name('settings.database.restore');

    Route::get('settings/users', [UserManagementController::class, 'index'])->name('settings.users.index');
    Route::post('settings/users', [UserManagementController::class, 'store'])->name('settings.users.store');
    Route::patch('settings/users/{user}/role', [UserManagementController::class, 'updateRole'])->name('settings.users.role');
    Route::patch('settings/users/{user}/password', [UserManagementController::class, 'updatePassword'])
        ->middleware('throttle:12,1')
        ->name('settings.users.password');
    Route::delete('settings/users/{user}', [UserManagementController::class, 'destroy'])->name('settings.users.destroy');
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::delete('settings/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::get('settings/security', [SecurityController::class, 'edit'])->name('security.edit');

    Route::put('settings/password', [SecurityController::class, 'update'])
        ->middleware('throttle:6,1')
        ->name('user-password.update');

    Route::inertia('settings/appearance', 'settings/appearance')->name('appearance.edit');
});
