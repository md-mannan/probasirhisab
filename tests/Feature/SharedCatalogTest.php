<?php

use App\Enums\UserRole;
use App\Models\Category;
use App\Models\Contact;
use App\Models\User;
use App\Support\SharedCatalog;

/**
 * Shared catalog visibility & mutation matrix. Super Admin-owned categories and
 * contacts are readable by everyone; mutation follows the role hierarchy.
 */

// The Super-Admin id set is memoized per request; flush it between tests so the
// long-lived test process does not carry ids across RefreshDatabase rollbacks.
beforeEach(fn () => SharedCatalog::flushCache());

function superAdmin(): User
{
    return User::factory()->create(['role' => UserRole::SuperAdmin]);
}

function admin(): User
{
    return User::factory()->create(['role' => UserRole::Admin]);
}

function regularUser(): User
{
    return User::factory()->create(['role' => UserRole::User]);
}

test('visible owner ids include the viewer and every super admin', function (): void {
    $sa1 = superAdmin();
    $sa2 = superAdmin();
    $viewer = regularUser();

    $ids = SharedCatalog::visibleOwnerIds($viewer);

    expect($ids)->toContain($viewer->id)
        ->toContain($sa1->id)
        ->toContain($sa2->id);
});

test('a user can read super admin owned categories', function (): void {
    $sa = superAdmin();
    $viewer = regularUser();
    $shared = Category::factory()->ofType('income')->forUser($sa)->create();

    expect(SharedCatalog::canAccessCategory($viewer, $shared))->toBeTrue();
});

test('a user cannot read another regular users categories', function (): void {
    $viewer = regularUser();
    $other = regularUser();
    $private = Category::factory()->ofType('income')->forUser($other)->create();

    expect(SharedCatalog::canAccessCategory($viewer, $private))->toBeFalse();
});

test('owners can mutate their own contacts', function (): void {
    $viewer = regularUser();
    $own = Contact::factory()->forUser($viewer)->create();

    expect(SharedCatalog::canMutateContact($viewer, $own))->toBeTrue();
});

test('a regular user cannot mutate super admin shared contacts', function (): void {
    $sa = superAdmin();
    $viewer = regularUser();
    $shared = Contact::factory()->forUser($sa)->create();

    expect(SharedCatalog::canMutateContact($viewer, $shared))->toBeFalse();
});

test('an admin can mutate super admin shared contacts', function (): void {
    $sa = superAdmin();
    $adminUser = admin();
    $shared = Contact::factory()->forUser($sa)->create();

    expect(SharedCatalog::canMutateContact($adminUser, $shared))->toBeTrue();
});

test('a super admin can mutate any users contact', function (): void {
    $sa = superAdmin();
    $other = regularUser();
    $foreign = Contact::factory()->forUser($other)->create();

    expect(SharedCatalog::canMutateContact($sa, $foreign))->toBeTrue();
});

test('an admin cannot mutate an unrelated regular users contact', function (): void {
    $adminUser = admin();
    $other = regularUser();
    $foreign = Contact::factory()->forUser($other)->create();

    expect(SharedCatalog::canMutateContact($adminUser, $foreign))->toBeFalse();
});
