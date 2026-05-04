<?php

namespace App\Http\Requests\Settings;

use App\Support\Currency;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CurrencyUpdateRequest extends FormRequest
{
    public function rules(): array
    {
        $admin = $this->user()?->role->canAccessUserManagement() ?? false;

        $rules = [
            'primary_currency' => ['nullable', 'string', 'size:3', Rule::in(Currency::codes())],
            'secondary_currency' => ['nullable', 'string', 'size:3', Rule::in(Currency::codes()), 'different:primary_currency'],
        ];

        if ($admin) {
            $rules['exchange_rate_api_url'] = ['nullable', 'string', 'max:2048', 'url'];
            $rules['exchange_rate_api_key'] = ['nullable', 'string', 'max:255'];
        } else {
            $rules['exchange_rate_api_url'] = ['prohibited'];
            $rules['exchange_rate_api_key'] = ['prohibited'];
        }

        return $rules;
    }
}
