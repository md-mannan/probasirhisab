<?php

namespace App\Http\Middleware;

use App\Support\Installation;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class UseFileSessionWhenNotInstalled
{
    public function handle(Request $request, Closure $next): Response
    {
        // Installer routes must never use DB sessions: table may not exist yet.
        // Also handle leftover .installed with a broken/partial DB setup.
        if (! Installation::installed()
            || $request->routeIs('install.*')
            || $request->is('install')) {
            config(['session.driver' => 'file']);
        }

        return $next($request);
    }
}
