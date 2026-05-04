<?php

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

test('super admin can set another user password', function () {
    $admin = User::factory()->create(['role' => UserRole::SuperAdmin]);
    $target = User::factory()->create(['role' => UserRole::User]);

    $this->actingAs($admin)
        ->patch(route('settings.users.password', $target), [
            'password' => 'NewSecurePass1!',
            'password_confirmation' => 'NewSecurePass1!',
        ])
        ->assertRedirect(route('settings.users.index'))
        ->assertSessionHas('status');

    expect(Hash::check('NewSecurePass1!', $target->fresh()->password))->toBeTrue();
});

test('admin can set a normal user password', function () {
    $admin = User::factory()->create(['role' => UserRole::Admin]);
    $target = User::factory()->create(['role' => UserRole::User]);

    $this->actingAs($admin)
        ->patch(route('settings.users.password', $target), [
            'password' => 'AnotherPass2!',
            'password_confirmation' => 'AnotherPass2!',
        ])
        ->assertRedirect(route('settings.users.index'));

    expect(Hash::check('AnotherPass2!', $target->fresh()->password))->toBeTrue();
});

test('admin cannot set super admin password', function () {
    $admin = User::factory()->create(['role' => UserRole::Admin]);
    $target = User::factory()->create(['role' => UserRole::SuperAdmin]);

    $this->actingAs($admin)
        ->patch(route('settings.users.password', $target), [
            'password' => 'NewSecurePass1!',
            'password_confirmation' => 'NewSecurePass1!',
        ])
        ->assertForbidden();
});

test('setting own password via team route redirects without changing password', function () {
    $admin = User::factory()->create(['role' => UserRole::SuperAdmin]);

    $this->actingAs($admin)
        ->patch(route('settings.users.password', $admin), [
            'password' => 'NewSecurePass1!',
            'password_confirmation' => 'NewSecurePass1!',
        ])
        ->assertRedirect(route('settings.users.index'))
        ->assertSessionHas('status');

    expect(Hash::check('password', $admin->fresh()->password))->toBeTrue();
});
