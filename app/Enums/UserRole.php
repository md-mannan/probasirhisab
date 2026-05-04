<?php

namespace App\Enums;

enum UserRole: string
{
    case SuperAdmin = 'super_admin';
    case Admin = 'admin';
    case User = 'user';

    public function canAccessUserManagement(): bool
    {
        return $this === self::SuperAdmin || $this === self::Admin;
    }

    public function canAssignRole(self $target): bool
    {
        return match ($this) {
            self::SuperAdmin => true,
            self::Admin => $target === self::User,
            self::User => false,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::SuperAdmin => 'Super admin',
            self::Admin => 'Admin',
            self::User => 'User',
        };
    }
}
