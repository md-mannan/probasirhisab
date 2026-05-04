<?php

namespace App\Models;

use App\Enums\UserRole;
// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Storage;
use Laravel\Fortify\TwoFactorAuthenticatable;

#[Fillable(['name', 'email', 'password', 'role', 'locale', 'primary_currency', 'secondary_currency', 'dashboard_tile_order'])]
#[Hidden(['password', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token', 'avatar_path'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, TwoFactorAuthenticatable;

    /**
     * @var list<string>
     */
    protected $appends = ['avatar'];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
            'dashboard_tile_order' => 'array',
            'role' => UserRole::class,
        ];
    }

    protected static function booted(): void
    {
        static::deleting(function (User $user): void {
            if ($user->avatar_path !== null && $user->avatar_path !== '') {
                Storage::disk('public')->delete($user->avatar_path);
            }
        });
    }

    /** Public absolute URL for the profile photo (used by Inertia `auth.user.avatar`). */
    protected function avatar(): Attribute
    {
        return Attribute::make(
            get: fn (): ?string => $this->avatar_path
                ? Storage::disk('public')->url($this->avatar_path)
                : null,
        );
    }
}
