<?php

namespace App\Http\Middleware;

use App\Support\Installation;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SetLocale
{
    /**
     * Locale priority when installed: authenticated user's preference → APP_LOCALE.
     * During install: session install_locale → APP_LOCALE.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $supported = array_keys(config('locales.supported'));
        $fallback = config('app.fallback_locale');

        if (! Installation::installed()) {
            $locale = session('install_locale', config('app.locale'));
        } else {
            $locale = config('app.locale');

            $user = $request->user();
            if ($user !== null) {
                $preferred = $user->locale;
                if (is_string($preferred) && $preferred !== '' && in_array($preferred, $supported, true)) {
                    $locale = $preferred;
                }
            }
        }

        if (! in_array($locale, $supported, true)) {
            $locale = in_array($fallback, $supported, true) ? $fallback : ($supported[0] ?? 'en');
        }

        app()->setLocale($locale);

        return $next($request);
    }
}
