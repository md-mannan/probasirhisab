<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Support\Branding;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class BrandingController extends Controller
{
    public function edit(): Response
    {
        return Inertia::render('settings/branding', [
            'logoUrl' => Branding::logoUrl(),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $request->validate([
            'logo' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ]);

        // Store to the fixed logo path, replacing any existing logo. Storing as PNG
        // path keeps the app-wide URL stable; the image bytes may be any supported type.
        Storage::disk('public')->putFileAs(
            '/',
            $request->file('logo'),
            Branding::LOGO_PATH,
        );

        // Ensure the public symlink exists so the file is served (idempotent).
        $this->ensureStorageLink();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Logo updated.')]);

        return to_route('settings.branding.edit');
    }

    public function destroy(): RedirectResponse
    {
        Branding::deleteLogo();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Logo removed.')]);

        return to_route('settings.branding.edit');
    }

    private function ensureStorageLink(): void
    {
        if (file_exists(public_path('storage'))) {
            return;
        }

        try {
            Artisan::call('storage:link');
        } catch (\Throwable) {
            // Non-fatal: on some hosts the link is created manually or unsupported.
        }
    }
}
