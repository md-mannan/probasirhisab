<?php

namespace App\Http\Controllers\Reports;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use App\Support\Currency;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class BalanceSheetController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();

        $primaryCurrency = $user->primary_currency ?: 'KWD';
        $secondaryCurrency = $user->secondary_currency ?: 'BDT';
        $primaryDecimals = Currency::decimalsFor($primaryCurrency);
        $secondaryDecimals = Currency::decimalsFor($secondaryCurrency);

        $transactions = Transaction::query()
            ->where('user_id', $user->id)
            ->get(['type', 'amount', 'secondary_amount', 'settled_amount']);

        $cashPrimary = 0.0;
        $cashSecondary = 0.0;
        $receivablePrimary = 0.0;
        $receivableSecondary = 0.0;
        $payablePrimary = 0.0;
        $payableSecondary = 0.0;

        $cashSecondaryComplete = true;
        $receivableSecondaryComplete = true;
        $payableSecondaryComplete = true;

        foreach ($transactions as $t) {
            $amountPrimary = (float) ($t->amount ?? 0);
            $absPrimary = abs($amountPrimary);
            $settledPrimary = (float) ($t->settled_amount ?? 0);
            $settledPrimary = max(0.0, min($absPrimary, $settledPrimary));
            $remainingPrimary = max(0.0, $absPrimary - $settledPrimary);

            $amountSecondary = $t->secondary_amount === null ? null : (float) $t->secondary_amount;

            $ratioSecondary = null;
            if ($amountSecondary !== null && $absPrimary > 0.0000001) {
                // Preserve the sign relationship between primary/secondary.
                $ratioSecondary = $amountSecondary / $amountPrimary;
            }

            $settledSecondary = null;
            if ($ratioSecondary !== null) {
                $settledSecondary = $settledPrimary * $ratioSecondary;
            }

            $remainingSecondary = null;
            if ($ratioSecondary !== null) {
                $remainingSecondary = $remainingPrimary * $ratioSecondary;
            }

            if ($t->type === 'income') {
                $cashPrimary += $absPrimary;
                if ($amountSecondary !== null) {
                    $cashSecondary += abs($amountSecondary);
                } else {
                    $cashSecondaryComplete = false;
                }
            } elseif ($t->type === 'expense') {
                $cashPrimary -= $absPrimary;
                if ($amountSecondary !== null) {
                    $cashSecondary -= abs($amountSecondary);
                } else {
                    $cashSecondaryComplete = false;
                }
            } elseif ($t->type === 'receivable') {
                // Receivable (you lent money):
                // - At creation: cash decreases by total lent
                // - At settlement: cash increases by amounts received
                // - Outstanding remains as Receivable (asset)
                $cashPrimary -= $absPrimary;
                $cashPrimary += $settledPrimary;
                $receivablePrimary += $remainingPrimary;

                if ($amountSecondary !== null) {
                    if ($settledSecondary !== null) {
                        $cashSecondary -= abs($amountSecondary);
                        $cashSecondary += $settledSecondary;
                        if ($remainingSecondary !== null) {
                            $receivableSecondary += abs($remainingSecondary);
                        } else {
                            $receivableSecondaryComplete = false;
                        }
                    } else {
                        $cashSecondaryComplete = false;
                        $receivableSecondaryComplete = false;
                    }
                } else {
                    $cashSecondaryComplete = false;
                    $receivableSecondaryComplete = false;
                }
            } elseif ($t->type === 'payable') {
                // Payable (you borrowed money):
                // - At creation: cash increases by total borrowed
                // - At settlement: cash decreases by amounts paid back
                // - Outstanding remains as Payable (liability)
                $cashPrimary += $absPrimary;
                $cashPrimary -= $settledPrimary;
                $payablePrimary += $remainingPrimary;

                if ($amountSecondary !== null) {
                    if ($settledSecondary !== null) {
                        $cashSecondary += abs($amountSecondary);
                        $cashSecondary -= $settledSecondary;
                        if ($remainingSecondary !== null) {
                            $payableSecondary += abs($remainingSecondary);
                        } else {
                            $payableSecondaryComplete = false;
                        }
                    } else {
                        $cashSecondaryComplete = false;
                        $payableSecondaryComplete = false;
                    }
                } else {
                    $cashSecondaryComplete = false;
                    $payableSecondaryComplete = false;
                }
            }
        }

        $assetsPrimary = $cashPrimary + $receivablePrimary;
        $liabilitiesPrimary = $payablePrimary;
        $netPrimary = $assetsPrimary - $liabilitiesPrimary;

        $assetsSecondary = $cashSecondary + $receivableSecondary;
        $liabilitiesSecondary = $payableSecondary;
        $netSecondary = $assetsSecondary - $liabilitiesSecondary;

        return Inertia::render('reports/balance-sheet', [
            'primaryCurrency' => $primaryCurrency,
            'secondaryCurrency' => $secondaryCurrency,
            'primaryDecimals' => $primaryDecimals,
            'secondaryDecimals' => $secondaryDecimals,
            'cash' => [
                'primary' => (string) $cashPrimary,
                'secondary' => $cashSecondaryComplete ? (string) $cashSecondary : null,
            ],
            'receivable' => [
                'primary' => (string) $receivablePrimary,
                'secondary' => $receivableSecondaryComplete ? (string) $receivableSecondary : null,
            ],
            'payable' => [
                'primary' => (string) $payablePrimary,
                'secondary' => $payableSecondaryComplete ? (string) $payableSecondary : null,
            ],
            'totals' => [
                'assets' => [
                    'primary' => (string) $assetsPrimary,
                    'secondary' => ($cashSecondaryComplete && $receivableSecondaryComplete) ? (string) $assetsSecondary : null,
                ],
                'liabilities' => [
                    'primary' => (string) $liabilitiesPrimary,
                    'secondary' => $payableSecondaryComplete ? (string) $liabilitiesSecondary : null,
                ],
                'net' => [
                    'primary' => (string) $netPrimary,
                    'secondary' => ($cashSecondaryComplete && $receivableSecondaryComplete && $payableSecondaryComplete) ? (string) $netSecondary : null,
                ],
            ],
        ]);
    }
}
