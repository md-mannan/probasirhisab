<?php

namespace App\Concerns;

use App\Models\User;
use App\Support\Currency;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule as ValidationRuleFacade;

trait ProfileValidationRules
{
    /**
     * Get the validation rules used to validate user profiles.
     *
     * @return array<string, array<int, ValidationRule|array<mixed>|string>>
     */
    protected function profileRules(?int $userId = null): array
    {
        return [
            'name' => $this->nameRules(),
            'email' => $this->emailRules($userId),
            'locale' => ['required', 'string', ValidationRuleFacade::in(array_keys(config('locales.supported')))],
            'primary_currency' => ['nullable', 'string', 'size:3', ValidationRuleFacade::in(Currency::codes())],
            'secondary_currency' => ['nullable', 'string', 'size:3', ValidationRuleFacade::in(Currency::codes()), 'different:primary_currency'],
            'avatar' => ['nullable', 'image', 'max:2048', 'mimes:jpeg,jpg,png,webp'],
            'remove_avatar' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * Get the validation rules used to validate user names.
     *
     * @return array<int, ValidationRule|array<mixed>|string>
     */
    protected function nameRules(): array
    {
        return ['required', 'string', 'max:255'];
    }

    /**
     * Get the validation rules used to validate user emails.
     *
     * @return array<int, ValidationRule|array<mixed>|string>
     */
    protected function emailRules(?int $userId = null): array
    {
        return [
            'required',
            'string',
            'email',
            'max:255',
            $userId === null
                ? ValidationRuleFacade::unique(User::class)
                : ValidationRuleFacade::unique(User::class)->ignore($userId),
        ];
    }
}
