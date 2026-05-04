<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

test('home route shows the login page', function () {
    $response = $this->get(route('home'));

    $response->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('auth/login'));
});

test('authenticated users visiting home are redirected to the dashboard', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->get(route('home'));

    $response->assertRedirect(route('dashboard'));
});
