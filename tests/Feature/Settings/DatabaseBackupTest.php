<?php

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Inertia\Testing\AssertableInertia as Assert;

test('non-staff cannot open database settings', function () {
    $user = User::factory()->create(['role' => UserRole::User]);

    $this->actingAs($user)
        ->get(route('settings.database.edit'))
        ->assertForbidden();
});

test('non-staff cannot download a database backup', function () {
    $user = User::factory()->create(['role' => UserRole::User]);

    $this->actingAs($user)
        ->get(route('settings.database.download'))
        ->assertForbidden();
});

test('non-staff cannot post database restore', function () {
    $user = User::factory()->create(['role' => UserRole::User]);

    $this->actingAs($user)
        ->post(route('settings.database.restore'), [
            'backup' => null,
            'current_password' => 'password',
            'confirm_restore' => 'RESTORE',
        ])
        ->assertForbidden();
});

test('admin can open database settings', function () {
    $admin = User::factory()->create(['role' => UserRole::Admin]);

    $this->actingAs($admin)
        ->get(route('settings.database.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/database')
            ->where('driverLabel', 'SQLite')
            ->where('supportsBackup', false)
            ->where('supportsRestore', false)
        );
});

test('super admin can open database settings', function () {
    $admin = User::factory()->create(['role' => UserRole::SuperAdmin]);

    $this->actingAs($admin)
        ->get(route('settings.database.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('settings/database'));
});

test('download returns 503 when backup is not available', function () {
    $admin = User::factory()->create(['role' => UserRole::Admin]);

    $this->actingAs($admin)
        ->get(route('settings.database.download'))
        ->assertStatus(503);
});

test('restore requires valid password and confirmation phrase', function () {
    $admin = User::factory()->create(['role' => UserRole::Admin]);
    $file = UploadedFile::fake()->create('dump.sql', 8, 'text/plain');

    $this->actingAs($admin)
        ->from(route('settings.database.edit'))
        ->post(route('settings.database.restore'), [
            'backup' => $file,
            'current_password' => 'wrong-password',
            'confirm_restore' => 'RESTORE',
        ])
        ->assertSessionHasErrors('current_password');
});
