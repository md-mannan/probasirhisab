<?php

namespace App\Policies;

use App\Enums\UserRole;
use App\Models\User;

class UserPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->role->canAccessUserManagement();
    }

    public function create(User $user): bool
    {
        return $user->role->canAccessUserManagement();
    }

    public function update(User $actor, User $subject): bool
    {
        if (! $actor->role->canAccessUserManagement()) {
            return false;
        }

        if ($actor->role === UserRole::Admin && $subject->role !== UserRole::User) {
            return false;
        }

        return true;
    }

    public function delete(User $actor, User $subject): bool
    {
        if ($actor->id === $subject->id) {
            return false;
        }

        if (! $actor->role->canAccessUserManagement()) {
            return false;
        }

        if ($actor->role === UserRole::Admin && $subject->role !== UserRole::User) {
            return false;
        }

        return true;
    }
}
