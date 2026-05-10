<?php

namespace App\Support;

use App\Enums\UserRole;
use App\Models\Category;
use App\Models\Contact;
use App\Models\User;

/**
 * Categories and contacts owned by Super Admin are visible to all authenticated users.
 */
final class SharedCatalog
{
    /**
     * User IDs whose categories and contacts appear in shared lists (current user + every Super Admin).
     *
     * @return list<int>
     */
    public static function visibleOwnerIds(User $viewer): array
    {
        $superAdminIds = User::query()
            ->where('role', UserRole::SuperAdmin)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        return array_values(array_unique(array_merge([(int) $viewer->id], $superAdminIds)));
    }

    public static function canAccessContact(User $viewer, Contact $contact): bool
    {
        if ((int) $contact->user_id === (int) $viewer->id) {
            return true;
        }

        $owner = User::query()->find($contact->user_id);

        return $owner !== null && $owner->role === UserRole::SuperAdmin;
    }

    public static function canAccessCategory(User $viewer, Category $category): bool
    {
        if ((int) $category->user_id === (int) $viewer->id) {
            return true;
        }

        $owner = User::query()->find($category->user_id);

        return $owner !== null && $owner->role === UserRole::SuperAdmin;
    }

    /** Edit/delete: owner, or Super Admin for any row, or Admin for Super-Admin-owned rows. */
    public static function canMutateContact(User $viewer, Contact $contact): bool
    {
        if ((int) $contact->user_id === (int) $viewer->id) {
            return true;
        }

        if ($viewer->role === UserRole::SuperAdmin) {
            return true;
        }

        $owner = User::query()->find($contact->user_id);

        return $owner !== null
            && $owner->role === UserRole::SuperAdmin
            && $viewer->role === UserRole::Admin;
    }

    public static function canMutateCategory(User $viewer, Category $category): bool
    {
        if ((int) $category->user_id === (int) $viewer->id) {
            return true;
        }

        if ($viewer->role === UserRole::SuperAdmin) {
            return true;
        }

        $owner = User::query()->find($category->user_id);

        return $owner !== null
            && $owner->role === UserRole::SuperAdmin
            && $viewer->role === UserRole::Admin;
    }
}
