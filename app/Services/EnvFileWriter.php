<?php

namespace App\Services;

use Illuminate\Support\Facades\File;
use InvalidArgumentException;

class EnvFileWriter
{
    /**
     * @param  array<string, string|int|bool|null>  $values
     */
    public function merge(array $values, ?string $path = null): void
    {
        $path ??= base_path('.env');
        if (! File::exists($path)) {
            $example = base_path('.env.example');
            if (! File::exists($example)) {
                throw new InvalidArgumentException('.env and .env.example are missing.');
            }
            File::copy($example, $path);
        }

        $content = File::get($path);

        foreach ($values as $key => $value) {
            if (! is_string($key) || $key === '') {
                continue;
            }
            if ($value === null) {
                continue;
            }
            $str = is_bool($value) ? ($value ? 'true' : 'false') : (string) $value;
            $escaped = str_replace(['\\', '"', '$'], ['\\\\', '\\"', '\\$'], $str);
            $line = "{$key}=\"{$escaped}\"";

            if (preg_match('/^'.preg_quote($key, '/').'=/m', $content) === 1) {
                $content = (string) preg_replace(
                    '/^'.preg_quote($key, '/').'=.*/m',
                    $line,
                    $content,
                );
            } else {
                $content = rtrim($content)."\n{$line}\n";
            }
        }

        File::put($path, $content);
    }
}
