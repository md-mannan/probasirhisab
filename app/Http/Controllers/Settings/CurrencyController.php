<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\CurrencyUpdateRequest;
use App\Models\ExchangeRateSetting;
use App\Services\ExchangeRateService;
use App\Support\Currency;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Inertia\Inertia;
use Inertia\Response;

class CurrencyController extends Controller
{
    public function edit(Request $request): Response
    {
        $user = $request->user();

        $primary = $user?->primary_currency ?: 'KWD';
        $secondary = $user?->secondary_currency ?: 'BDT';

        $setting = ExchangeRateSetting::the();
        $configured = filled($setting->exchange_rate_api_url);

        $canConfigureApi = $user?->role->canAccessUserManagement() ?? false;

        $rate = null;
        if ($configured) {
            $rate = app(ExchangeRateService::class)->getRate(
                $primary,
                $secondary,
                $setting->exchange_rate_api_url,
                $setting->exchange_rate_api_key,
            );
        }

        $decimals = Currency::decimalsFor($secondary);
        $formattedRate = $rate === null ? null : number_format($rate, $decimals, '.', '');

        return Inertia::render('settings/currency', [
            'supported' => Currency::supported(),
            'primary' => $primary,
            'secondary' => $secondary,
            'canConfigureExchangeApi' => $canConfigureApi,
            'exchangeRateApiUrl' => $canConfigureApi ? $setting->exchange_rate_api_url : null,
            'hasExchangeRateApiKey' => $canConfigureApi && filled($setting->exchange_rate_api_key),
            'configured' => $configured,
            'rateLine' => $formattedRate === null ? null : "1 {$primary} = {$formattedRate} {$secondary}",
        ]);
    }

    public function update(CurrencyUpdateRequest $request): RedirectResponse
    {
        $user = $request->user();
        $data = $request->validated();

        $user->fill(Arr::only($data, ['primary_currency', 'secondary_currency']));
        $user->save();

        if ($user->role->canAccessUserManagement()) {
            $setting = ExchangeRateSetting::the();

            if (array_key_exists('exchange_rate_api_key', $data) && blank($data['exchange_rate_api_key'])) {
                unset($data['exchange_rate_api_key']);
            }

            if (array_key_exists('exchange_rate_api_url', $data) && blank($data['exchange_rate_api_url'])) {
                $data['exchange_rate_api_url'] = null;
            }

            if (array_key_exists('exchange_rate_api_url', $data)) {
                $setting->exchange_rate_api_url = $data['exchange_rate_api_url'];
                if ($data['exchange_rate_api_url'] === null) {
                    $setting->exchange_rate_api_key = null;
                }
            }

            if (array_key_exists('exchange_rate_api_key', $data) && filled($data['exchange_rate_api_key'])) {
                $setting->exchange_rate_api_key = $data['exchange_rate_api_key'];
            }

            $setting->save();
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Currency settings updated.')]);

        return to_route('currency.edit');
    }
}
