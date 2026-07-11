# Probasirhisab — Application Blueprint

A build-level map of the application: layers, request lifecycle, route → controller →
service → model wiring, and the frontend page tree. Use this as the "where does X live"
index when onboarding.

---

## 1. Layered architecture

```
┌────────────────────────────────────────────────────────────────┐
│ PRESENTATION (resources/js)                                     │
│  React 19 pages (Inertia) · layouts · components/ui (Radix)     │
│  Wayfinder-generated typed routes (resources/js/routes)         │
├────────────────────────────────────────────────────────────────┤
│ HTTP (app/Http)                                                 │
│  Controllers · Middleware · Form Requests                       │
├────────────────────────────────────────────────────────────────┤
│ DOMAIN SERVICES (app/Services) + SUPPORT (app/Support)          │
│  TransactionLedgerSync · ExchangeRateService ·                  │
│  DatabaseBackupService · EnvFileWriter                          │
│  Currency · SharedCatalog · PrimaryCashBalance · DashboardTiles │
│  TransactionType · CategoryType · TransactionListSortOrder ·    │
│  Installation                                                   │
├────────────────────────────────────────────────────────────────┤
│ PERSISTENCE (app/Models + database)                             │
│  Eloquent models · migrations · factories                       │
├────────────────────────────────────────────────────────────────┤
│ PLATFORM                                                        │
│  Laravel 13 · Fortify · Inertia · MySQL/SQLite · Vite           │
└────────────────────────────────────────────────────────────────┘
```

---

## 2. Middleware pipeline (`bootstrap/app.php`)

```
web group:
  UseFileSessionWhenNotInstalled  (prepended)
  EncryptCookies (except appearance, sidebar_state)
  … Laravel web defaults …
  HandleAppearance
  SetLocale
  HandleInertiaRequests           (shares auth.user, locale, branding, canManageUsers)
  AddLinkHeadersForPreloadedAssets
  RedirectToInstaller

Route aliases:
  install.guest → RedirectIfInstallerCompleted
  staff         → EnsureStaffAccess (super_admin | admin)
```

Exception rendering is centralized: non-API, non-validation, non-auth exceptions render the
`errors/Error` Inertia page with a localized title/description and correct status code.

---

## 3. Route → Controller → Service → Store map

| Route name | Controller@action | Services / Support used | Stores touched |
|------------|-------------------|-------------------------|----------------|
| dashboard | `DashboardController` | Currency, DashboardTiles | transactions, transaction_settlements |
| dashboard.tile-order | `DashboardTileOrderController` | DashboardTiles | users |
| transactions.index | `TransactionController@index` | Currency, SharedCatalog, PrimaryCashBalance, ExchangeRateService | transactions, settlements, categories, contacts |
| transactions.store | `TransactionController@store` | SharedCatalog, PrimaryCashBalance, TransactionListSortOrder, **TransactionLedgerSync** | transactions, contact_transaction, ledger_entries |
| transactions.update | `TransactionController@update` | (same as store) | transactions, contact_transaction, ledger_entries |
| transactions.destroy | `TransactionController@destroy` | — (model cascade) | transactions, ledger_entries |
| transactions.show | `TransactionController@show` | Currency, SharedCatalog | transactions, settlements, categories, contacts |
| transactions.reorder / reorderRows | `TransactionController@reorder*` | — | transactions, transaction_settlements |
| transactions.settlements.store/update/destroy | `TransactionSettlementController` | SharedCatalog, PrimaryCashBalance, TransactionListSortOrder, **TransactionLedgerSync** | transaction_settlements, transactions, ledger_entries |
| ledger.index | `LedgerController@index` | Currency, TransactionType | ledger_entries (+ joins) |
| reports.balance-sheet | `Reports\BalanceSheetController@index` | Currency | transactions |
| categories.* | `CategoryController` | SharedCatalog, CategoryType | categories |
| contacts.* | `ContactController` | SharedCatalog | contacts, contact_transaction |
| currency.edit/update | `Settings\CurrencyController` | Currency, ExchangeRateService, ExchangeRateSetting | users, exchange_rate_settings |
| profile.* | `Settings\ProfileController` | ProfileValidationRules | users |
| security.edit / user-password.update | `Settings\SecurityController` | PasswordValidationRules | users |
| settings.users.* | `Settings\UserManagementController` | UserPolicy, UserRole | users |
| settings.database.* | `Settings\DatabaseBackupController` | DatabaseBackupService | SQL dump / restore |
| install.* | `InstallController` | Installation, EnvFileWriter | .env, migrations, users |
| (Fortify) login/2fa/verify | Fortify + `FortifyServiceProvider` | Actions/Fortify/* | users, sessions |

---

## 4. Services & Support responsibilities

| Class | Responsibility |
|-------|----------------|
| `Services\TransactionLedgerSync` | Project transactions + settlements into debit/credit ledger lines; prune stale lines. **The accounting engine.** |
| `Services\ExchangeRateService` | Fetch FX rates from a configurable API with URL templating and 15-min cache; parse multiple response shapes. |
| `Services\DatabaseBackupService` | Driver-aware SQL dump/restore (mysqldump / sqlite), binary discovery, restore gating. |
| `Services\EnvFileWriter` | Idempotent merge of key/value pairs into `.env` during install. |
| `Support\PrimaryCashBalance` | Net cash = `Σ(credit_primary − debit_primary)` over posted ledger lines. |
| `Support\SharedCatalog` | Visibility + mutation matrix for shared (Super-Admin-owned) categories/contacts. |
| `Support\Currency` | Supported currencies and their decimal precision. |
| `Support\TransactionType` / `CategoryType` | Canonical type enums (labels + values). |
| `Support\TransactionListSortOrder` | Next `sort_order` value for append-to-bottom drag ordering. |
| `Support\DashboardTiles` | Canonical tile IDs + normalization of the saved order. |
| `Support\Installation` | Install lock file management (`storage/app/.installed`). |

---

## 5. Frontend page tree (`resources/js/pages`)

```
auth/            login · two-factor-challenge · verify-email · confirm-password
install/         wizard
dashboard.tsx
transactions/    index · show
ledger/          index
reports/         balance-sheet
categories/      index
contacts/        index · show
settings/        profile · currency · security · appearance · users · database
errors/          Error
```

Layout resolution (`app.tsx`): `install/*` & `errors/*` → none; `auth/*` → AuthLayout;
`settings/*` → `[AppLayout, SettingsLayout]`; everything else → AppLayout.

Sidebar nav (in order): Dashboard · Categories · People · Transactions · Ledger · Balance Sheet.

---

## 6. Build & tooling entry points

| Command | Purpose |
|---------|---------|
| `composer dev` | Concurrent: `php artisan serve` + `queue:listen` + `npm run dev` |
| `composer setup` | Fresh install: deps + `.env` + key + migrate + npm build |
| `composer test` | `config:clear` + Pint check + `artisan test` (Pest) |
| `composer lint` / `lint:check` | Pint format / verify |
| `npm run build` / `build:ssr` | Vite production build (+ SSR bundle) |
| `npm run types:check` | `tsc --noEmit` |

---

## 7. Extension points (where to add features)

- **New transaction behaviour** → extend `TransactionLedgerSync` rules + add a Pest test in
  `tests/Feature/Ledger`.
- **New currency** → add to `Support\Currency::supported()`.
- **New report** → add a controller under `Http/Controllers/Reports` + an Inertia page under
  `pages/reports` + a sidebar entry.
- **New role capability** → extend `Enums\UserRole` + `Support\SharedCatalog` and/or
  `Policies\UserPolicy`.
- **New FX provider** → `ExchangeRateService::buildUrl()` supports `{base}`/`{key}` templating
  and per-provider heuristics.
