<?php

use App\Models\Contact;
use App\Models\Transaction;
use App\Models\User;

/**
 * People are sourced from system users. Visiting the People page provisions one
 * user-backed contact per system user, adopting an existing same-name contact so
 * its transaction history is preserved.
 */
test('the people page provisions one contact per system user', function (): void {
    $owner = User::factory()->create(['name' => 'Owner']);
    $alice = User::factory()->create(['name' => 'Alice']);
    $bob = User::factory()->create(['name' => 'Bob']);

    $this->actingAs($owner)
        ->get(route('contacts.index'))
        ->assertOk();

    // A contact (owned by $owner) now exists for each system user.
    foreach ([$owner, $alice, $bob] as $member) {
        expect(
            Contact::where('user_id', $owner->id)
                ->where('member_user_id', $member->id)
                ->exists(),
        )->toBeTrue();
    }
});

test('an existing same-name contact is adopted, not duplicated', function (): void {
    $owner = User::factory()->create(['name' => 'Owner']);
    $member = User::factory()->create(['name' => 'Kamruzzaman']);

    // A legacy manual contact with the same name and a linked transaction.
    $contact = Contact::factory()->forUser($owner)->create([
        'name' => 'Kamruzzaman',
        'member_user_id' => null,
    ]);
    $tx = Transaction::factory()->forUser($owner)->income(100)->create();
    $contact->linkedTransactions()->attach($tx->id, ['user_id' => $owner->id]);

    $this->actingAs($owner)->get(route('contacts.index'))->assertOk();

    $contact->refresh();

    // The same contact row was adopted (member set), no duplicate, link preserved.
    expect($contact->member_user_id)->toBe($member->id)
        ->and(Contact::where('user_id', $owner->id)->where('name', 'Kamruzzaman')->count())->toBe(1)
        ->and($contact->linkedTransactions()->where('transactions.id', $tx->id)->exists())->toBeTrue();
});

test('the people list shows only user-backed people', function (): void {
    $owner = User::factory()->create(['name' => 'Owner']);
    // A stray contact matching no user should not appear in the list.
    Contact::factory()->forUser($owner)->create([
        'name' => 'Ghost Person',
        'member_user_id' => null,
    ]);

    $this->actingAs($owner)
        ->get(route('contacts.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('contacts', fn ($contacts) => collect($contacts)
                ->every(fn ($c) => $c['name'] !== 'Ghost Person')));
});

test('manual create/update/delete routes no longer exist', function (): void {
    expect(fn () => route('contacts.store'))->toThrow(Exception::class)
        ->and(fn () => route('contacts.update', 1))->toThrow(Exception::class)
        ->and(fn () => route('contacts.destroy', 1))->toThrow(Exception::class);
});
