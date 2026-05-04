<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

final class ExchangeRateService
{
    public function getRate(
        string $from,
        string $to,
        ?string $userUrlTemplate = null,
        ?string $userApiKey = null,
    ): ?float {
        $from = strtoupper(trim($from));
        $to = strtoupper(trim($to));

        if ($from === '' || $to === '') {
            return null;
        }

        if ($from === $to) {
            return 1.0;
        }

        $cacheKey = 'fx.rate.'.sha1(json_encode([
            'from' => $from,
            'to' => $to,
            'url' => (string) $userUrlTemplate,
            'key' => (string) $userApiKey,
        ]));

        return Cache::remember($cacheKey, now()->addMinutes(15), function () use ($from, $to, $userUrlTemplate, $userApiKey) {
            $defaultBase = (string) config('services.exchange_rates.base_url', 'https://open.er-api.com/v6/latest/');

            $template = trim((string) ($userUrlTemplate ?: $defaultBase));
            $url = $this->buildUrl($template, $from, $userApiKey);

            try {
                $request = Http::retry(2, 200)
                    ->timeout(8)
                    ->acceptJson();

                if (app()->isLocal()) {
                    $request = $request->withoutVerifying();
                }

                $response = $request->get($url);
            } catch (\Throwable) {
                return null;
            }

            if (! $response->ok()) {
                return null;
            }

            $json = $response->json();

            if (! is_array($json)) {
                return null;
            }

            // Support multiple common API shapes.
            // - open.er-api.com: { rates: { USD: 1.23 } }
            // - exchangerate-api.com: { conversion_rates: { USD: 1.23 } }
            $rates = $json['rates'] ?? $json['conversion_rates'] ?? null;
            if (! is_array($rates)) {
                return null;
            }

            $rate = $rates[$to] ?? null;

            return is_numeric($rate) ? (float) $rate : null;
        });
    }

    private function buildUrl(string $template, string $base, ?string $apiKey): string
    {
        $template = rtrim($template, '/');

        if (str_contains($template, '{base}') || str_contains($template, '{key}')) {
            return str_replace(
                ['{base}', '{key}'],
                [$base, (string) $apiKey],
                $template
            );
        }

        // Heuristic: ExchangeRate-API "v6" base URL entered without placeholders.
        // Expected: https://v6.exchangerate-api.com/v6/{key}/latest/{base}
        if (str_contains($template, 'exchangerate-api.com/v6') && filled($apiKey)) {
            return "{$template}/{$apiKey}/latest/{$base}";
        }

        // Heuristic: open.er-api default base entered without placeholders.
        // Expected: https://open.er-api.com/v6/latest/{base}
        if (str_contains($template, 'open.er-api.com/v6/latest')) {
            return "{$template}/{$base}";
        }

        // Default behavior: treat template as a base URL that needs "/{base}" appended.
        return "{$template}/{$base}";
    }
}
