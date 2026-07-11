<?php

use App\Enums\UserRole;
use App\Models\User;
use App\Support\Branding;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/**
 * The app logo can be managed after installation from the staff-only Branding page.
 */
function staffUser(): User
{
    return User::factory()->create(['role' => UserRole::SuperAdmin]);
}

test('the branding page is staff only', function (): void {
    $regular = User::factory()->create(['role' => UserRole::User]);

    $this->actingAs($regular)
        ->get(route('settings.branding.edit'))
        ->assertForbidden();

    $this->actingAs(staffUser())
        ->get(route('settings.branding.edit'))
        ->assertOk();
});

test('a staff member can upload a logo', function (): void {
    Storage::fake('public');
    $user = staffUser();

    $file = UploadedFile::fake()->image('logo.png', 256, 256);

    $this->actingAs($user)
        ->from(route('settings.branding.edit'))
        ->post(route('settings.branding.update'), ['logo' => $file])
        ->assertRedirect(route('settings.branding.edit'));

    Storage::disk('public')->assertExists(Branding::LOGO_PATH);
    expect(Branding::hasLogo())->toBeTrue()
        ->and(Branding::logoUrl())->not->toBeNull();
});

test('uploading a non-image is rejected', function (): void {
    Storage::fake('public');
    $user = staffUser();

    $file = UploadedFile::fake()->create('logo.txt', 4, 'text/plain');

    $this->actingAs($user)
        ->from(route('settings.branding.edit'))
        ->post(route('settings.branding.update'), ['logo' => $file])
        ->assertSessionHasErrors('logo');

    Storage::disk('public')->assertMissing(Branding::LOGO_PATH);
});

test('a staff member can remove the logo', function (): void {
    Storage::fake('public');
    $user = staffUser();

    Storage::disk('public')->put(Branding::LOGO_PATH, 'fake-bytes');
    expect(Branding::hasLogo())->toBeTrue();

    $this->actingAs($user)
        ->from(route('settings.branding.edit'))
        ->delete(route('settings.branding.destroy'))
        ->assertRedirect(route('settings.branding.edit'));

    Storage::disk('public')->assertMissing(Branding::LOGO_PATH);
    expect(Branding::hasLogo())->toBeFalse();
});

test('a regular user cannot upload or remove the logo', function (): void {
    Storage::fake('public');
    $regular = User::factory()->create(['role' => UserRole::User]);

    $this->actingAs($regular)
        ->post(route('settings.branding.update'), [
            'logo' => UploadedFile::fake()->image('logo.png'),
        ])
        ->assertForbidden();

    $this->actingAs($regular)
        ->delete(route('settings.branding.destroy'))
        ->assertForbidden();
});
