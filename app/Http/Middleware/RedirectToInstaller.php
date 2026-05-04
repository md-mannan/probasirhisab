<?php

namespace App\Http\Middleware;

use App\Support\Installation;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RedirectToInstaller
{
    public function handle(Request $request, Closure $next): Response
    {
        if (Installation::installed()) {
            return $next($request);
        }

        if ($request->routeIs('install.*') || $request->is('install')) {
            return $next($request);
        }

        if ($request->is('up') || $request->is('livewire/*')) {
            return $next($request);
        }

        return redirect()->route('install.show');
    }
}
