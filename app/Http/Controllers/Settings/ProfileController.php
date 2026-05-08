<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfileDeleteRequest;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use App\Models\User;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    /**
     * Show the user's profile settings page.
     */
    public function edit(Request $request): Response
    {
        return Inertia::render('settings/profile', [
            'mustVerifyEmail' => $request->user() instanceof MustVerifyEmail,
            'status' => $request->session()->get('status'),
            't' => trans('settings'),
        ]);
    }

    /**
     * Update the user's profile information.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();

        $data = $request->validated();

        if ($request->boolean('remove_avatar')) {
            $this->deleteStoredAvatar($user);
            $user->avatar_path = null;
        }

        if ($request->hasFile('avatar')) {
            $this->deleteStoredAvatar($user);

            $file = $request->file('avatar');
            $originalName = $file->getClientOriginalName();
            $baseName = pathinfo($originalName, PATHINFO_FILENAME);
            $extension = $file->getClientOriginalExtension();

            $safeBaseName = Str::slug($baseName);
            if ($safeBaseName === '') {
                $safeBaseName = 'avatar';
            }

            $safeExtension = strtolower($extension);
            $finalName = $safeExtension !== ''
                ? "{$safeBaseName}.{$safeExtension}"
                : $safeBaseName;

            $user->avatar_path = $file->storeAs("avatars/{$user->id}", $finalName, 'public');
        }

        $data = Arr::except($data, ['avatar', 'remove_avatar']);

        $user->fill($data);

        if ($user->isDirty('email')) {
            $user->email_verified_at = null;
        }

        $user->save();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Profile updated.')]);

        return to_route('profile.edit');
    }

    /**
     * Delete the user's profile.
     */
    public function destroy(ProfileDeleteRequest $request): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();

        Auth::logout();

        $user->deleteOrFail();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }

    protected function deleteStoredAvatar(User $user): void
    {
        if ($user->avatar_path === null || $user->avatar_path === '') {
            return;
        }

        Storage::disk('public')->delete($user->avatar_path);
    }
}
