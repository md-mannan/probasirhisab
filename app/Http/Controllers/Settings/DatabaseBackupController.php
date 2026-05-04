<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\RestoreDatabaseRequest;
use App\Services\DatabaseBackupService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Throwable;

class DatabaseBackupController extends Controller
{
    public function edit(DatabaseBackupService $service): Response
    {
        $driver = $service->driverName();

        $backupHint = $service->supportsBackup()
            ? null
            : match ($driver) {
                'sqlite' => 'Use a file-based SQLite database (not :memory:) so the database file can be copied.',
                'mysql', 'mariadb' => 'The mysqldump program was not found. Install MySQL client tools or set MYSQLDUMP_PATH in your environment.',
                default => 'Automated backup is not configured for this database driver.',
            };

        $restoreHint = $service->supportsRestore()
            ? null
            : (! config('database_backup.restore_enabled', true)
                ? 'Restore is disabled on this server (DB_BACKUP_RESTORE_ENABLED=false).'
                : match ($driver) {
                    'sqlite' => 'Use a file-based SQLite database (not :memory:) so the file can be replaced.',
                    'mysql', 'mariadb' => 'The mysql client was not found. Install MySQL client tools or set MYSQL_PATH in your environment.',
                    default => 'Restore is not configured for this database driver.',
                });

        return Inertia::render('settings/database', [
            'driverLabel' => $service->driverLabel(),
            'supportsBackup' => $service->supportsBackup(),
            'supportsRestore' => $service->supportsRestore(),
            'backupHint' => $backupHint,
            'restoreHint' => $restoreHint,
            'mysqlBackupScopeDescription' => $service->mysqlBackupScopeDescription(),
            'confirmPhrase' => (string) config('database_backup.confirm_phrase', 'RESTORE'),
        ]);
    }

    public function download(DatabaseBackupService $service): BinaryFileResponse|\Illuminate\Http\Response
    {
        if (! $service->supportsBackup()) {
            abort(503, 'Backup is not available for the current database configuration.');
        }

        return match ($service->driverName()) {
            'sqlite' => response()->download(
                $service->sqliteDatabasePath(),
                $service->suggestedFilename(),
                ['Content-Type' => 'application/x-sqlite3'],
            ),
            'mysql', 'mariadb' => response()->download(
                (function () use ($service): string {
                    try {
                        return $service->mysqlDumpToTempFile();
                    } catch (RuntimeException $e) {
                        abort(503, $e->getMessage());
                    }
                })(),
                $service->suggestedFilename(),
                ['Content-Type' => 'application/sql'],
            )->deleteFileAfterSend(true),
            default => abort(503, 'Backup is not supported for this database driver.'),
        };
    }

    public function restore(RestoreDatabaseRequest $request, DatabaseBackupService $service): RedirectResponse
    {
        if (! config('database_backup.restore_enabled', true)) {
            return redirect()
                ->route('settings.database.edit')
                ->withErrors(['backup' => 'Database restore is disabled on this server.']);
        }

        if (! $service->supportsRestore()) {
            return redirect()
                ->route('settings.database.edit')
                ->withErrors(['backup' => 'Restore is not available for the current database configuration.']);
        }

        try {
            $service->restoreFromUpload($request->file('backup'));
        } catch (RuntimeException $e) {
            return redirect()
                ->route('settings.database.edit')
                ->withErrors(['backup' => $e->getMessage()]);
        } catch (Throwable $e) {
            Log::error('Database restore failed unexpectedly.', [
                'exception' => $e,
                'user_id' => $request->user()?->id,
            ]);

            return redirect()
                ->route('settings.database.edit')
                ->withErrors(['backup' => 'Restore failed. Check server logs.']);
        }

        Log::warning('Database restored from backup upload.', [
            'user_id' => $request->user()?->id,
        ]);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __('Database was restored from the backup file.'),
        ]);

        return redirect()->route('settings.database.edit');
    }
}
