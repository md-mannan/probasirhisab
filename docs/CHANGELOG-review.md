# Engineering Review — Change Log

Changes made during the documentation & hardening pass. All changes are additive or
bug-fixes; no behaviour was altered for the happy path.

## Bug fixes

### 1. Test suite fully broken on SQLite (migration)
**File:** `database/migrations/2026_05_01_000007_update_ledger_entries_for_settlements.php`

The migration dropped a foreign key **by name** (`$table->dropForeign($foreignKey['name'])`).
SQLite's schema grammar throws *"This database driver does not support dropping foreign keys
by name."* Because `phpunit.xml` runs tests on SQLite `:memory:` with `RefreshDatabase`,
**every test in the project errored** during migration — the suite could not run at all.

**Fix:** branch on `DB::getDriverName()`. MySQL keeps the original FK-drop/rebuild dance;
SQLite adds the `settlement_id` column and swaps the unique index without touching FKs by
name (SQLite rebuilds the table internally anyway). Production MySQL behaviour is unchanged.

### 2. 500 error when `note`/`source` omitted on transactions
**Files:** `app/Http/Controllers/TransactionController.php` (store + update),
`app/Http/Controllers/TransactionSettlementController.php` (store + update)

`note` and `source` are `nullable` validation rules, so when the client omits them they are
**absent** from the validated `$data` array. The code read `$data['note']` / `$data['source']`
directly, throwing `Undefined array key` (HTTP 500) on any create/update that didn't send
those fields.

**Fix:** null-coalesce the access — `($data['note'] ?? null) ? trim($data['note']) : null`.

## Additions

### Model factories
- `database/factories/TransactionFactory.php`
- `database/factories/TransactionSettlementFactory.php`
- `database/factories/CategoryFactory.php`
- `database/factories/ContactFactory.php`
- Added `use HasFactory` to `Transaction`, `TransactionSettlement`, `Category`, `Contact`.

### Test suites (Pest)
- `tests/Feature/Ledger/LedgerSyncTest.php` — 13 tests (accounting engine).
- `tests/Feature/Transactions/TransactionStoreTest.php` — 12 tests.
- `tests/Feature/Transactions/SettlementTest.php` — 8 tests.
- `tests/Feature/SharedCatalogTest.php` — 8 tests.

### Documentation
- `DOCUMENTATION.md` (master), `docs/README.md`, `docs/ERD.md`, `docs/DFD.md`,
  `docs/BLUEPRINT.md`, `docs/TESTING.md`, and Mermaid sources under `docs/diagrams/`.

## Verification

```
php artisan test   → 89 passed (2 skipped, Fortify feature-gated)
vendor/bin/pint    → passed (changed files)
```
