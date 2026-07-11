<?php

namespace App\Http\Controllers;

use App\Models\LedgerEntry;
use App\Support\Currency;
use App\Support\TransactionType;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LedgerController extends Controller
{
    /** Max ledger lines loaded into the running-balance view. */
    private const ROW_LIMIT = 1000;

    /**
     * Legacy settlement rows stored "Settlement", "Settlement: …", or duplicated prefixes;
     * normalize to the note text only for display.
     */
    private function normalizeSettlementLedgerDescription(?string $raw): ?string
    {
        if ($raw === null || trim($raw) === '') {
            return null;
        }

        $t = trim($raw);
        $pattern = '/^Settlement(\s*[:,—\-–]\s*|\s+)(.*)$/isu';

        while (preg_match($pattern, $t, $m)) {
            $t = trim((string) ($m[2] ?? ''));
            if ($t === '') {
                return null;
            }
        }

        if (strcasecmp($t, 'Settlement') === 0) {
            return null;
        }

        return $t !== '' ? $t : null;
    }

    public function index(Request $request): Response
    {
        $user = $request->user();

        $primaryCurrency = $user->primary_currency ?: 'KWD';
        $secondaryCurrency = $user->secondary_currency ?: 'BDT';
        $primaryDecimals = Currency::decimalsFor($primaryCurrency);
        $secondaryDecimals = Currency::decimalsFor($secondaryCurrency);

        $entries = LedgerEntry::query()
            ->select('ledger_entries.*')
            ->where('ledger_entries.user_id', $user->id)
            ->whereHas('transaction')
            ->join('transactions as t', 'ledger_entries.transaction_id', '=', 't.id')
            ->leftJoin('transaction_settlements as ts', 'ledger_entries.settlement_id', '=', 'ts.id')
            ->with([
                'transaction:id,type,note,source,category_id',
                'transaction.category:id,name,type',
                'settlement:id,transaction_id,paid_on,amount,note,category_id',
                'settlement.category:id,name,type',
            ])
            // Chronological running balance (independent of drag-order on /transactions):
            ->orderBy('ledger_entries.occurred_on')
            ->orderByRaw('coalesce(ts.sort_order, t.sort_order) is null asc')
            ->orderByRaw('coalesce(ts.sort_order, t.sort_order) asc')
            // within a transaction row: show the base transaction line first, then settlement lines
            ->orderByRaw('ledger_entries.settlement_id is null desc')
            ->orderByDesc('ledger_entries.id')
            ->limit(self::ROW_LIMIT)
            ->get();

        $entryTotal = LedgerEntry::query()
            ->where('ledger_entries.user_id', $user->id)
            ->whereHas('transaction')
            ->count();

        $runningPrimary = 0.0;
        $runningSecondary = 0.0;

        $lines = $entries->map(function (LedgerEntry $e) use (&$runningPrimary, &$runningSecondary) {
            $signedPrimary = (float) $e->credit_primary - (float) $e->debit_primary;
            $runningPrimary += $signedPrimary;

            $signedSecondary = null;
            if ($e->debit_secondary !== null && $e->credit_secondary !== null) {
                $signedSecondary = (float) $e->credit_secondary - (float) $e->debit_secondary;
                $runningSecondary += $signedSecondary;
            }

            $displayType = $e->type;
            if ($e->settlement_id !== null) {
                $displayType = $e->settlement?->category?->type
                    ?? (($e->transaction?->type ?? 'payable') === 'payable' ? 'settle_payable' : 'settle_receivable');
            }

            return [
                'id' => $e->id,
                'transaction_id' => $e->transaction_id,
                'settlement_id' => $e->settlement_id,
                'occurred_on' => $e->occurred_on,
                'type' => $displayType,
                'description' => $e->settlement_id !== null
                    ? $this->normalizeSettlementLedgerDescription($e->description)
                    : $e->description,
                'source' => $e->transaction?->source,
                'category' => $e->settlement?->category
                    ? [
                        'id' => $e->settlement->category->id,
                        'name' => $e->settlement->category->name,
                        'type' => $e->settlement->category->type,
                    ]
                    : ($e->transaction?->category ? [
                        'id' => $e->transaction->category->id,
                        'name' => $e->transaction->category->name,
                        'type' => $e->transaction->category->type,
                    ] : null),
                'debit_primary' => (string) $e->debit_primary,
                'credit_primary' => (string) $e->credit_primary,
                'debit_secondary' => $e->debit_secondary === null ? null : (string) $e->debit_secondary,
                'credit_secondary' => $e->credit_secondary === null ? null : (string) $e->credit_secondary,
                'primary_currency' => $e->primary_currency,
                'secondary_currency' => $e->secondary_currency,
                'running_primary' => (string) $runningPrimary,
                'running_secondary' => $signedSecondary === null ? null : (string) $runningSecondary,
            ];
        });

        return Inertia::render('ledger/index', [
            'types' => array_merge(TransactionType::labels(), [
                'settle_payable' => 'Settle payable',
                'settle_receivable' => 'Settle receivable',
                'settlement' => 'Settlement',
            ]),
            'primaryCurrency' => $primaryCurrency,
            'secondaryCurrency' => $secondaryCurrency,
            'primaryDecimals' => $primaryDecimals,
            'secondaryDecimals' => $secondaryDecimals,
            'lines' => $lines,
            'listMeta' => [
                'shown' => $lines->count(),
                'total' => $entryTotal,
                'limit' => self::ROW_LIMIT,
                'truncated' => $entryTotal > self::ROW_LIMIT,
            ],
        ]);
    }
}
