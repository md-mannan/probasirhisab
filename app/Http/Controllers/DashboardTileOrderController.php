<?php

namespace App\Http\Controllers;

use App\Support\DashboardTiles;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class DashboardTileOrderController extends Controller
{
    public function __invoke(Request $request): RedirectResponse
    {
        $order = $request->validate([
            'order' => ['required', 'array'],
            'order.*' => ['required', 'string', Rule::in(DashboardTiles::IDS)],
        ])['order'];

        if (! DashboardTiles::isValidPermutation($order)) {
            throw ValidationException::withMessages([
                'order' => __('Invalid tile order.'),
            ]);
        }

        $request->user()->update([
            'dashboard_tile_order' => array_values($order),
        ]);

        return redirect()->route('dashboard');
    }
}
