<?php

namespace App\Services;

use App\Models\LedgerEntry;
use App\Models\Transaction;
use App\Models\TransactionSettlement;
use App\Support\Money;
use Illuminate\Support\Collection;

class TransactionLedgerSync
{
    private function safeDescription(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $v = trim($value);
        if ($v === '') {
            return null;
        }

        // Safety guard even if DB column is TEXT.
        if (mb_strlen($v) > 5000) {
            return mb_substr($v, 0, 5000);
        }

        return $v;
    }

    public function syncForTransaction(Transaction $transaction): void
    {
        $primary = abs((float) $transaction->amount);
        $secondary = $transaction->secondary_amount === null ? null : abs((float) $transaction->secondary_amount);

        $debitPrimary = 0.0;
        $creditPrimary = 0.0;
        $debitSecondary = $secondary === null ? null : 0.0;
        $creditSecondary = $secondary === null ? null : 0.0;

        // Base cash impact:
        // - income: cash + (credit)
        // - expense: cash - (debit)
        // - payable (borrow): cash + (credit)
        // - receivable (lend): cash - (debit)
        if (in_array($transaction->type, ['income', 'payable'], true)) {
            $creditPrimary = $primary;
            if ($secondary !== null) {
                $creditSecondary = $secondary;
            }
        } elseif (in_array($transaction->type, ['expense', 'receivable'], true)) {
            $debitPrimary = $primary;
            if ($secondary !== null) {
                $debitSecondary = $secondary;
            }
        } else {
            return;
        }

        // Base entry (settlement_id = null)
        LedgerEntry::query()->updateOrCreate(
            ['transaction_id' => $transaction->id, 'settlement_id' => null],
            [
                'user_id' => $transaction->user_id,
                'occurred_on' => $transaction->occurred_on,
                'type' => $transaction->type,
                'description' => $this->safeDescription($transaction->note),
                'primary_amount' => $primary,
                'primary_currency' => $transaction->currency,
                'secondary_amount' => $transaction->secondary_amount,
                'secondary_currency' => $transaction->secondary_currency,
                'debit_primary' => $debitPrimary,
                'credit_primary' => $creditPrimary,
                'debit_secondary' => $debitSecondary,
                'credit_secondary' => $creditSecondary,
            ],
        );

        // Settlement lines
        if (! in_array($transaction->type, ['payable', 'receivable'], true)) {
            LedgerEntry::query()
                ->where('transaction_id', $transaction->id)
                ->whereNotNull('settlement_id', 'and')
                ->delete();

            return;
        }

        /** @var Collection<int, TransactionSettlement> $settlements */
        $settlements = $transaction->settlements()
            ->with('category:id,name,type')
            ->orderBy('paid_on')
            ->orderBy('id')
            ->get();

        $keepSettlementIds = $settlements->pluck('id')->all();

        LedgerEntry::query()
            ->where('transaction_id', $transaction->id)
            ->whereNotNull('settlement_id', 'and')
            ->whereNotIn('settlement_id', $keepSettlementIds, 'and')
            ->delete();

        foreach ($settlements as $s) {
            $payPrimary = abs((float) $s->amount);

            // Single canonical derivation: this settlement's share of the secondary
            // amount, from the booked ratio, rounded to the secondary currency.
            $paySecondary = Money::deriveSecondary(
                $payPrimary,
                $transaction->amount === null ? null : (float) $transaction->amount,
                $transaction->secondary_amount === null ? null : (float) $transaction->secondary_amount,
                (string) $transaction->secondary_currency,
            );
            $paySecondary = $paySecondary === null ? null : abs($paySecondary);

            $settleDebitPrimary = 0.0;
            $settleCreditPrimary = 0.0;
            $settleDebitSecondary = $paySecondary === null ? null : 0.0;
            $settleCreditSecondary = $paySecondary === null ? null : 0.0;

            if ($transaction->type === 'payable') {
                $settleDebitPrimary = $payPrimary;
                if ($paySecondary !== null) {
                    $settleDebitSecondary = abs($paySecondary);
                }
            } else { // receivable
                $settleCreditPrimary = $payPrimary;
                if ($paySecondary !== null) {
                    $settleCreditSecondary = abs($paySecondary);
                }
            }

            $ledgerType = $s->category?->type
                ?? ($transaction->type === 'payable' ? 'settle_payable' : 'settle_receivable');

            LedgerEntry::query()->updateOrCreate(
                ['transaction_id' => $transaction->id, 'settlement_id' => $s->id],
                [
                    'user_id' => $s->user_id,
                    'occurred_on' => $s->paid_on,
                    'type' => $ledgerType,
                    'description' => $this->safeDescription($s->note),
                    'primary_amount' => $payPrimary,
                    'primary_currency' => $transaction->currency,
                    'secondary_amount' => $paySecondary,
                    'secondary_currency' => $transaction->secondary_currency,
                    'debit_primary' => $settleDebitPrimary,
                    'credit_primary' => $settleCreditPrimary,
                    'debit_secondary' => $settleDebitSecondary,
                    'credit_secondary' => $settleCreditSecondary,
                ],
            );
        }
    }

    public function deleteForTransaction(Transaction $transaction): void
    {
        LedgerEntry::query()
            ->where('transaction_id', $transaction->id)
            ->delete();
    }
}
