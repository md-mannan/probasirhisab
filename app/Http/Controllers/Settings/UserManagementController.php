<?php

namespace App\Http\Controllers\Settings;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\SharedCatalog;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Inertia\Inertia;
use Inertia\Response;

class UserManagementController extends Controller
{
    public function index(Request $request): Response
    {
        $this->authorize('viewAny', User::class);

        $users = User::query()
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'role', 'created_at']);

        return Inertia::render('settings/users', [
            'users' => $users->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'role' => $u->role->value,
                'role_label' => $u->role->label(),
                'created_at' => $u->created_at?->toIso8601String(),
            ]),
            'roleOptions' => collect(UserRole::cases())->map(fn (UserRole $r) => [
                'value' => $r->value,
                'label' => $r->label(),
            ])->values()->all(),
            'canAssignRoles' => collect(UserRole::cases())
                ->filter(fn (UserRole $r) => $request->user()?->role->canAssignRole($r) ?? false)
                ->map(fn (UserRole $r) => [
                    'value' => $r->value,
                    'label' => $r->label(),
                ])
                ->values()
                ->all(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->authorize('create', User::class);

        $allowedRoles = collect(UserRole::cases())
            ->filter(fn (UserRole $r) => $request->user()?->role->canAssignRole($r) ?? false)
            ->map(fn (UserRole $r) => $r->value)
            ->values()
            ->all();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'confirmed', PasswordRule::defaults()],
            'role' => ['required', Rule::in($allowedRoles)],
        ]);

        User::query()->create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => $validated['password'],
            'email_verified_at' => now(),
            'role' => UserRole::from($validated['role']),
        ]);

        SharedCatalog::flushCache();

        return redirect()->route('settings.users.index')->with('status', 'User created.');
    }

    public function updateRole(Request $request, User $user): RedirectResponse
    {
        $this->authorize('update', $user);

        $validated = $request->validate([
            'role' => [
                'required',
                Rule::enum(UserRole::class),
                function (string $attribute, mixed $value, \Closure $fail) use ($request): void {
                    $role = UserRole::from((string) $value);
                    if (! $request->user()?->role->canAssignRole($role)) {
                        $fail('You cannot assign this role.');
                    }
                },
            ],
        ]);

        $newRole = UserRole::from($validated['role']);

        if ($user->id === $request->user()?->id && $newRole !== UserRole::SuperAdmin) {
            return back()->withErrors(['role' => 'You cannot remove super admin from yourself.']);
        }

        $user->update(['role' => $newRole]);

        SharedCatalog::flushCache();

        return redirect()->route('settings.users.index')->with('status', 'Role updated.');
    }

    public function updatePassword(Request $request, User $user): RedirectResponse
    {
        $this->authorize('update', $user);

        if ($user->is($request->user())) {
            return redirect()
                ->route('settings.users.index')
                ->with('status', 'Use Security settings to change your own password.');
        }

        $validated = $request->validate([
            'password' => ['required', 'string', 'confirmed', PasswordRule::defaults()],
        ]);

        $user->update([
            'password' => $validated['password'],
        ]);

        return redirect()
            ->route('settings.users.index')
            ->with('status', "Password updated for {$user->name}.");
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        $this->authorize('delete', $user);

        $user->delete();

        SharedCatalog::flushCache();

        return redirect()->route('settings.users.index')->with('status', 'User removed.');
    }
}
