<?php

namespace App\Http\Controllers;

use App\Models\Contact;
use App\Models\Transaction;
use App\Models\User;
use App\Support\Currency;
use App\Support\SharedCatalog;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ContactController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();

        $contacts = $this->visiblePeople($user);
        [$individual, $groups] = $this->aggregate($user, $contacts);

        $totals = $this->emptyTotals();
        $rows = [];

        // One row per person — their solo (non-shared) transactions only.
        foreach ($contacts as $c) {
            $r = $individual[$c->id] ?? $this->emptyTotals();
            foreach ($r as $key => $value) {
                $totals[$key] += $value;
            }
            $rows[] = $this->formatRow($c->id, $c->name, $r, false);
        }

        // One extra row per group obligation — counted once, so nothing is inflated.
        foreach ($groups as $g) {
            foreach ($this->emptyTotals() as $key => $_) {
                $totals[$key] += $g[$key];
            }
            $rows[] = $this->formatRow(null, $g['__name'], $g, true, $g['__member_ids']);
        }

        return Inertia::render('contacts/index', [
            'primaryCurrency' => $user->primary_currency ?: 'KWD',
            'secondaryCurrency' => $user->secondary_currency ?: 'BDT',
            'primaryDecimals' => Currency::decimalsFor($user->primary_currency ?: 'KWD'),
            'secondaryDecimals' => Currency::decimalsFor($user->secondary_currency ?: 'BDT'),
            'contacts' => $rows,
            'totals' => $this->formatRow(null, 'Total', $totals, false),
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
            ->with(['category:id,name,type', 'contacts:id,name'])
            ->orderBy('occurred_on', 'desc')
            ->orderBy('id', 'desc')
            ->limit(500)
            ->get();

        // Person statement summary (outstanding only): what they owe you vs. you owe
        // them. Shared (group) obligations belong to the group as a whole, so they are
        // excluded here — consistent with the People overview, where a group is its own
        // separate row rather than being counted against each member.
        $assets = 0.0;
        $liabilities = 0.0;
        $income = 0.0;
        foreach ($transactions as $t) {
            if ($t->contacts->count() >= 2) {
                continue; // group obligation — not part of this person's individual balance
            }
            $abs = abs((float) $t->amount);
            $remaining = max(0.0, $abs - max(0.0, min($abs, (float) ($t->settled_amount ?? 0))));
            if ($t->type === 'receivable') {
                $assets += $remaining;
            } elseif ($t->type === 'payable') {
                $liabilities += $remaining;
            } elseif ($t->type === 'income') {
                $income += $abs;
            }
        }

        $rows = $transactions->map(function (Transaction $t) use ($contact) {
            return [
                'id' => $t->id,
                'type' => $t->type,
                'amount' => (string) $t->amount,
                // True when the obligation is shared by several people (a group entry).
                'is_group' => $t->contacts->count() >= 2,
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
                // Co-borrowers/participants on the same (group) obligation, excluding this person.
                'co_people' => $t->contacts
                    ->where('id', '!=', $contact->id)
                    ->map(fn (Contact $c) => ['id' => $c->id, 'name' => $c->name])
                    ->values(),
            ];
        });

        return Inertia::render('contacts/show', [
            'primaryCurrency' => $primaryCurrency,
            'secondaryCurrency' => $secondaryCurrency,
            'primaryDecimals' => Currency::decimalsFor($primaryCurrency),
            'secondaryDecimals' => Currency::decimalsFor($secondaryCurrency),
            'contact' => [
                'id' => $contact->id,
                'name' => $contact->name,
            ],
            'summary' => [
                'assets_primary' => (string) $assets,
                'liabilities_primary' => (string) $liabilities,
                'net_primary' => (string) ($assets - $liabilities),
                'income_primary' => (string) $income,
            ],
            'transactions' => $rows,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        Contact::query()->create([
            'user_id' => $user->id,
            'name' => trim($data['name']),
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Person created.')]);

        return back();
    }

    public function update(Request $request, Contact $contact): RedirectResponse
    {
        if (! SharedCatalog::canMutateContact($request->user(), $contact)) {
            abort(403);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $contact->fill(['name' => trim($data['name'])]);
        $contact->saveOrFail();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Person updated.')]);

        return back();
    }

    public function destroy(Request $request, Contact $contact): RedirectResponse
    {
        if (! SharedCatalog::canMutateContact($request->user(), $contact)) {
            abort(403);
        }

        $contact->deleteOrFail();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Person deleted.')]);

        return back();
    }

    /**
     * Contacts visible to the viewer (own + shared Super-Admin rows), collapsed so a
     * person backed by a legacy system-user link appears once.
     *
     * @return Collection<int, Contact>
     */
    private function visiblePeople(User $user): Collection
    {
        $contacts = Contact::query()
            ->whereIn('user_id', SharedCatalog::visibleOwnerIds($user))
            ->orderBy('name', 'asc')
            ->get(['id', 'name', 'user_id', 'member_user_id', 'created_at']);

        return SharedCatalog::dedupePeople($contacts, $user);
    }

    /**
     * Aggregate the viewer's transactions into a full financial snapshot: income,
     * expense, gross receivable/payable, and the still-outstanding asset (receivable) /
     * liability (payable) after settlements.
     *
     * A transaction tagged to a single person counts toward that person. A transaction
     * shared by ≥2 people is a joint (group) obligation and is recorded ONCE as its own
     * party — keyed by the exact member set — instead of being repeated against each
     * member. This keeps a joint 70,000 lent to 3 people as a single 70,000 entry, so
     * neither the individuals nor the column totals are inflated.
     *
     * @param  Collection<int, Contact>  $contacts
     * @return array{0: array<int, array<string, float>>, 1: list<array<string, mixed>>}
     *                                                                                   [individual totals by contact id, group party rows]
     */
    private function aggregate(User $user, Collection $contacts): array
    {
        $rows = DB::table('contact_transaction')
            ->join('transactions', 'transactions.id', '=', 'contact_transaction.transaction_id')
            ->where('contact_transaction.user_id', $user->id)
            ->select([
                'contact_transaction.contact_id',
                'contact_transaction.transaction_id',
                'transactions.type',
                'transactions.amount',
                'transactions.settled_amount',
            ])
            ->get();

        $nameById = $contacts->pluck('name', 'id');

        // Collapse the pivot rows into one record per transaction with its member list.
        $txById = [];
        foreach ($rows as $r) {
            if (! $nameById->has($r->contact_id)) {
                continue;
            }
            if (! isset($txById[$r->transaction_id])) {
                $txById[$r->transaction_id] = [
                    'type' => $r->type,
                    'amount' => abs((float) ($r->amount ?? 0)),
                    'settled' => max(0.0, min(abs((float) ($r->amount ?? 0)), (float) ($r->settled_amount ?? 0))),
                    'members' => [],
                ];
            }
            $txById[$r->transaction_id]['members'][] = (int) $r->contact_id;
        }

        $individual = [];
        foreach ($contacts as $c) {
            $individual[$c->id] = $this->emptyTotals();
        }

        /** @var array<string, array<string, mixed>> $groups */
        $groups = [];

        foreach ($txById as $t) {
            $members = array_values(array_unique($t['members']));

            if (count($members) < 2) {
                $this->applyTx($individual[$members[0]], $t);

                continue;
            }

            // Joint obligation — bucket by the exact member set, counted once.
            sort($members);
            $key = implode('-', $members);
            if (! isset($groups[$key])) {
                $names = array_map(fn ($id) => $nameById->get($id), $members);
                $groups[$key] = $this->emptyTotals();
                $groups[$key]['__name'] = implode(', ', $names);
                $groups[$key]['__member_ids'] = $members;
            }
            $this->applyTx($groups[$key], $t);
        }

        return [$individual, array_values($groups)];
    }

    /**
     * Add one transaction's amounts into an accumulator (income / expense / receivable
     * asset / payable liability).
     *
     * @param  array<string, mixed>  $acc
     * @param  array<string, mixed>  $t
     */
    private function applyTx(array &$acc, array $t): void
    {
        $abs = (float) $t['amount'];
        $remaining = max(0.0, $abs - (float) $t['settled']);

        if ($t['type'] === 'income') {
            $acc['income_primary'] += $abs;
        } elseif ($t['type'] === 'expense') {
            $acc['expense_primary'] += $abs;
        } elseif ($t['type'] === 'receivable') {
            $acc['receivable_total_primary'] += $abs;
            $acc['asset_primary'] += $remaining;
        } elseif ($t['type'] === 'payable') {
            $acc['payable_total_primary'] += $abs;
            $acc['liability_primary'] += $remaining;
        }
    }

    /**
     * Shape a totals array into the payload the table renders (adds id, name, net,
     * group flag and — for group rows — the member ids).
     *
     * @param  array<string, mixed>  $r
     * @param  list<int>|null  $memberIds
     * @return array<string, mixed>
     */
    private function formatRow(?int $id, string $name, array $r, bool $isGroup, ?array $memberIds = null): array
    {
        $net = (float) $r['asset_primary'] - (float) $r['liability_primary'];

        return [
            'id' => $id,
            'name' => $name,
            'is_group' => $isGroup,
            'member_ids' => $memberIds,
            'income_primary' => (string) $r['income_primary'],
            'expense_primary' => (string) $r['expense_primary'],
            'receivable_total_primary' => (string) $r['receivable_total_primary'],
            'payable_total_primary' => (string) $r['payable_total_primary'],
            'asset_primary' => (string) $r['asset_primary'],
            'liability_primary' => (string) $r['liability_primary'],
            'net_primary' => (string) $net,
        ];
    }

    /**
     * @return array<string, float>
     */
    private function emptyTotals(): array
    {
        return [
            'income_primary' => 0.0,
            'expense_primary' => 0.0,
            'receivable_total_primary' => 0.0,
            'payable_total_primary' => 0.0,
            'asset_primary' => 0.0,
            'liability_primary' => 0.0,
        ];
    }
}
