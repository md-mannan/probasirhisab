<?php

namespace App\Http\Controllers;

use App\Models\Contact;
use App\Models\Transaction;
use App\Services\ContactSync;
use App\Support\Currency;
use App\Support\SharedCatalog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ContactController extends Controller
{
    public function index(Request $request, ContactSync $sync): Response
    {
        $user = $request->user();

        // People are sourced from system users: ensure one user-backed contact each.
        $sync->syncForOwner($user);

        $primaryCurrency = $user->primary_currency ?: 'KWD';
        $secondaryCurrency = $user->secondary_currency ?: 'BDT';

        $contacts = Contact::query()
            ->whereIn('user_id', SharedCatalog::visibleOwnerIds($user))
            ->whereNotNull('member_user_id')
            ->orderBy('name', 'asc')
            ->get(['id', 'name', 'created_at']);

        $tx = DB::table('contact_transaction')
            ->join('transactions', 'transactions.id', '=', 'contact_transaction.transaction_id')
            ->where('contact_transaction.user_id', $user->id)
            ->select([
                'contact_transaction.contact_id',
                'transactions.type',
                'transactions.amount',
                'transactions.secondary_amount',
                'transactions.settled_amount',
            ])
            ->get();

        $byContact = [];
        foreach ($contacts as $c) {
            $byContact[$c->id] = [
                'income_primary' => 0.0,
                'receivable_outstanding_primary' => 0.0,
                'payable_outstanding_primary' => 0.0,
            ];
        }

        foreach ($tx as $t) {
            if (! $t->contact_id || ! array_key_exists($t->contact_id, $byContact)) {
                continue;
            }

            $absPrimary = abs((float) ($t->amount ?? 0));
            $settled = (float) ($t->settled_amount ?? 0);
            $settled = max(0.0, min($absPrimary, $settled));
            $remaining = max(0.0, $absPrimary - $settled);

            if ($t->type === 'income') {
                $byContact[$t->contact_id]['income_primary'] += $absPrimary;
            } elseif ($t->type === 'receivable') {
                $byContact[$t->contact_id]['receivable_outstanding_primary'] += $remaining;
            } elseif ($t->type === 'payable') {
                $byContact[$t->contact_id]['payable_outstanding_primary'] += $remaining;
            }
        }

        $rows = $contacts->map(function (Contact $c) use ($byContact) {
            $r = $byContact[$c->id] ?? [
                'income_primary' => 0.0,
                'receivable_outstanding_primary' => 0.0,
                'payable_outstanding_primary' => 0.0,
            ];

            $net = (float) $r['receivable_outstanding_primary'] - (float) $r['payable_outstanding_primary'];

            return [
                'id' => $c->id,
                'name' => $c->name,
                'income_primary' => (string) $r['income_primary'],
                'receivable_outstanding_primary' => (string) $r['receivable_outstanding_primary'],
                'payable_outstanding_primary' => (string) $r['payable_outstanding_primary'],
                'net_primary' => (string) $net,
                'created_at' => $c->created_at,
            ];
        });

        return Inertia::render('contacts/index', [
            'primaryCurrency' => $primaryCurrency,
            'secondaryCurrency' => $secondaryCurrency,
            'primaryDecimals' => Currency::decimalsFor($primaryCurrency),
            'secondaryDecimals' => Currency::decimalsFor($secondaryCurrency),
            'contacts' => $rows,
        ]);
    }

    public function show(Request $request, Contact $contact): Response
    {
        if (! SharedCatalog::canAccessContact($request->user(), $contact)) {
            abort(403);
        }

        $user = $request->user();
        $primaryCurrency = $user->primary_currency ?: 'KWD';
        $secondaryCurrency = $user->secondary_currency ?: 'BDT';

        $transactions = Transaction::query()
            ->where('user_id', $user->id)
            ->whereHas('contacts', fn ($q) => $q->where('contacts.id', $contact->id))
            ->whereIn('type', ['income', 'payable', 'receivable'])
            ->with(['category:id,name,type'])
            ->orderBy('occurred_on', 'desc')
            ->orderBy('id', 'desc')
            ->limit(500)
            ->get()
            ->map(fn (Transaction $t) => [
                'id' => $t->id,
                'type' => $t->type,
                'amount' => (string) $t->amount,
                'settled_amount' => $t->settled_amount === null ? null : (string) $t->settled_amount,
                'currency' => $t->currency,
                'secondary_amount' => $t->secondary_amount === null ? null : (string) $t->secondary_amount,
                'secondary_currency' => $t->secondary_currency,
                'rate' => $t->rate === null ? null : (string) $t->rate,
                'source' => $t->source,
                'occurred_on' => $t->occurred_on,
                'note' => $t->note,
                'category' => $t->category ? [
                    'id' => $t->category->id,
                    'name' => $t->category->name,
                    'type' => $t->category->type,
                ] : null,
            ]);

        return Inertia::render('contacts/show', [
            'primaryCurrency' => $primaryCurrency,
            'secondaryCurrency' => $secondaryCurrency,
            'primaryDecimals' => Currency::decimalsFor($primaryCurrency),
            'secondaryDecimals' => Currency::decimalsFor($secondaryCurrency),
            'contact' => [
                'id' => $contact->id,
                'name' => $contact->name,
            ],
            'transactions' => $transactions,
        ]);
    }
}
