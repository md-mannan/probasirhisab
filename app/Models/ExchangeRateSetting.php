<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Single global row: API used for FX previews and default rates for all users.
 */
class ExchangeRateSetting extends Model
{
    protected $table = 'exchange_rate_settings';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'exchange_rate_api_url',
        'exchange_rate_api_key',
    ];

    public static function the(): self
    {
        $row = static::query()->first();
        if ($row !== null) {
            return $row;
        }

        return static::query()->create([
            'exchange_rate_api_url' => null,
            'exchange_rate_api_key' => null,
        ]);
    }
}
