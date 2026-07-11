# Probasirhisab — Testing

## Framework

- **Pest 4** (`pestphp/pest`, `pest-plugin-laravel`) over PHPUnit.
- `RefreshDatabase` on all Feature tests (see `tests/Pest.php`).
- Tests run against **SQLite `:memory:`** (`phpunit.xml`), so migrations must be
  SQLite-compatible.

## Running

```bash
php artisan test                       # full suite
php artisan test tests/Feature/Ledger  # a directory
composer test                          # config:clear + Pint check + artisan test
```

## Suite layout

```
tests/Feature/
  Auth/                 (pre-existing) authentication, registration, 2FA, verification
  Ledger/
    LedgerSyncTest.php          ← accounting engine invariants
  Transactions/
    TransactionStoreTest.php    ← create/validation/FX/cash-guard/authorization
    SettlementTest.php          ← settlement lifecycle & guards
  SharedCatalogTest.php         ← shared-catalog visibility/mutation matrix
  DashboardTest.php             (pre-existing)
  Settings/                     (pre-existing) profile, database backup
```

## What the new financial-core suites cover

### `Ledger/LedgerSyncTest.php`
The accounting heart. Asserts the debit/credit projection rules for all four transaction
types, settlement lines for payable/receivable, secondary-currency proportional derivation,
pruning of removed/orphaned settlement lines, cascade deletion, and the central invariant:

> **net cash == Σ(credit_primary − debit_primary)** over posted ledger entries.

### `Transactions/TransactionStoreTest.php`
HTTP-level: valid creation posts to the ledger; FX derivation from `rate` in both
directions; rejection of missing amount / non-positive rate; the **cash guard** blocking
expense/receivable without sufficient cash; category ownership + type matching;
many-to-many contact linking; cross-user 403 on update.

### `Transactions/SettlementTest.php`
Partial/full settlement; over-payment and cumulative-over-total guards; payable
cash guard; settlement deletion restoring outstanding balance and cash; wrong settlement
category type rejected; settlements limited to payable/receivable; cross-user 403.

### `SharedCatalogTest.php`
`SharedCatalog` visibility and the mutation matrix across super_admin / admin / user roles.

## Model factories added

`database/factories/` gained `TransactionFactory`, `TransactionSettlementFactory`,
`CategoryFactory`, and `ContactFactory` (the four domain models now `use HasFactory`).
Helper states worth knowing:

```php
Transaction::factory()->forUser($u)->income(500)->create();
Transaction::factory()->forUser($u)->payable(1000)->withSecondary(rate: 300)->create();
Category::factory()->ofType('settle_payable')->forUser($u)->create();
TransactionSettlement::factory()->forTransaction($tx)->create(['amount' => 400]);
```

## Bugs found & fixed while adding coverage

1. **Migration `2026_05_01_000007` broke the entire test suite on SQLite** — it dropped a
   foreign key by name, which SQLite's schema grammar does not support, so *every* test
   (including the pre-existing ones) errored during `RefreshDatabase`. Made the FK-juggling
   MySQL-only and added a SQLite-safe path. See `docs/CHANGELOG-review.md`.
2. **`TransactionController` & `TransactionSettlementController` 500'd when `note`/`source`
   were omitted** — validated-but-absent `nullable` keys were read with `$data['note']`,
   throwing `Undefined array key`. Guarded with `?? null`.

Full suite after fixes: **89 tests passing, 2 skipped** (Fortify feature-gated).
