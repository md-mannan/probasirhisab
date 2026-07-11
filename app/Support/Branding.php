<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;

/**
 * Central handling for the application logo shown in the sidebar and auth screens.
 * The logo is stored on the public disk as a single file and can be set at install
 * time or later from the staff-only Branding settings page.
 */
final class Branding
{
    /** Path (relative to the public disk) where the logo is stored. */
    public const LOGO_PATH = 'app-logo.png';

    /** Public URL for the logo (cache-busted by mtime), or null when unset. */
    public static function logoUrl(): ?string
    {
        if (! Storage::disk('public')->exists(self::LOGO_PATH)) {
            return null;
        }

        $version = (string) Storage::disk('public')->lastModified(self::LOGO_PATH);

        return Storage::disk('public')->url(self::LOGO_PATH).'?v='.$version;
    }

    public static function hasLogo(): bool
    {
        return Storage::disk('public')->exists(self::LOGO_PATH);
    }

    public static function deleteLogo(): void
    {
        if (self::hasLogo()) {
            Storage::disk('public')->delete(self::LOGO_PATH);
        }
    }
}
