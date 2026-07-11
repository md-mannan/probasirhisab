<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('wayfinder:generate-safe {--path=} {--skip-actions} {--skip-routes} {--with-form}', function () {
    $lockPath = storage_path('framework/wayfinder-generate.lock');
    File::ensureDirectoryExists(dirname($lockPath));

    $lockHandle = fopen($lockPath, 'c+');
    if ($lockHandle === false) {
        throw new RuntimeException("Unable to open lock file at {$lockPath}");
    }

    try {
        if (! flock($lockHandle, LOCK_EX)) {
            throw new RuntimeException('Unable to acquire wayfinder generation lock');
        }

        Artisan::call('wayfinder:generate', [
            '--path' => $this->option('path'),
            '--skip-actions' => (bool) $this->option('skip-actions'),
            '--skip-routes' => (bool) $this->option('skip-routes'),
            '--with-form' => (bool) $this->option('with-form'),
        ], $this->output);

        $dedupe = function (string $baseDir): void {
            if (! is_dir($baseDir)) {
                return;
            }

            foreach (File::allFiles($baseDir) as $file) {
                if ($file->getExtension() !== 'ts') {
                    continue;
                }

                $contents = File::get($file->getPathname());
                $lines = preg_split('/\\r\\n|\\n|\\r/', $contents);
                if (! is_array($lines) || count($lines) < 2) {
                    continue;
                }

                while (
                    count($lines) >= 2
                    && $lines[0] === $lines[1]
                    && str_starts_with($lines[0], 'import {')
                ) {
                    array_splice($lines, 1, 1);
                }

                $fixed = implode(PHP_EOL, $lines);
                if ($fixed !== $contents) {
                    File::put($file->getPathname(), $fixed);
                }
            }
        };

        $base = $this->option('path') ?: resource_path('js');
        $dedupe($base.DIRECTORY_SEPARATOR.'routes');
        $dedupe($base.DIRECTORY_SEPARATOR.'actions');
    } finally {
        flock($lockHandle, LOCK_UN);
        fclose($lockHandle);
    }
})->purpose('Generate Wayfinder types safely (deduped)');
