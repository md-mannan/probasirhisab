<?php

use App\Enums\UserRole;
use App\Models\Contact;
use App\Models\Transaction;
use App\Models\User;

/**
 * People are a manual counterparty ledger, decoupled from login accounts. A user can
 * add anyone by name; transactions tag one or more people (many-to-many), which drives
 * the per-person Assets (receivable outstanding) / Liabilities (payable outstanding)
 * figures and the joint (group) obligation surface.
 */
test('a person can be created manually without a login account', function (): void {
    $owner = User::factory()->create();
    $usersBefore = User::count();

    $this->actingAs($owner)
        ->post(route('contacts.store'), ['name' => 'Karim'])
        ->assertRedirect();

    expect(Contact::where('user_id', $owner->id)->where('name', 'Karim')->exists())->toBeTrue()
        // No login account was created as a side effect.
        ->and(User::count())->toBe($usersBefore);
});

test('a person can be renamed and deleted', function (): void {
    $owner = User::factory()->create();
    $contact = Contact::factory()->forUser($owner)->create(['name' => 'Old']);

    $this->actingAs($owner)
        ->patch(route('contacts.update', $contact), ['name' => 'New'])
        ->assertRedirect();
    expect($contact->refresh()->name)->toBe('New');

    $this->actingAs($owner)
        ->delete(route('contacts.destroy', $contact))
        ->assertRedirect();
    expect(Contact::whereKey($contact->id)->exists())->toBeFalse();
});

test('the people table reports a full financial overview per person', function (): void {
    $owner = User::factory()->create();
    $person = Contact::factory()->forUser($owner)->create(['name' => 'Karim']);

    // Income 40, expense 15, lent 100 (settled 60 → asset 40), borrowed 30 (unsettled).
    $income = Transaction::factory()->forUser($owner)->income(40)->create();
    $expense = Transaction::factory()->forUser($owner)->expense(15)->create();
    $lent = Transaction::factory()->forUser($owner)->receivable(100)->create(['settled_amount' => 60]);
    $borrowed = Transaction::factory()->forUser($owner)->payable(30)->create();

    foreach ([$income, $expense, $lent, $borrowed] as $t) {
        $t->contacts()->attach($person->id, ['user_id' => $owner->id]);
    }

    $this->actingAs($owner)
        ->get(route('contacts.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('contacts.0.name', 'Karim')
            ->where('contacts.0.income_primary', '40')
            ->where('contacts.0.expense_primary', '15')
            ->where('contacts.0.receivable_total_primary', '100')
            ->where('contacts.0.payable_total_primary', '30')
            ->where('contacts.0.asset_primary', '40')   // 100 lent − 60 settled
            ->where('contacts.0.liability_primary', '30')
            ->where('contacts.0.net_primary', '10')     // 40 asset − 30 liability
            // Workspace totals row mirrors the single person.
            ->where('totals.name', 'Total')
            ->where('totals.receivable_total_primary', '100')
            ->where('totals.net_primary', '10'));
});

test('the people table totals row sums every person', function (): void {
    $owner = User::factory()->create();
    $a = Contact::factory()->forUser($owner)->create(['name' => 'Aa']);
    $b = Contact::factory()->forUser($owner)->create(['name' => 'Bb']);

    $lent = Transaction::factory()->forUser($owner)->receivable(100)->create();
    $borrowed = Transaction::factory()->forUser($owner)->payable(40)->create();
    $lent->contacts()->attach($a->id, ['user_id' => $owner->id]);
    $borrowed->contacts()->attach($b->id, ['user_id' => $owner->id]);

    $this->actingAs($owner)
        ->get(route('contacts.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('contacts', 2)
            ->where('totals.asset_primary', '100')
            ->where('totals.liability_primary', '40')
            ->where('totals.net_primary', '60'));
});

test('a joint obligation is one separate group row, counted once (not per person)', function (): void {
    $owner = User::factory()->create();
    $a = Contact::factory()->forUser($owner)->create(['name' => 'Mannan']);
    $b = Contact::factory()->forUser($owner)->create(['name' => 'Bodiuzzaman']);
    $c = Contact::factory()->forUser($owner)->create(['name' => 'Kamruzzaman']);

    // The three together borrowed 70,000 from you (one receivable, three people).
    $lent = Transaction::factory()->forUser($owner)->receivable(70000)->create();
    $lent->contacts()->attach([$a->id, $b->id, $c->id], ['user_id' => $owner->id]);

    $this->actingAs($owner)
        ->get(route('contacts.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            // 3 individual rows (all zero) + 1 group row = 4 total.
            ->has('contacts', 4)
            // Each individual carries nothing from the shared obligation.
            ->where('contacts.0.asset_primary', '0')
            ->where('contacts.1.asset_primary', '0')
            ->where('contacts.2.asset_primary', '0')
            // The group is its own row for the FULL amount, counted once.
            ->where('contacts.3.is_group', true)
            ->where('contacts.3.asset_primary', '70000')
            ->where('contacts.3.receivable_total_primary', '70000')
            // Grand total equals the real lent amount — not 210,000.
            ->where('totals.asset_primary', '70000')
            ->where('totals.receivable_total_primary', '70000'));
});

test('a group obligation is excluded from each member individual statement summary', function (): void {
    $owner = User::factory()->create();
    $a = Contact::factory()->forUser($owner)->create(['name' => 'Mannan']);
    $b = Contact::factory()->forUser($owner)->create(['name' => 'Bodiuzzaman']);

    $lent = Transaction::factory()->forUser($owner)->receivable(70000)->create();
    $lent->contacts()->attach([$a->id, $b->id], ['user_id' => $owner->id]);

    // Mannan's statement lists the shared transaction (flagged, with co-people) but his
    // individual summary excludes it — the debt belongs to the group row.
    $this->actingAs($owner)
        ->get(route('contacts.show', $a))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('summary.assets_primary', '0')
            ->where('transactions.0.is_group', true)
            ->where('transactions.0.co_people.0.name', 'Bodiuzzaman'));
});

test('a plain user cannot mutate a super-admin-owned shared contact', function (): void {
    $superAdmin = User::factory()->create(['role' => UserRole::SuperAdmin]);
    $viewer = User::factory()->create(['role' => UserRole::User]);
    $shared = Contact::factory()->forUser($superAdmin)->create(['name' => 'Shared']);

    $this->actingAs($viewer)
        ->patch(route('contacts.update', $shared), ['name' => 'Hacked'])
        ->assertForbidden();

    expect($shared->refresh()->name)->toBe('Shared');
});
