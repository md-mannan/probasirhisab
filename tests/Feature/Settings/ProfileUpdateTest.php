<?php

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

test('profile page is displayed', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->get(route('profile.edit'));

    $response->assertOk();
});

test('profile information can be updated', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->patch(route('profile.update'), [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'locale' => 'en',
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('profile.edit'));

    $user->refresh();

    expect($user->name)->toBe('Test User');
    expect($user->email)->toBe('test@example.com');
    expect($user->email_verified_at)->toBeNull();
});

test('email verification status is unchanged when the email address is unchanged', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->patch(route('profile.update'), [
            'name' => 'Test User',
            'email' => $user->email,
            'locale' => 'en',
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('profile.edit'));

    expect($user->refresh()->email_verified_at)->not->toBeNull();
});

test('user can delete their account', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->delete(route('profile.destroy'), [
            'password' => 'password',
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('home'));

    $this->assertGuest();
    expect($user->fresh())->toBeNull();
});

test('correct password must be provided to delete account', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->from(route('profile.edit'))
        ->delete(route('profile.destroy'), [
            'password' => 'wrong-password',
        ]);

    $response
        ->assertSessionHasErrors('password')
        ->assertRedirect(route('profile.edit'));

    expect($user->fresh())->not->toBeNull();
});

test('profile photo can be uploaded', function () {
    Storage::fake('public');

    $user = User::factory()->create();
    $file = UploadedFile::fake()->image('avatar.jpg', 320, 320);

    $this->actingAs($user)
        ->patch(route('profile.update'), [
            'name' => $user->name,
            'email' => $user->email,
            'locale' => 'en',
            'avatar' => $file,
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('profile.edit'));

    $path = $user->fresh()->avatar_path;

    expect($path)->not->toBeNull();
    Storage::disk('public')->assertExists($path);
});

test('profile photo can be removed', function () {
    Storage::fake('public');

    $user = User::factory()->create();
    $file = UploadedFile::fake()->image('avatar.jpg');

    $this->actingAs($user)
        ->patch(route('profile.update'), [
            'name' => $user->name,
            'email' => $user->email,
            'locale' => 'en',
            'avatar' => $file,
        ])
        ->assertSessionHasNoErrors();

    $path = $user->fresh()->avatar_path;
    expect($path)->not->toBeNull();

    $this->actingAs($user)
        ->patch(route('profile.update'), [
            'name' => $user->name,
            'email' => $user->email,
            'locale' => 'en',
            'remove_avatar' => true,
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('profile.edit'));

    expect($user->fresh()->avatar_path)->toBeNull();
    Storage::disk('public')->assertMissing($path);
});
