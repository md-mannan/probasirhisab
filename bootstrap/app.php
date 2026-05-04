<?php

use App\Http\Middleware\EnsureStaffAccess;
use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\RedirectIfInstallerCompleted;
use App\Http\Middleware\RedirectToInstaller;
use App\Http\Middleware\SetLocale;
use App\Http\Middleware\UseFileSessionWhenNotInstalled;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);

        $middleware->prependToGroup('web', UseFileSessionWhenNotInstalled::class);
        $middleware->web(append: [
            HandleAppearance::class,
            SetLocale::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
            RedirectToInstaller::class,
        ]);
        $middleware->alias([
            'install.guest' => RedirectIfInstallerCompleted::class,
            'staff' => EnsureStaffAccess::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->renderable(function (Throwable $e, Request $request) {
            if ($request->is('api/*')) {
                return null;
            }

            if ($e instanceof ValidationException) {
                return null;
            }

            if ($e instanceof AuthenticationException) {
                return null;
            }

            if ($e instanceof HttpResponseException) {
                return null;
            }

            if ($request->expectsJson() && ! $request->header('X-Inertia')) {
                return null;
            }

            $status = $e instanceof HttpExceptionInterface
                ? $e->getStatusCode()
                : 500;

            if ($status < 100 || $status > 599) {
                $status = 500;
            }

            if ($status >= 500) {
                Log::error($e->getMessage(), ['exception' => $e]);
            }

            $title = match (true) {
                $status === 404 => __('Page not found'),
                $status === 403 => __('Access denied'),
                $status === 401 => __('Sign in required'),
                $status === 419 => __('Session expired'),
                $status === 429 => __('Too many requests'),
                $status === 503 => __('Service unavailable'),
                $status >= 500 => __('Something went wrong'),
                default => __('Something went wrong'),
            };

            $description = config('app.debug')
                ? $e->getMessage()
                : match (true) {
                    $status === 404 => __('The page you are looking for does not exist or was moved.'),
                    $status === 403 => __('You do not have permission to view this resource.'),
                    $status === 419 => __('Please refresh the page and try again.'),
                    $status === 503 => __('We are temporarily unavailable. Please try again shortly.'),
                    $status >= 500 => __('An unexpected error occurred. Please try again in a moment.'),
                    default => __('Please try again or return to the dashboard.'),
                };

            return Inertia::render('errors/Error', [
                'status' => $status,
                'title' => $title,
                'description' => $description,
            ])->toResponse($request)->setStatusCode($status);
        });
    })->create();
