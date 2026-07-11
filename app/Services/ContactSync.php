<?php

namespace App\Services;

use App\Models\Contact;
use App\Models\User;

/**
 * People are derived from system users. This ensures the current user has exactly one
 * contact row per system user (all users on this install), reusing an existing contact
 * when one already matches by member_user_id or by name — so historical transaction
 * links are preserved rather than duplicated.
 */
class ContactSync
{
    /**
     * Ensure a user-backed contact exists for every system user, owned by $owner.
     */
    public function syncForOwner(User $owner): void
    {
        $users = User::query()->orderBy('name')->get(['id', 'name']);

        /** @var array<int, Contact> $ownedContacts */
        $ownedContacts = Contact::query()
            ->where('user_id', $owner->id)
            ->get();

        $byMemberId = [];
        $byName = [];
        foreach ($ownedContacts as $contact) {
            if ($contact->member_user_id !== null) {
                $byMemberId[$contact->member_user_id] = $contact;
            }
            $byName[mb_strtolower(trim((string) $contact->name))] ??= $contact;
        }

        foreach ($users as $member) {
            // Already linked to this user.
            if (isset($byMemberId[$member->id])) {
                continue;
            }

            // Adopt an existing same-name contact (preserves its transaction links).
            $nameKey = mb_strtolower(trim((string) $member->name));
            if (isset($byName[$nameKey]) && $byName[$nameKey]->member_user_id === null) {
                $existing = $byName[$nameKey];
                $existing->member_user_id = $member->id;
                $existing->name = $member->name;
                $existing->save();
                $byMemberId[$member->id] = $existing;

                continue;
            }

            // Otherwise create a fresh user-backed contact.
            $created = Contact::query()->create([
                'user_id' => $owner->id,
                'member_user_id' => $member->id,
                'name' => $member->name,
            ]);
            $byMemberId[$member->id] = $created;
        }
    }
}
