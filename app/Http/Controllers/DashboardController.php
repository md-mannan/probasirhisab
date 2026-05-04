<?php

namespace App\Http\Controllers;

use App\Models\Transaction;
use App\Models\TransactionSettlement;
use App\Support\Currency;
use App\Support\DashboardTiles;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $user = $request->user();
        $primaryCurrency = $user->primary_currency ?: 'KWD';
        $secondaryCurrency = $user->secondary_currency ?: 'BDT';
        $primaryDecimals = Currency::decimalsFor($primaryCurrency);
        $secondaryDecimals = Currency::decimalsFor($secondaryCurrency);

        $transactions = Transaction::query()
            ->where('user_id', $user->id)
            ->orderBy('occurred_on')
            ->orderBy('id')
            ->get(['occurred_on', 'type', 'amount', 'secondary_amount', 'settled_amount']);

        $cashPrimary = 0.0;
        $cashSecondary = 0.0;
        $receivablePrimary = 0.0;
        $receivableSecondary = 0.0;
        $receivableTotalPrimary = 0.0;
        $receivableSettledPrimarySum = 0.0;
        $receivableTotalSecondary = 0.0;
        $receivableSettledSecondarySum = 0.0;
        $payablePrimary = 0.0;
        $payableSecondary = 0.0;
        $payableTotalPrimary = 0.0;
        $payableSettledPrimarySum = 0.0;
        $payableTotalSecondary = 0.0;
        $payableSettledSecondarySum = 0.0;

        $cashSecondaryComplete = true;
        $receivableSecondaryComplete = true;
        $payableSecondaryComplete = true;

        $incomePrimarySum = 0.0;
        $incomeSecondarySum = 0.0;
        $incomeSecondaryComplete = true;
        $expensePrimarySum = 0.0;
        $expenseSecondarySum = 0.0;
        $expenseSecondaryComplete = true;

        $incomeCount = 0;
        $expenseCount = 0;

        /** @var array<string, array{income: float, expense: float, receivable: float, payable: float}> */
        $monthly = [];
        /** @var array<string, array{income: float, expense: float, receivable: float, payable: float}> */
        $yearly = [];

        foreach ($transactions as $t) {
            $amountPrimary = (float) ($t->amount ?? 0);
            $absPrimary = abs($amountPrimary);
            $settledPrimary = (float) ($t->settled_amount ?? 0);
            $settledPrimary = max(0.0, min($absPrimary, $settledPrimary));
            $remainingPrimary = max(0.0, $absPrimary - $settledPrimary);

            $amountSecondary = $t->secondary_amount === null ? null : (float) $t->secondary_amount;

            $ratioSecondary = null;
            if ($amountSecondary !== null && $absPrimary > 0.0000001) {
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

            $monthKey = substr((string) $t->occurred_on, 0, 7);
            $yearKey = substr((string) $t->occurred_on, 0, 4);

            if (! isset($monthly[$monthKey])) {
                $monthly[$monthKey] = self::emptyTrendBucket();
            }
            if (! isset($yearly[$yearKey])) {
                $yearly[$yearKey] = self::emptyTrendBucket();
            }

            if ($t->type === 'income') {
                $incomeCount++;
                $incomePrimarySum += $absPrimary;
                if ($amountSecondary !== null) {
                    $incomeSecondarySum += abs($amountSecondary);
                } else {
                    $incomeSecondaryComplete = false;
                }
                $cashPrimary += $absPrimary;
                if ($amountSecondary !== null) {
                    $cashSecondary += abs($amountSecondary);
                } else {
                    $cashSecondaryComplete = false;
                }
                $monthly[$monthKey]['income_primary'] += $absPrimary;
                $yearly[$yearKey]['income_primary'] += $absPrimary;
                if ($amountSecondary !== null) {
                    $monthly[$monthKey]['income_secondary'] += abs($amountSecondary);
                    $yearly[$yearKey]['income_secondary'] += abs($amountSecondary);
                }
            } elseif ($t->type === 'expense') {
                $expenseCount++;
                $expensePrimarySum += $absPrimary;
                if ($amountSecondary !== null) {
                    $expenseSecondarySum += abs($amountSecondary);
                } else {
                    $expenseSecondaryComplete = false;
                }
                $cashPrimary -= $absPrimary;
                if ($amountSecondary !== null) {
                    $cashSecondary -= abs($amountSecondary);
                } else {
                    $cashSecondaryComplete = false;
                }
                $monthly[$monthKey]['expense_primary'] += $absPrimary;
                $yearly[$yearKey]['expense_primary'] += $absPrimary;
                if ($amountSecondary !== null) {
                    $monthly[$monthKey]['expense_secondary'] += abs($amountSecondary);
                    $yearly[$yearKey]['expense_secondary'] += abs($amountSecondary);
                }
            } elseif ($t->type === 'receivable') {
                $receivableTotalPrimary += $absPrimary;
                $receivableSettledPrimarySum += $settledPrimary;
                $cashPrimary -= $absPrimary;
                $cashPrimary += $settledPrimary;
                $receivablePrimary += $remainingPrimary;

                if ($amountSecondary !== null) {
                    $receivableTotalSecondary += abs($amountSecondary);
                    if ($settledSecondary !== null) {
                        $receivableSettledSecondarySum += abs($settledSecondary);
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

                $monthly[$monthKey]['receivable_primary'] += $absPrimary;
                $yearly[$yearKey]['receivable_primary'] += $absPrimary;
                if ($amountSecondary !== null) {
                    $monthly[$monthKey]['receivable_secondary'] += abs($amountSecondary);
                    $yearly[$yearKey]['receivable_secondary'] += abs($amountSecondary);
                }
            } elseif ($t->type === 'payable') {
                $payableTotalPrimary += $absPrimary;
                $payableSettledPrimarySum += $settledPrimary;
                $cashPrimary += $absPrimary;
                $cashPrimary -= $settledPrimary;
                $payablePrimary += $remainingPrimary;

                if ($amountSecondary !== null) {
                    $payableTotalSecondary += abs($amountSecondary);
                    if ($settledSecondary !== null) {
                        $payableSettledSecondarySum += abs($settledSecondary);
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

                $monthly[$monthKey]['payable_primary'] += $absPrimary;
                $yearly[$yearKey]['payable_primary'] += $absPrimary;
                if ($amountSecondary !== null) {
                    $monthly[$monthKey]['payable_secondary'] += abs($amountSecondary);
                    $yearly[$yearKey]['payable_secondary'] += abs($amountSecondary);
                }
            }
        }

        $settlementsForTrend = TransactionSettlement::query()
            ->where('transaction_settlements.user_id', $user->id)
            ->join('transactions as tr', 'transaction_settlements.transaction_id', '=', 'tr.id')
            ->whereIn('tr.type', ['payable', 'receivable'])
            ->select([
                'transaction_settlements.amount',
                'transaction_settlements.paid_on',
                'tr.type as obligation_type',
                'tr.amount as trx_amount',
                'tr.secondary_amount',
            ])
            ->get();

        foreach ($settlementsForTrend as $s) {
            $paidPrimary = abs((float) $s->amount);
            $trxPrimaryAbs = abs((float) $s->trx_amount);
            $trxSecondary = $s->secondary_amount === null ? null : (float) $s->secondary_amount;

            $paidSecondary = null;
            if ($trxSecondary !== null && $trxPrimaryAbs > 0.0000001) {
                $paidSecondary = $paidPrimary * (abs($trxSecondary) / $trxPrimaryAbs);
            }

            $monthKey = substr((string) $s->paid_on, 0, 7);
            $yearKey = substr((string) $s->paid_on, 0, 4);

            if (! isset($monthly[$monthKey])) {
                $monthly[$monthKey] = self::emptyTrendBucket();
            }
            if (! isset($yearly[$yearKey])) {
                $yearly[$yearKey] = self::emptyTrendBucket();
            }

            if ($s->obligation_type === 'payable') {
                $monthly[$monthKey]['settle_payable_primary'] += $paidPrimary;
                $yearly[$yearKey]['settle_payable_primary'] += $paidPrimary;
                if ($paidSecondary !== null) {
                    $monthly[$monthKey]['settle_payable_secondary'] += $paidSecondary;
                    $yearly[$yearKey]['settle_payable_secondary'] += $paidSecondary;
                }
            } else {
                $monthly[$monthKey]['settle_receivable_primary'] += $paidPrimary;
                $yearly[$yearKey]['settle_receivable_primary'] += $paidPrimary;
                if ($paidSecondary !== null) {
                    $monthly[$monthKey]['settle_receivable_secondary'] += $paidSecondary;
                    $yearly[$yearKey]['settle_receivable_secondary'] += $paidSecondary;
                }
            }
        }

        $assetsPrimary = $cashPrimary + $receivablePrimary;
        $liabilitiesPrimary = $payablePrimary;
        $netPrimary = $assetsPrimary - $liabilitiesPrimary;

        $assetsSecondary = $cashSecondary + $receivableSecondary;
        $liabilitiesSecondary = $payableSecondary;
        $netSecondary = $assetsSecondary - $liabilitiesSecondary;

        $secondaryTotalsComplete = $cashSecondaryComplete && $receivableSecondaryComplete && $payableSecondaryComplete;

        if (count($monthly) >= 1) {
            $sortedMonths = array_keys($monthly);
            sort($sortedMonths);
            $first = Carbon::parse($sortedMonths[0].'-01')->startOfMonth();
            $last = Carbon::parse($sortedMonths[count($sortedMonths) - 1].'-01')->startOfMonth();
            $cursor = $first->copy();
            while ($cursor->lte($last)) {
                $k = $cursor->format('Y-m');
                if (! isset($monthly[$k])) {
                    $monthly[$k] = self::emptyTrendBucket();
                }
                $cursor->addMonth();
            }
            ksort($monthly);
        }

        $monthlyTrend = [];
        foreach ($monthly as $period => $v) {
            $monthlyTrend[] = [
                'period' => $period,
                'label' => Carbon::parse($period.'-01')->format('M Y'),
                'incomePrimary' => round($v['income_primary'], 2),
                'incomeSecondary' => round($v['income_secondary'], 2),
                'expensePrimary' => round($v['expense_primary'], 2),
                'expenseSecondary' => round($v['expense_secondary'], 2),
                'receivablePrimary' => round($v['receivable_primary'], 2),
                'receivableSecondary' => round($v['receivable_secondary'], 2),
                'settleReceivablePrimary' => round($v['settle_receivable_primary'], 2),
                'settleReceivableSecondary' => round($v['settle_receivable_secondary'], 2),
                'payablePrimary' => round($v['payable_primary'], 2),
                'payableSecondary' => round($v['payable_secondary'], 2),
                'settlePayablePrimary' => round($v['settle_payable_primary'], 2),
                'settlePayableSecondary' => round($v['settle_payable_secondary'], 2),
            ];
        }

        ksort($yearly);
        $yearlyTrend = [];
        foreach ($yearly as $year => $v) {
            $yearlyTrend[] = [
                'year' => $year,
                'label' => $year,
                'incomePrimary' => round($v['income_primary'], 2),
                'incomeSecondary' => round($v['income_secondary'], 2),
                'expensePrimary' => round($v['expense_primary'], 2),
                'expenseSecondary' => round($v['expense_secondary'], 2),
                'receivablePrimary' => round($v['receivable_primary'], 2),
                'receivableSecondary' => round($v['receivable_secondary'], 2),
                'settleReceivablePrimary' => round($v['settle_receivable_primary'], 2),
                'settleReceivableSecondary' => round($v['settle_receivable_secondary'], 2),
                'payablePrimary' => round($v['payable_primary'], 2),
                'payableSecondary' => round($v['payable_secondary'], 2),
                'settlePayablePrimary' => round($v['settle_payable_primary'], 2),
                'settlePayableSecondary' => round($v['settle_payable_secondary'], 2),
            ];
        }

        $financialRows = [
            [
                'key' => 'payable',
                'label' => __('dashboard.financial.total_payable'),
                'settledPrimary' => round($payableSettledPrimarySum, 2),
                'remainingPrimary' => round($payablePrimary, 2),
                'settledSecondary' => $payableSecondaryComplete ? round($payableSettledSecondarySum, 2) : null,
                'remainingSecondary' => $payableSecondaryComplete ? round($payableSecondary, 2) : null,
            ],
            [
                'key' => 'receivable',
                'label' => __('dashboard.financial.total_receivable'),
                'settledPrimary' => round($receivableSettledPrimarySum, 2),
                'remainingPrimary' => round($receivablePrimary, 2),
                'settledSecondary' => $receivableSecondaryComplete ? round($receivableSettledSecondarySum, 2) : null,
                'remainingSecondary' => $receivableSecondaryComplete ? round($receivableSecondary, 2) : null,
            ],
        ];

        return Inertia::render('dashboard', [
            't' => trans('dashboard'),
            'dashboardTileOrder' => DashboardTiles::normalize($user->dashboard_tile_order),
            'primaryCurrency' => $primaryCurrency,
            'secondaryCurrency' => $secondaryCurrency,
            'primaryDecimals' => $primaryDecimals,
            'secondaryDecimals' => $secondaryDecimals,
            'summary' => [
                'cash' => [
                    'primary' => (string) $cashPrimary,
                    'secondary' => $cashSecondaryComplete ? (string) $cashSecondary : null,
                ],
                'net' => [
                    'primary' => (string) $netPrimary,
                    'secondary' => $secondaryTotalsComplete ? (string) $netSecondary : null,
                ],
                'income' => [
                    'primary' => (string) $incomePrimarySum,
                    'secondary' => $incomeSecondaryComplete ? (string) $incomeSecondarySum : null,
                    'count' => $incomeCount,
                ],
                'expense' => [
                    'primary' => (string) $expensePrimarySum,
                    'secondary' => $expenseSecondaryComplete ? (string) $expenseSecondarySum : null,
                    'count' => $expenseCount,
                ],
                'payable' => [
                    'totalPrimary' => (string) $payableTotalPrimary,
                    'settledPrimary' => (string) $payableSettledPrimarySum,
                    'remainingPrimary' => (string) $payablePrimary,
                    'totalSecondary' => $payableSecondaryComplete ? (string) $payableTotalSecondary : null,
                    'settledSecondary' => $payableSecondaryComplete ? (string) $payableSettledSecondarySum : null,
                    'remainingSecondary' => $payableSecondaryComplete ? (string) $payableSecondary : null,
                ],
                'receivable' => [
                    'totalPrimary' => (string) $receivableTotalPrimary,
                    'settledPrimary' => (string) $receivableSettledPrimarySum,
                    'remainingPrimary' => (string) $receivablePrimary,
                    'totalSecondary' => $receivableSecondaryComplete ? (string) $receivableTotalSecondary : null,
                    'settledSecondary' => $receivableSecondaryComplete ? (string) $receivableSettledSecondarySum : null,
                    'remainingSecondary' => $receivableSecondaryComplete ? (string) $receivableSecondary : null,
                ],
            ],
            'monthlyTrend' => $monthlyTrend,
            'yearlyTrend' => $yearlyTrend,
            'financialStatus' => $financialRows,
        ]);
    }

    /**
     * @return array<string, float>
     */
    private static function emptyTrendBucket(): array
    {
        return [
            'income_primary' => 0.0,
            'income_secondary' => 0.0,
            'expense_primary' => 0.0,
            'expense_secondary' => 0.0,
            'receivable_primary' => 0.0,
            'receivable_secondary' => 0.0,
            'settle_receivable_primary' => 0.0,
            'settle_receivable_secondary' => 0.0,
            'payable_primary' => 0.0,
            'payable_secondary' => 0.0,
            'settle_payable_primary' => 0.0,
            'settle_payable_secondary' => 0.0,
        ];
    }
}
