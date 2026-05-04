<?php

namespace App\Http\Middleware;

use App\Support\Installation;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class RedirectIfInstallerCompleted
{
    public function handle(Request $request, Closure $next): Response
    {
        if (Installation::installed()) {
            return Auth::check()
                ? redirect()->route('dashboard')
                : redirect()->route('home');
        }

        return $next($request);
    }
}
