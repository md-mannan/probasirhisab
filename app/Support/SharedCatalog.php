<?php

namespace App\Support;

use App\Enums\UserRole;
use App\Models\Category;
use App\Models\Contact;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Categories and contacts owned by Super Admin are visible to all authenticated users.
 *
 * The set of Super-Admin user IDs is memoized for the lifetime of the request to
 * avoid the per-row `User::find()` queries the access checks used to issue (an N+1
 * when authorizing lists of categories/contacts).
 */
final class SharedCatalog
{
    /** @var list<int>|null */
    private static ?array $superAdminIds = null;

    /**
     * Super-Admin user IDs, queried once per request.
     *
     * @return list<int>
     */
    private static function superAdminIds(): array
    {
        if (self::$superAdminIds === null) {
            self::$superAdminIds = User::query()
                ->where('role', UserRole::SuperAdmin)
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->all();
        }

        return self::$superAdminIds;
    }

    /**
     * Clear the memoized Super-Admin set. Call after changing a user's role so
     * long-lived processes (queue workers, tests) do not see stale data.
     */
    public static function flushCache(): void
    {
        self::$superAdminIds = null;
    }

    private static function isSuperAdminOwned(int $ownerId): bool
    {
        return in_array($ownerId, self::superAdminIds(), true);
    }

    /**
     * User IDs whose categories and contacts appear in shared lists (current user + every Super Admin).
     *
     * @return list<int>
     */
    public static function visibleOwnerIds(User $viewer): array
    {
        return array_values(array_unique(array_merge([(int) $viewer->id], self::superAdminIds())));
    }

    /**
     * People are synced per owner (one user-backed contact per system user), yet
     * contact lists union the viewer's own rows with the Super Admin's shared set.
     * For a non-Super-Admin viewer both sides hold a full roster, so every person
     * would appear twice. Collapse user-backed contacts to one row per system user,
     * preferring the viewer's own copy so per-user transaction links still resolve.
     * Non-user-backed contacts (member_user_id null) are all kept as-is.
     *
     * @param  Collection<int, Contact>  $contacts
     * @return Collection<int, Contact>
     */
    public static function dedupePeople(Collection $contacts, User $viewer): Collection
    {
        $indexByMember = [];
        $result = [];

        foreach ($contacts as $contact) {
            $memberId = $contact->member_user_id;

            if ($memberId === null) {
                $result[] = $contact;

                continue;
            }

            if (! array_key_exists($memberId, $indexByMember)) {
                $indexByMember[$memberId] = count($result);
                $result[] = $contact;

                continue;
            }

            // Prefer the viewer's own row (keeps its position in the sorted list).
            if ((int) $contact->user_id === (int) $viewer->id) {
                $result[$indexByMember[$memberId]] = $contact;
            }
        }

        return collect($result);
    }

    public static function canAccessContact(User $viewer, Contact $contact): bool
    {
        if ((int) $contact->user_id === (int) $viewer->id) {
            return true;
        }

        return self::isSuperAdminOwned((int) $contact->user_id);
    }

    public static function canAccessCategory(User $viewer, Category $category): bool
    {
        if ((int) $category->user_id === (int) $viewer->id) {
            return true;
        }

        return self::isSuperAdminOwned((int) $category->user_id);
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

        return $viewer->role === UserRole::Admin
            && self::isSuperAdminOwned((int) $contact->user_id);
    }

    public static function canMutateCategory(User $viewer, Category $category): bool
    {
        if ((int) $category->user_id === (int) $viewer->id) {
            return true;
        }

        if ($viewer->role === UserRole::SuperAdmin) {
            return true;
        }

        return $viewer->role === UserRole::Admin
            && self::isSuperAdminOwned((int) $category->user_id);
    }
}
