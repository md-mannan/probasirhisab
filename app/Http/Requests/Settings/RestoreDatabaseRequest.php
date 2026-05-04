<?php

namespace App\Http\Requests\Settings;

use App\Enums\UserRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class RestoreDatabaseRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null
            && $user->role instanceof UserRole
            && $user->role->canAccessUserManagement();
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $maxKb = (int) config('database_backup.max_upload_kilobytes', 512_000);
        $phrase = (string) config('database_backup.confirm_phrase', 'RESTORE');

        return [
            'backup' => ['required', 'file', 'max:'.$maxKb],
            'current_password' => ['required', 'current_password:web'],
            'confirm_restore' => ['required', 'string', Rule::in([$phrase])],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $file = $this->file('backup');

            if ($file === null || ! $file->isValid()) {
                return;
            }

            $ext = strtolower($file->getClientOriginalExtension());

            if (! in_array($ext, ['sql', 'sqlite'], true)) {
                $validator->errors()->add(
                    'backup',
                    'The backup must be a .sql or .sqlite file.',
                );
            }
        });
    }
}
