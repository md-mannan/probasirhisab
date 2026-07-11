<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\User;
use App\Services\EnvFileWriter;
use App\Support\Branding;
use App\Support\Installation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class InstallController extends Controller
{
    public function show(): Response|RedirectResponse
    {
        if (Installation::installed()) {
            return redirect()->route(Auth::check() ? 'dashboard' : 'home');
        }

        return Inertia::render('install/wizard', [
            'requirements' => $this->requirementCheck(),
            't' => trans('install'),
            'availableLocales' => config('locales.supported'),
            'locale' => app()->getLocale(),
        ]);
    }

    public function setLocale(Request $request): RedirectResponse
    {
        if (Installation::installed()) {
            abort(404);
        }

        $request->validate([
            'locale' => ['required', 'string', Rule::in(array_keys(config('locales.supported')))],
        ]);

        session(['install_locale' => $request->string('locale')->toString()]);

        return back();
    }

    public function store(Request $request, EnvFileWriter $envWriter): RedirectResponse
    {
        if (Installation::installed()) {
            return redirect()->route(Auth::check() ? 'dashboard' : 'home');
        }

        $validator = Validator::make($request->all(), [
            'app_name' => ['required', 'string', 'max:100'],
            'app_url' => ['nullable', 'string', 'max:255'],
            'db_driver' => ['required', 'in:mysql,sqlite'],
            'db_host' => [
                Rule::requiredIf($request->input('db_driver') === 'mysql'),
                'nullable',
                'string',
                'max:255',
            ],
            'db_port' => ['nullable', 'integer', 'min:1', 'max:65535'],
            'db_database' => ['required', 'string', 'max:255'],
            'db_username' => [
                Rule::requiredIf($request->input('db_driver') === 'mysql'),
                'nullable',
                'string',
                'max:255',
            ],
            'db_password' => ['nullable', 'string', 'max:255'],
            'admin_name' => ['required', 'string', 'max:255'],
            'admin_email' => ['required', 'email', 'max:255'],
            'admin_password' => ['required', 'string', 'confirmed', Password::defaults()],
            'logo' => ['nullable', 'file', 'image', 'max:2048'],
            'app_locale' => ['required', 'string', Rule::in(array_keys(config('locales.supported')))],
        ]);

        if ($validator->fails()) {
            return back()->withErrors($validator)->withInput();
        }

        $data = $validator->validated();

        try {
            $this->reconnectInstallerDatabase($data);
        } catch (\Throwable $e) {
            return back()
                ->withErrors(['db' => 'Could not connect to the database: '.$e->getMessage()])
                ->withInput();
        }

        try {
            $exitCode = Artisan::call('migrate', ['--force' => true]);
            if ($exitCode !== 0) {
                return back()
                    ->withErrors([
                        'db' => 'Migration failed: '.trim(Artisan::output()) ?: 'Exit code '.$exitCode,
                    ])
                    ->withInput();
            }
        } catch (\Throwable $e) {
            return back()
                ->withErrors(['db' => 'Migration failed: '.$e->getMessage()])
                ->withInput();
        }

        // Artisan may reload config from disk; reconnect before any User queries.
        try {
            $this->reconnectInstallerDatabase($data);
        } catch (\Throwable $e) {
            return back()
                ->withErrors(['db' => 'Could not reconnect after migrations: '.$e->getMessage()])
                ->withInput();
        }

        if (User::query()->exists()) {
            return back()
                ->withErrors(['db' => 'Database is not empty. Use a fresh database for installation.'])
                ->withInput();
        }

        $user = User::query()->create([
            'name' => $data['admin_name'],
            'email' => $data['admin_email'],
            'password' => $data['admin_password'],
            'email_verified_at' => now(),
            'role' => UserRole::SuperAdmin,
        ]);

        $appUrl = rtrim($data['app_url'] ?? url('/'), '/');

        $dbPort = $data['db_driver'] === 'mysql'
            ? (int) ($data['db_port'] ?? 3306)
            : null;

        $envWriter->merge([
            'APP_NAME' => $data['app_name'],
            'APP_URL' => $appUrl,
            'VITE_APP_NAME' => $data['app_name'],
            'APP_LOCALE' => $data['app_locale'],
            'DB_CONNECTION' => $data['db_driver'],
        ]);

        if ($data['db_driver'] === 'mysql') {
            $envWriter->merge([
                'DB_HOST' => $data['db_host'] ?? '127.0.0.1',
                'DB_PORT' => (string) $dbPort,
                'DB_DATABASE' => $data['db_database'],
                'DB_USERNAME' => $data['db_username'] ?? '',
                'DB_PASSWORD' => (string) ($data['db_password'] ?? ''),
            ]);
        } else {
            $path = $data['db_database'];
            if (! str_starts_with($path, '/') && ! preg_match('/^[A-Za-z]:\\\\/', $path)) {
                $path = database_path($path);
            }
            $envWriter->merge([
                'DB_DATABASE' => $path,
            ]);
        }

        if ($request->hasFile('logo')) {
            Storage::disk('public')->putFileAs('/', $request->file('logo'), Branding::LOGO_PATH);
        }

        Installation::markInstalled();

        $request->session()->forget('install_locale');

        try {
            Artisan::call('storage:link');
        } catch (\Throwable) {
            // Already linked or failed — non-fatal
        }

        Auth::login($user);

        return redirect()->route('dashboard');
    }

    /**
     * @return array<string, bool|string>
     */
    private function requirementCheck(): array
    {
        return [
            'php' => PHP_VERSION_ID >= 80300,
            'php_version' => PHP_VERSION,
            'writable_storage' => is_writable(storage_path())
                && is_writable(base_path('bootstrap/cache')),
            'env_present' => file_exists(base_path('.env')) || file_exists(base_path('.env.example')),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function reconnectInstallerDatabase(array $data): void
    {
        $this->applyRuntimeDatabaseConfig(
            $data['db_driver'],
            $data['db_host'] ?? '127.0.0.1',
            (int) ($data['db_port'] ?? ($data['db_driver'] === 'mysql' ? 3306 : 0)),
            $data['db_database'],
            $data['db_username'] ?? '',
            (string) ($data['db_password'] ?? ''),
        );
        DB::purge();
        DB::connection()->getPdo();
    }

    private function applyRuntimeDatabaseConfig(
        string $driver,
        string $host,
        int $port,
        string $database,
        string $username,
        string $password,
    ): void {
        if ($driver === 'sqlite') {
            $path = $database;
            if (! str_starts_with($path, '/') && ! preg_match('/^[A-Za-z]:\\\\/', $path)) {
                $path = database_path($path);
            }
            $dir = dirname($path);
            if (! is_dir($dir)) {
                mkdir($dir, 0755, true);
            }
            if (! file_exists($path)) {
                touch($path);
            }

            Config::set([
                'database.default' => 'sqlite',
                'database.connections.sqlite.database' => $path,
            ]);

            return;
        }

        Config::set([
            'database.default' => 'mysql',
            'database.connections.mysql.driver' => 'mysql',
            'database.connections.mysql.host' => $host,
            'database.connections.mysql.port' => $port ?: 3306,
            'database.connections.mysql.database' => $database,
            'database.connections.mysql.username' => $username,
            'database.connections.mysql.password' => $password,
            'database.connections.mysql.unix_socket' => '',
        ]);
    }
}
