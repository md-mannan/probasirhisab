<?php

namespace App\Support;

use Illuminate\Support\Facades\File;

final class Installation
{
    public static function installed(): bool
    {
        return File::exists(self::lockPath());
    }

    public static function markInstalled(): void
    {
        File::ensureDirectoryExists(dirname(self::lockPath()));
        File::put(self::lockPath(), now()->toIso8601String());
    }

    public static function lockPath(): string
    {
        return storage_path('app/.installed');
    }
}
