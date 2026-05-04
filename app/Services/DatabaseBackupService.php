<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use PDO;
use RuntimeException;
use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\ExecutableFinder;
use Symfony\Component\Process\Process;

class DatabaseBackupService
{
    /** @return array<string, mixed> */
    public function connectionConfig(): array
    {
        $name = Config::get('database.default');

        if (! is_string($name) || $name === '') {
            throw new RuntimeException('Database connection is not configured.');
        }

        $config = Config::get("database.connections.{$name}");

        if (! is_array($config)) {
            throw new RuntimeException('Database connection is not configured.');
        }

        return $config;
    }

    public function driverName(): string
    {
        return (string) ($this->connectionConfig()['driver'] ?? '');
    }

    public function driverLabel(): string
    {
        return match ($this->driverName()) {
            'mysql' => 'MySQL',
            'mariadb' => 'MariaDB',
            'sqlite' => 'SQLite',
            default => strtoupper($this->driverName()),
        };
    }

    public function supportsBackup(): bool
    {
        return match ($this->driverName()) {
            'sqlite' => $this->sqlitePath() !== ':memory:'
                && $this->sqlitePath() !== ''
                && is_file($this->sqlitePath()),
            'mysql', 'mariadb' => $this->binaryPath('mysqldump') !== null,
            default => false,
        };
    }

    public function supportsRestore(): bool
    {
        if (! Config::get('database_backup.restore_enabled', true)) {
            return false;
        }

        return match ($this->driverName()) {
            'sqlite' => $this->sqlitePath() !== ':memory:'
                && $this->sqlitePath() !== ''
                && is_file($this->sqlitePath()),
            'mysql', 'mariadb' => $this->binaryPath('mysql') !== null,
            default => false,
        };
    }

    public function suggestedFilename(): string
    {
        $stamp = now()->format('Y-m-d_His');

        return match ($this->driverName()) {
            'sqlite' => "backup-{$stamp}.sqlite",
            default => Config::get('database_backup.mysql.essential_only', true)
                ? "backup-essential-{$stamp}.sql"
                : "backup-{$stamp}.sql",
        };
    }

    public function mysqlBackupScopeDescription(): ?string
    {
        if (! in_array($this->driverName(), ['mysql', 'mariadb'], true)) {
            return null;
        }

        return Config::get('database_backup.mysql.essential_only', true)
            ? 'Includes only core data: users, categories, contacts, transactions, ledger entries, settlements, contact links, and migration history. Omits sessions, cache, queues, failed jobs, and password-reset tokens.'
            : 'Full database dump except sessions, cache, queue tables, failed jobs, and password-reset tokens (stored routines included).';
    }

    /** @return non-empty-string */
    public function mysqlDumpToTempFile(): string
    {
        $sqlPath = $this->tempStoragePath('dump-'.Str::random(16).'.sql');

        File::ensureDirectoryExists(dirname($sqlPath));

        $cnfPath = $this->writeMysqlClientCnf($this->connectionConfig());

        try {
            $binary = $this->binaryPath('mysqldump');

            if ($binary === null) {
                throw new RuntimeException('The mysqldump program was not found on this server.');
            }

            $timeout = (int) Config::get('database_backup.process_timeout_seconds', 3600);

            $process = new Process(
                $this->buildMysqlDumpArgv($binary, $cnfPath, $sqlPath),
                $this->mysqlClientWorkingDirectory($binary),
            );
            $process->setTimeout($timeout);

            try {
                $process->mustRun(null, $this->windowsMysqlSubprocessEnv());
            } catch (ProcessFailedException $e) {
                Log::warning('mysqldump failed.', [
                    'binary' => $binary,
                    'cwd' => $process->getWorkingDirectory(),
                    'exit_code' => $process->getExitCode(),
                    'stderr' => $process->getErrorOutput(),
                ]);

                throw new RuntimeException('Could not create a database backup. Check server logs.');
            }

            return $sqlPath;
        } finally {
            if (is_file($cnfPath)) {
                unlink($cnfPath);
            }
        }
    }

    /**
     * @return array<int, string>
     */
    protected function buildMysqlDumpArgv(string $binary, string $cnfPath, string $sqlPath): array
    {
        $database = $this->databaseName();
        $essentialOnly = (bool) Config::get('database_backup.mysql.essential_only', true);

        $argv = [
            $binary,
            '--defaults-extra-file='.$cnfPath,
            ...(PHP_OS_FAMILY === 'Windows' ? ['--protocol=tcp'] : []),
            '--single-transaction',
            '--no-tablespaces',
            '--result-file='.$sqlPath,
        ];

        if (! $essentialOnly) {
            $argv[] = '--routines';
        }

        $argv = array_merge($argv, $this->mysqlDumpExtraArgs());

        if ($essentialOnly) {
            $tables = $this->resolvedEssentialMysqlTables();

            if ($tables === []) {
                throw new RuntimeException('No essential tables were found to include in the backup.');
            }

            $argv[] = $database;

            foreach ($tables as $table) {
                $argv[] = $table;
            }

            return $argv;
        }

        foreach ($this->resolvedIgnoredMysqlTables($database) as $qualified) {
            $argv[] = '--ignore-table='.$qualified;
        }

        $argv[] = $database;

        return $argv;
    }

    /**
     * @return array<int, string>
     */
    protected function resolvedEssentialMysqlTables(): array
    {
        $tables = Config::get('database_backup.mysql.essential_tables');

        if (! is_array($tables)) {
            return [];
        }

        $names = [];

        foreach ($tables as $table) {
            if (! is_string($table) || $table === '') {
                continue;
            }

            if (! Schema::hasTable($table)) {
                continue;
            }

            $names[$table] = $table;
        }

        return array_values($names);
    }

    /**
     * @return array<int, string>
     */
    protected function resolvedIgnoredMysqlTables(string $database): array
    {
        $tables = Config::get('database_backup.mysql.excluded_tables');

        if (! is_array($tables)) {
            return [];
        }

        $qualified = [];

        foreach ($tables as $table) {
            if (! is_string($table) || $table === '') {
                continue;
            }

            if (! Schema::hasTable($table)) {
                continue;
            }

            $qualified[] = $database.'.'.$table;
        }

        return $qualified;
    }

    /**
     * @return array<int, string>
     */
    protected function mysqlDumpExtraArgs(): array
    {
        return [];
    }

    public function sqliteDatabasePath(): string
    {
        $database = $this->connectionConfig()['database'] ?? '';

        return is_string($database) ? $database : '';
    }

    protected function sqlitePath(): string
    {
        return $this->sqliteDatabasePath();
    }

    public function restoreFromUpload(UploadedFile $upload): void
    {
        $ext = strtolower($upload->getClientOriginalExtension());

        match ($this->driverName()) {
            'sqlite' => $ext === 'sqlite'
                ? $this->restoreSqliteFile($upload)
                : throw new RuntimeException('SQLite restore requires a .sqlite file.'),
            'mysql', 'mariadb' => $ext === 'sql'
                ? $this->restoreMysqlFromSqlFile($upload)
                : throw new RuntimeException('MySQL/MariaDB restore requires a .sql file.'),
            default => throw new RuntimeException('Restore is not supported for this database driver.'),
        };
    }

    protected function restoreMysqlFromSqlFile(UploadedFile $upload): void
    {
        $binary = $this->binaryPath('mysql');

        if ($binary === null) {
            throw new RuntimeException('The mysql client was not found on this server.');
        }

        $absolute = $upload->getRealPath();

        if ($absolute === false || ! is_file($absolute)) {
            throw new RuntimeException('Could not read the uploaded backup file.');
        }

        $this->assertSqlPlainTextFile($absolute);

        $config = $this->connectionConfig();
        $cnfPath = $this->writeMysqlClientCnf($config);
        $timeout = (int) Config::get('database_backup.process_timeout_seconds', 3600);

        try {
            $process = new Process(
                [
                    $binary,
                    '--defaults-extra-file='.$cnfPath,
                    ...(PHP_OS_FAMILY === 'Windows' ? ['--protocol=tcp'] : []),
                    $this->databaseName(),
                ],
                $this->mysqlClientWorkingDirectory($binary),
            );
            $process->setTimeout($timeout);
            $handle = fopen($absolute, 'rb');

            if ($handle === false) {
                throw new RuntimeException('Could not read the uploaded backup file.');
            }

            $process->setInput($handle);

            try {
                $process->mustRun(null, $this->windowsMysqlSubprocessEnv());
            } catch (ProcessFailedException $e) {
                Log::warning('mysql restore failed.', [
                    'binary' => $binary,
                    'cwd' => $process->getWorkingDirectory(),
                    'exit_code' => $process->getExitCode(),
                    'stderr' => $process->getErrorOutput(),
                ]);

                throw new RuntimeException('Database restore failed. Check server logs.');
            } finally {
                fclose($handle);
            }
        } finally {
            if (is_file($cnfPath)) {
                unlink($cnfPath);
            }
        }
    }

    protected function restoreSqliteFile(UploadedFile $upload): void
    {
        $target = $this->sqliteDatabasePath();

        if ($target === ':memory:' || $target === '') {
            throw new RuntimeException('Cannot restore into an in-memory SQLite database.');
        }

        $absolute = $upload->getRealPath();

        if ($absolute === false || ! is_file($absolute)) {
            throw new RuntimeException('Could not read the uploaded backup file.');
        }

        $this->assertSqliteBackupFile($absolute);

        DB::disconnect();

        $default = Config::get('database.default');

        if (is_string($default) && $default !== '') {
            DB::purge($default);
        }

        if (! @copy($absolute, $target)) {
            throw new RuntimeException('Could not replace the database file. Check permissions.');
        }

        @chmod($target, 0644);

        if (is_string($default) && $default !== '') {
            DB::reconnect($default);
        }

        $pdo = new PDO('sqlite:'.$target, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        ]);

        $check = $pdo->query('PRAGMA quick_check')->fetchColumn();

        if ($check !== 'ok') {
            throw new RuntimeException('Restored SQLite file failed integrity check.');
        }
    }

    protected function assertSqliteBackupFile(string $path): void
    {
        $handle = fopen($path, 'rb');

        if ($handle === false) {
            throw new RuntimeException('Could not read the backup file.');
        }

        $header = fread($handle, 16);
        fclose($handle);

        if (! is_string($header) || ! str_starts_with($header, 'SQLite format 3'.chr(0))) {
            throw new RuntimeException('The file is not a valid SQLite database backup.');
        }
    }

    protected function assertSqlPlainTextFile(string $path): void
    {
        $handle = fopen($path, 'rb');

        if ($handle === false) {
            throw new RuntimeException('Could not read the backup file.');
        }

        $chunk = fread($handle, 65536);
        fclose($handle);

        if (! is_string($chunk) || $chunk === '') {
            throw new RuntimeException('The backup file is empty.');
        }

        if (preg_match('/[\x00]/', $chunk) === 1) {
            throw new RuntimeException('This backup file does not look like a plain SQL dump.');
        }
    }

    protected function databaseName(): string
    {
        return (string) ($this->connectionConfig()['database'] ?? '');
    }

    /**
     * @param  array<string, mixed>  $config
     */
    protected function writeMysqlClientCnf(array $config): string
    {
        $path = $this->tempStoragePath('mysql-'.Str::random(16).'.cnf');

        File::ensureDirectoryExists(dirname($path));

        $user = (string) ($config['username'] ?? 'root');
        $password = (string) ($config['password'] ?? '');
        $socket = (string) ($config['unix_socket'] ?? '');

        $lines = [
            '[client]',
            'user='.$user,
            'password='.$password,
        ];

        if ($socket !== '') {
            $lines[] = 'socket='.$socket;
        } else {
            $host = trim((string) ($config['host'] ?? '127.0.0.1'));
            $port = trim((string) ($config['port'] ?? '3306'));

            $lines[] = 'host='.($host !== '' ? $host : '127.0.0.1');
            $lines[] = 'port='.($port !== '' ? $port : '3306');

            // Windows WAMP installs can fail unless TCP is explicit.
            if (PHP_OS_FAMILY === 'Windows') {
                $lines[] = 'protocol=tcp';
            }
        }

        File::put($path, implode("\n", $lines)."\n");
        chmod($path, 0600);

        return $path;
    }

    protected function mysqlClientWorkingDirectory(?string $binary): ?string
    {
        if (PHP_OS_FAMILY !== 'Windows' || ! is_string($binary) || $binary === '') {
            return null;
        }

        $dir = dirname($binary);

        return is_dir($dir) ? $dir : null;
    }

    /**
     * php artisan serve (and some SAPI setups) can spawn subprocesses without a full OS environment.
     * That breaks Winsock for mysql.exe/mysqldump on Windows (MySQL error 2004 / WSA 10106).
     *
     * @return array<string, string>
     */
    protected function windowsMysqlSubprocessEnv(): array
    {
        if (PHP_OS_FAMILY !== 'Windows') {
            return [];
        }

        $keys = [
            'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'PATH',
            'USERNAME', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA', 'ALLUSERSPROFILE',
            'COMPUTERNAME', 'PROCESSOR_ARCHITECTURE',
            'ProgramFiles', 'ProgramFiles(x86)', 'CommonProgramFiles',
        ];

        $env = [];

        foreach ($keys as $key) {
            $value = $_SERVER[$key] ?? getenv($key);

            if (is_string($value) && $value !== '') {
                $env[$key] = $value;
            }
        }

        if (($env['SystemRoot'] ?? '') === '' || ! is_dir((string) $env['SystemRoot'])) {
            $env['SystemRoot'] = 'C:\\Windows';
        }

        if (($env['WINDIR'] ?? '') === '' || ! is_dir($env['WINDIR'])) {
            $env['WINDIR'] = $env['SystemRoot'];
        }

        $tmp = sys_get_temp_dir();
        $env['TEMP'] ??= $tmp;
        $env['TMP'] ??= $tmp;

        $path = getenv('PATH');

        if (is_string($path) && $path !== '' && ($env['PATH'] ?? '') === '') {
            $env['PATH'] = $path;
        }

        return $env;
    }

    protected function tempStoragePath(string $filename): string
    {
        // Use system temp to avoid spaces in path (Windows + MySQL tools can be picky).
        $base = rtrim((string) sys_get_temp_dir(), '\\/').DIRECTORY_SEPARATOR.'probasirhisab-backup';

        return $base.DIRECTORY_SEPARATOR.$filename;
    }

    protected function binaryPath(string $which): ?string
    {
        $configured = Config::get('database_backup.binaries.'.$which);

        if (is_string($configured) && $configured !== '' && is_executable($configured)) {
            return $configured;
        }

        $name = match ($which) {
            'mysqldump' => 'mysqldump',
            'mysql' => 'mysql',
            default => $which,
        };

        $finder = new ExecutableFinder;

        $found = $finder->find($name, null, [
            '/usr/bin',
            '/usr/local/bin',
            '/opt/homebrew/bin',
        ]);

        if ($found !== null && is_executable($found)) {
            return $found;
        }

        return $this->windowsBundledMysqlBinary($which);
    }

    /**
     * On Windows, MySQL often ships with WAMP/XAMPP but is not on PATH. Prefer newest version folder.
     */
    protected function windowsBundledMysqlBinary(string $which): ?string
    {
        if (PHP_OS_FAMILY !== 'Windows') {
            return null;
        }

        $exe = match ($which) {
            'mysqldump' => 'mysqldump.exe',
            'mysql' => 'mysql.exe',
            default => null,
        };

        if ($exe === null) {
            return null;
        }

        $bases = [
            'C:\\wamp64\\bin\\mysql',
            'C:\\wamp\\bin\\mysql',
            'D:\\wamp64\\bin\\mysql',
            'D:\\wamp\\bin\\mysql',
            'C:\\xampp\\mysql\\bin',
            'D:\\xampp\\mysql\\bin',
        ];

        $matches = [];

        foreach ($bases as $base) {
            if ($base === 'C:\\xampp\\mysql\\bin' || $base === 'D:\\xampp\\mysql\\bin') {
                $candidate = $base.'\\'.$exe;

                if (is_file($candidate)) {
                    $matches[] = $candidate;
                }

                continue;
            }

            if (! is_dir($base)) {
                continue;
            }

            $globbed = glob($base.'\\*\\bin\\'.$exe) ?: [];

            foreach ($globbed as $path) {
                if (is_file($path)) {
                    $matches[] = $path;
                }
            }
        }

        if ($matches === []) {
            return null;
        }

        rsort($matches);

        $chosen = $matches[0];

        if (is_executable($chosen)) {
            return $chosen;
        }

        return is_file($chosen) ? $chosen : null;
    }
}
