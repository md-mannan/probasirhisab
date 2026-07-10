# Probasirhisab — Engineering Documentation

> **Probasirhisab** (Bengali: *প্রবাসীর হিসাব* — "the expatriate's accounts") is a self-hostable, multi-currency personal-finance & double-entry-style bookkeeping application aimed primarily at overseas (expatriate) workers who need to track income, expenses, money they've lent (receivables), money they've borrowed (payables), and settlements across **two currencies** (e.g. earning in KWD, sending home in BDT).

Document generated as a senior full-stack review of the codebase.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture](#3-system-architecture)
4. [Domain Model & Business Logic](#4-domain-model--business-logic)
5. [Entity Relationship Diagram (ERD)](#5-entity-relationship-diagram-erd)
6. [Data Flow Diagrams (DFD)](#6-data-flow-diagrams-dfd)
7. [Application Blueprint (Routes & Modules)](#7-application-blueprint-routes--modules)
8. [Security & Authorization](#8-security--authorization)
9. [Key Workflows (Sequence Diagrams)](#9-key-workflows-sequence-diagrams)
10. [Frontend Architecture](#10-frontend-architecture)
11. [Configuration & Environment](#11-configuration--environment)
12. [Installation & Deployment](#12-installation--deployment)
13. [Testing](#13-testing)
14. [Observations, Risks & Recommendations](#14-observations-risks--recommendations)

---

## 1. Project Overview

### What it does

Probasirhisab is a single-tenant-per-install (multi-user) money tracker built around four core transaction types and a running cash ledger:

| Type | Meaning | Cash effect at creation |
|------|---------|-------------------------|
| **Income** | Money earned | Cash **+** (credit) |
| **Expense** | Money spent | Cash **−** (debit) |
| **Payable** | Money you borrowed (you owe) | Cash **+** (credit); creates an obligation |
| **Receivable** | Money you lent (owed to you) | Cash **−** (debit); creates an asset |

Payables and Receivables can be **settled** incrementally over time via `TransactionSettlement` records. Every transaction and every settlement is projected into an append-only-style **ledger** (`ledger_entries`) that supports a chronological running balance in both the primary and secondary currency.

### Key features

- **Dual-currency accounting** — each transaction stores a primary amount + currency and an optional secondary amount + currency, linked by an FX `rate`. Live FX previews come from a pluggable exchange-rate API.
- **Double-entry-style ledger** — `TransactionLedgerSync` keeps `ledger_entries` in sync (debit/credit lines) for both base transactions and their settlements.
- **Dashboard** — cash position, income/expense totals, payable/receivable outstanding vs. settled, monthly & yearly trend charts, and drag-reorderable summary tiles.
- **Balance Sheet report** — assets (cash + receivables) vs. liabilities (payables) with net position.
- **Contacts ("People")** — associate people with transactions (many-to-many) to track who you lent to / borrowed from.
- **Categories** — per-type user categories, with a **shared catalog** where Super Admin categories/contacts are visible to everyone.
- **Web-based installer** — `/install` wizard configures DB, admin user, branding logo, and locale; writes `.env` and runs migrations.
- **Role-based user management** — Super Admin / Admin / User with a permission hierarchy.
- **Database backup & restore** — download SQL dumps, restore from upload (staff only).
- **i18n** — English, Bengali, Spanish, French, Arabic; per-user locale with RTL support for Arabic.
- **Auth** — Laravel Fortify (login, email verification, two-factor authentication, password confirmation).

### Target user

An expatriate worker (the naming and default currencies KWD→BDT, plus Bengali default category names like *"ধারের টাকা ফেরত দিলাম"*) managing personal cross-border finances, optionally shared among a small set of trusted users on one install.

---

## 2. Technology Stack

### Backend

| Concern | Choice |
|---------|--------|
| Language | PHP **8.3+** |
| Framework | **Laravel 13** |
| Auth | **Laravel Fortify** (2FA, email verification) |
| SPA bridge | **Inertia.js (Laravel adapter v3)** |
| Type-safe routes | **Laravel Wayfinder** + `@laravel/vite-plugin-wayfinder` |
| REPL/tooling | Tinker, Pail (log tail), Boost, Pint (formatting), Pest 4 (tests) |
| DB | **MySQL / MariaDB** (production), **SQLite** (dev/optional) |

### Frontend

| Concern | Choice |
|---------|--------|
| Language | **TypeScript 5.7** |
| UI library | **React 19** (with React Compiler / `babel-plugin-react-compiler`) |
| SPA | **Inertia.js React adapter** |
| Build | **Vite 8** (+ SSR build option) |
| Styling | **Tailwind CSS 4** (Oxide/Lightning CSS) |
| Components | **Radix UI** primitives + **shadcn-style** `components/ui` |
| Icons | **lucide-react** |
| Charts | **Chart.js 4** + `react-chartjs-2` |
| Drag & drop | **@dnd-kit** (sortable transactions & dashboard tiles) |
| Toasts | **sonner** |
| Export | **xlsx**, **jspdf**, **html2pdf.js**, **html2canvas** |

### Deployment target

Shared **cPanel** hosting (Git Version Control deploy via `cpanel.yml`), with a browser-based first-run installer.

---

## 3. System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                              BROWSER                                   │
│  React 19 + Inertia + TS  (resources/js/pages/*.tsx)                   │
│  Tailwind 4 · Radix UI · Chart.js · dnd-kit · sonner                   │
└───────────────▲───────────────────────────────────┬──────────────────┘
                │  Inertia XHR (JSON props)          │  Full-page (first load)
                │  ← flash toasts, shared props       │  Vite manifest / SSR
┌───────────────┴───────────────────────────────────▼──────────────────┐
│                       LARAVEL 13 (app/)                                │
│                                                                       │
│  Middleware pipeline (bootstrap/app.php):                             │
│   UseFileSessionWhenNotInstalled → EncryptCookies → …                 │
│   → HandleAppearance → SetLocale → HandleInertiaRequests              │
│   → RedirectToInstaller → [auth, verified, staff, install.guest]      │
│                                                                       │
│  Controllers ──► Services ──► Eloquent Models ──► DB                  │
│   Dashboard      TransactionLedgerSync   Transaction                  │
│   Transaction    ExchangeRateService     TransactionSettlement        │
│   Settlement     DatabaseBackupService   LedgerEntry                  │
│   Ledger         EnvFileWriter           Category / Contact / User    │
│   Category       (Support/*: Currency, SharedCatalog,                 │
│   Contact          PrimaryCashBalance, DashboardTiles, …)             │
│   BalanceSheet                                                        │
│   Install / Settings(Profile,Currency,Security,Users,DB backup)      │
│                                                                       │
│  Auth: Fortify (login, 2FA, email verify, password confirm)          │
└───────────────┬───────────────────────────────────┬──────────────────┘
                │                                    │
     ┌──────────▼─────────┐              ┌───────────▼────────────┐
     │  Relational DB     │              │  External FX API       │
     │  MySQL / SQLite    │              │  open.er-api.com /     │
     │  (transactions,    │              │  exchangerate-api.com  │
     │   ledger, users…)  │              │  (cached 15 min)       │
     └────────────────────┘              └────────────────────────┘
```

**Architectural style:** Classic Laravel "modular monolith" with a server-driven SPA via Inertia (no separate REST API; controllers return Inertia page components with typed props). Business rules concentrated in **Services** and **Support** helper classes; controllers stay orchestration-focused (though `TransactionController` and `DashboardController` carry heavy inline logic).

---

## 4. Domain Model & Business Logic

### 4.1 Core entities

- **User** — account holder. Owns everything. Has `role` (enum), `primary_currency`, `secondary_currency`, `locale`, `dashboard_tile_order` (JSON), `avatar_path`, 2FA columns.
- **Category** — user-scoped label with a `type` (income/expense/payable/receivable/settle_payable/settle_receivable). Unique per `(user_id, type, name)`.
- **Contact** ("Person") — someone you transact with. Linked to transactions **many-to-many** via `contact_transaction` (a legacy single `transactions.contact_id` FK also exists, kept nullable).
- **Transaction** — the central record: `type`, `amount`/`currency` (primary), optional `secondary_amount`/`secondary_currency`/`rate`, `settled_amount` (denormalized cache for payable/receivable), `occurred_on`, `sort_order` (manual drag order), `note`, `source`.
- **TransactionSettlement** — a payment against a payable/receivable: `amount`, `paid_on`, `category_id` (settle_* type), `source`, `note`, `sort_order`.
- **LedgerEntry** — projected debit/credit line(s). One base line per transaction (`settlement_id = null`) plus one per settlement. Unique on `(transaction_id, settlement_id)`. Stores `debit_primary`/`credit_primary` and nullable secondary equivalents.
- **ExchangeRateSetting** — a single global row holding the FX API URL/key used for rate previews (singleton via `ExchangeRateSetting::the()`).

### 4.2 The ledger sync engine (`App\Services\TransactionLedgerSync`)

This is the accounting heart of the app. On every transaction create/update:

**Base line rules** (cash impact):

| Type | Primary line |
|------|--------------|
| income | `credit_primary = amount` |
| payable | `credit_primary = amount` |
| expense | `debit_primary = amount` |
| receivable | `debit_primary = amount` |

**Settlement lines** (only for payable/receivable):

| Obligation | Settlement line |
|------------|-----------------|
| payable (repaying) | `debit_primary = paid` (cash out) |
| receivable (collecting) | `credit_primary = paid` (cash in) |

Secondary-currency amounts are derived proportionally: `paySecondary = payPrimary × (secondary_amount / amount)`. The sync uses `updateOrCreate` keyed on `(transaction_id, settlement_id)` and prunes ledger lines for settlements that no longer exist. Transaction deletion cascades ledger removal (both via model `deleting` hook and DB `cascadeOnDelete`).

### 4.3 Cash balance & guards

`App\Support\PrimaryCashBalance::forUserId()` computes net cash = `Σ(credit_primary − debit_primary)` over ledger entries with an existing transaction. This is enforced at write time:

- Creating an **expense** or **receivable** requires sufficient cash (else validation error).
- Recording a **payable settlement** (cash outflow) requires sufficient cash.
- Updating rebalances by crediting back the old outflow before checking.

### 4.4 Dual-currency handling

- A transaction may be entered as primary-only, secondary-only, or both, plus an optional `rate`.
- If a `rate` is given and one side is missing, the other is derived (`secondary = primary × rate` or `primary = secondary / rate`).
- Dashboard/Balance-Sheet track "secondary complete" flags: if *any* contributing row lacks a secondary amount, secondary totals are suppressed (rendered `null`) rather than shown as misleading partial sums.
- `App\Support\Currency` defines supported currencies and their decimal precision (KWD/USD/EUR = 3, BDT/INR/PKR/LKR = 2).

### 4.5 Shared catalog (multi-user visibility)

`App\Support\SharedCatalog` implements a "global defaults" pattern: **Super Admin-owned** categories and contacts are visible to *all* users, while each user also sees their own. Mutation rules: owners can edit their own; Super Admin can edit anything; Admin can edit Super-Admin-owned shared rows.

---

## 5. Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    USERS ||--o{ CATEGORIES : owns
    USERS ||--o{ CONTACTS : owns
    USERS ||--o{ TRANSACTIONS : owns
    USERS ||--o{ TRANSACTION_SETTLEMENTS : owns
    USERS ||--o{ LEDGER_ENTRIES : owns

    CATEGORIES ||--o{ TRANSACTIONS : "categorizes (nullOnDelete)"
    CATEGORIES ||--o{ TRANSACTION_SETTLEMENTS : "categorizes (nullOnDelete)"

    CONTACTS ||--o{ TRANSACTIONS : "legacy contact_id (nullOnDelete)"
    CONTACTS ||--o{ CONTACT_TRANSACTION : links
    TRANSACTIONS ||--o{ CONTACT_TRANSACTION : links
    CONTACTS }o--o{ TRANSACTIONS : "many-to-many (contact_transaction)"

    TRANSACTIONS ||--o{ TRANSACTION_SETTLEMENTS : "settled by (cascade)"
    TRANSACTIONS ||--o| LEDGER_ENTRIES : "base line (cascade)"
    TRANSACTION_SETTLEMENTS ||--o{ LEDGER_ENTRIES : "settlement line (cascade)"

    USERS {
        bigint id PK
        string name
        string email UK
        string locale
        string primary_currency
        string secondary_currency
        string exchange_rate_api_url "legacy; now global table"
        string exchange_rate_api_key "legacy"
        string password
        string role "super_admin|admin|user"
        text two_factor_secret
        text two_factor_recovery_codes
        timestamp two_factor_confirmed_at
        json dashboard_tile_order
        string avatar_path
        timestamps
    }

    CATEGORIES {
        bigint id PK
        bigint user_id FK
        string name
        string type "income|expense|payable|receivable|settle_payable|settle_receivable"
        timestamps
    }

    CONTACTS {
        bigint id PK
        bigint user_id FK
        string name
        timestamps
    }

    TRANSACTIONS {
        bigint id PK
        bigint user_id FK
        bigint category_id FK "nullable"
        bigint contact_id FK "nullable, legacy"
        string type "income|expense|payable|receivable"
        decimal amount "18,3"
        decimal secondary_amount "18,3 nullable"
        decimal settled_amount "18,3 nullable (denormalized)"
        string currency "3"
        string secondary_currency "3 nullable"
        decimal rate "18,8 nullable"
        date occurred_on
        int sort_order "nullable"
        text note
        string source
        timestamps
    }

    TRANSACTION_SETTLEMENTS {
        bigint id PK
        bigint transaction_id FK
        bigint user_id FK
        bigint category_id FK "nullable, settle_* type"
        decimal amount "18,3"
        date paid_on
        string source
        text note
        bigint sort_order "nullable"
        timestamps
    }

    LEDGER_ENTRIES {
        bigint id PK
        bigint user_id FK
        bigint transaction_id FK
        bigint settlement_id FK "nullable"
        date occurred_on
        string type
        text description
        decimal primary_amount "18,3"
        string primary_currency "3"
        decimal secondary_amount "18,3 nullable"
        string secondary_currency "3 nullable"
        decimal debit_primary "18,3 default 0"
        decimal credit_primary "18,3 default 0"
        decimal debit_secondary "18,3 nullable"
        decimal credit_secondary "18,3 nullable"
        timestamps
    }

    CONTACT_TRANSACTION {
        bigint id PK
        bigint user_id FK
        bigint contact_id FK
        bigint transaction_id FK
        timestamps
    }

    EXCHANGE_RATE_SETTINGS {
        bigint id PK
        string exchange_rate_api_url "2048"
        string exchange_rate_api_key "255"
        timestamps
    }
```

### Constraints & indexes (highlights)

- `categories`: `UNIQUE(user_id, type, name)`, `INDEX(user_id, type)`.
- `transactions`: `INDEX(user_id, type, occurred_on)`, `INDEX(user_id, contact_id, occurred_on)`, `INDEX(user_id, sort_order, id)`, `transactions_user_occurred_id_idx(user_id, occurred_on, id)`.
- `ledger_entries`: `UNIQUE(transaction_id, settlement_id)`, `INDEX(user_id, occurred_on, id)`. (Originally `UNIQUE(transaction_id)`; relaxed in migration `..._000007` to allow multiple lines per transaction.)
- `transaction_settlements`: `INDEX(transaction_id, paid_on)`, `ts_user_paid_on_idx(user_id, paid_on)`, `INDEX(user_id, sort_order)`.
- `contact_transaction`: `UNIQUE(contact_id, transaction_id)` + user/contact/transaction indexes.
- FKs use `cascadeOnDelete` for ownership (user, transaction→settlement→ledger) and `nullOnDelete` for optional refs (category, legacy contact_id).

### Framework/system tables

`users` migration also creates `password_reset_tokens`, `sessions`. Standard Laravel `cache`, `cache_locks`, `jobs`, `job_batches`, `failed_jobs` tables exist for queue/cache infra.

---

## 6. Data Flow Diagrams (DFD)

### 6.1 Level 0 — Context Diagram

```
                 ┌───────────────────────────────────────────┐
   credentials   │                                           │  page props /
   tx data       │                                           │  charts / reports
  ───────────────►         PROBASIRHISAB SYSTEM              ├──────────────►  USER
   settlements   │       (Laravel + Inertia + React)         │  toasts / exports
   settings      │                                           │
                 └───┬───────────────────────────▲───────────┘
                     │ rate request              │ rate JSON
                     ▼                            │
             ┌────────────────────────────────────────┐
             │      EXTERNAL EXCHANGE-RATE API         │
             │  (open.er-api.com / exchangerate-api)   │
             └────────────────────────────────────────┘
```

External entities: **User** (browser), **Exchange-Rate API**. During install, the **cPanel/host filesystem** (`.env`, storage lock, logo) is also written.

### 6.2 Level 1 — Major processes & data stores

```
 USER
  │  (1) login / 2FA                 ┌──────────────────┐
  ├─────────────────────────────────► 1.0 AUTH         │◄──► D1 users / sessions
  │                                  │  (Fortify)       │
  │  (2) create/edit transaction     └──────────────────┘
  ├─────────────────────────────────► 2.0 TRANSACTION  │◄──► D2 transactions
  │        ▲   validation, FX,        │     MGMT        │──►  D3 contact_transaction
  │        │   cash-balance guard     └───────┬──────────┘◄──► D4 categories / contacts
  │        │                                  │ syncForTransaction()
  │        │                                  ▼
  │        │                          ┌──────────────────┐
  │        │                          │ 3.0 LEDGER SYNC  │──►  D5 ledger_entries
  │        │                          └──────────────────┘
  │  (3) add settlement                       ▲
  ├───────────────────────────────────────────┘──► D6 transaction_settlements
  │
  │  (4) view dashboard / reports    ┌──────────────────┐
  ├─────────────────────────────────► 4.0 ANALYTICS &  │◄──  D2, D5, D6
  │        summaries, trends,         │   REPORTS        │
  │        running balance            └──────────────────┘
  │
  │  (5) FX preview                  ┌──────────────────┐    rate
  ├─────────────────────────────────► 5.0 FX SERVICE   │────────► [Exchange API]
  │                                  │  (15-min cache)  │◄──── rate JSON
  │                                  └──────────────────┘◄──► D7 exchange_rate_settings
  │
  │  (6) settings / users / backup   ┌──────────────────┐
  ├─────────────────────────────────► 6.0 ADMIN &      │◄──► D1 users
  │                                  │   SETTINGS       │──►  SQL dump / restore
  │                                  └──────────────────┘
  │
  │  (7) first-run install           ┌──────────────────┐
  └─────────────────────────────────► 7.0 INSTALLER    │──►  .env, migrations,
                                     └──────────────────┘     storage/.installed lock
```

### 6.3 Level 2 — "Create Transaction" (process 2.0 detail)

```
 request(type, amounts, rate, category_id, contact_ids, occurred_on, note)
        │
        ▼
 2.1 Validate input  ──fail──► back() with errors
        │ ok
        ▼
 2.2 Derive missing amount from rate (primary↔secondary)
        │
        ▼
 2.3 Resolve & authorize category (SharedCatalog visible owners, type match)
        │
        ▼
 2.4 Validate contacts belong to visible owners
        │
        ▼
 2.5 Guard: expense/receivable ⇒ enough cash?  ──fail──► back() error
        │ ok
        ▼
 2.6 Create Transaction row  ──►  D2 transactions
        │
        ▼
 2.7 Assign sort_order = max+1 (TransactionListSortOrder)
        │
        ▼
 2.8 Sync contacts pivot  ──►  D3 contact_transaction
        │
        ▼
 2.9 TransactionLedgerSync::syncForTransaction()  ──►  D5 ledger_entries
        │
        ▼
 flash success toast → redirect back (Inertia)
```

---

## 7. Application Blueprint (Routes & Modules)

### 7.1 Route map (`routes/web.php`, `routes/settings.php`)

| Method | URI | Controller / Action | Name | Guard |
|--------|-----|---------------------|------|-------|
| GET | `/install` | `InstallController@show` | install.show | install.guest |
| POST | `/install/locale` | `InstallController@setLocale` | install.locale | install.guest |
| POST | `/install` | `InstallController@store` | install.store | install.guest |
| GET | `/` | closure (login or redirect) | home | — |
| GET | `/dashboard` | `DashboardController` | dashboard | auth, verified |
| PATCH | `/dashboard/tile-order` | `DashboardTileOrderController` | dashboard.tile-order | auth, verified |
| GET/POST/PATCH/DELETE | `/categories…` | `CategoryController` | categories.* | auth, verified |
| GET/POST/PATCH/DELETE | `/contacts…` | `ContactController` | contacts.* | auth, verified |
| GET | `/contacts/{contact}` | `ContactController@show` | contacts.show | auth, verified |
| GET | `/transactions` | `TransactionController@index` | transactions.index | auth, verified |
| PATCH | `/transactions/reorder` | `@reorder` | transactions.reorder | auth, verified |
| PATCH | `/transactions/reorder-rows` | `@reorderRows` | transactions.reorderRows | auth, verified |
| GET/POST/PATCH/DELETE | `/transactions/{transaction}` | `@show/@store/@update/@destroy` | transactions.* | auth, verified |
| POST/PATCH/DELETE | `/transactions/{t}/settlements/{s?}` | `TransactionSettlementController` | transactions.settlements.* | auth, verified |
| GET | `/ledger` | `LedgerController@index` | ledger.index | auth, verified |
| GET | `/reports/balance-sheet` | `Reports\BalanceSheetController@index` | reports.balance-sheet | auth, verified |
| GET/PATCH | `/settings/profile` | `Settings\ProfileController` | profile.* | auth |
| GET/PATCH | `/settings/currency` | `Settings\CurrencyController` | currency.* | auth |
| DELETE | `/settings/profile` | `ProfileController@destroy` | profile.destroy | auth, verified |
| GET | `/settings/security` | `Settings\SecurityController@edit` | security.edit | auth, verified |
| PUT | `/settings/password` | `SecurityController@update` | user-password.update | auth, verified, throttle:6,1 |
| GET | `/settings/appearance` | Inertia page | appearance.edit | auth, verified |
| GET | `/settings/database` | `Settings\DatabaseBackupController@edit` | settings.database.edit | auth, verified, **staff** |
| GET | `/settings/database/download` | `@download` | settings.database.download | staff, throttle:20,1 |
| POST | `/settings/database/restore` | `@restore` | settings.database.restore | staff, throttle:3,10 |
| GET/POST/PATCH/DELETE | `/settings/users…` | `Settings\UserManagementController` | settings.users.* | auth, verified, **staff** |

Plus Fortify-provided auth routes (login, logout, 2FA challenge/enable/confirm, email verification, password confirmation).

### 7.2 Module breakdown

| Module | Backend | Frontend page(s) |
|--------|---------|------------------|
| Install | `InstallController`, `EnvFileWriter`, `Installation` | `install/wizard.tsx` |
| Auth | Fortify + `FortifyServiceProvider`, `Actions/Fortify/*` | `auth/login`, `auth/two-factor-challenge`, `auth/verify-email`, `auth/confirm-password` |
| Dashboard | `DashboardController`, `DashboardTileOrderController`, `DashboardTiles` | `dashboard.tsx` |
| Transactions | `TransactionController`, `TransactionLedgerSync`, `TransactionListSortOrder` | `transactions/index.tsx`, `transactions/show.tsx` |
| Settlements | `TransactionSettlementController` | (within transactions/show) |
| Ledger | `LedgerController` | `ledger/index.tsx` |
| Reports | `Reports\BalanceSheetController` | `reports/balance-sheet.tsx` |
| Categories | `CategoryController`, `SharedCatalog` | `categories/index.tsx` |
| Contacts | `ContactController`, `SharedCatalog` | `contacts/index.tsx`, `contacts/show.tsx` |
| FX | `ExchangeRateService`, `ExchangeRateSetting`, `Settings\CurrencyController` | `settings/currency.tsx` |
| Settings | Profile / Security / Currency / Appearance | `settings/*.tsx` |
| User mgmt | `Settings\UserManagementController`, `UserPolicy`, `UserRole` | `settings/users.tsx` |
| DB backup | `Settings\DatabaseBackupController`, `DatabaseBackupService` | `settings/database.tsx` |

---

## 8. Security & Authorization

### 8.1 Roles (`App\Enums\UserRole`)

```
super_admin  ── can access user mgmt, assign ANY role, mutate any shared row
admin        ── can access user mgmt, assign only `user` role, mutate Super-Admin shared rows
user         ── standard; owns own data only
```

- `canAccessUserManagement()` → super_admin | admin (enforced by `EnsureStaffAccess` / `staff` alias).
- `canAssignRole()` → super_admin can assign all; admin only `user`.

### 8.2 Ownership enforcement

- Almost every controller checks `$model->user_id !== $user->id → abort(403)`. Model `casts()` deliberately cast FKs to `integer` to avoid PDO string/int mismatch producing false 403s (documented in `Transaction`).
- `SharedCatalog::visibleOwnerIds()` widens *read* access to include Super Admin catalog rows; mutation guarded separately.
- Reorder endpoints verify every submitted id is owned before applying (`ownedCount === count(ids)` else 403).

### 8.3 Middleware chain

- `UseFileSessionWhenNotInstalled` — file-based sessions until install completes (DB not yet configured).
- `RedirectToInstaller` / `RedirectIfInstallerCompleted` (`install.guest`) — gate the installer based on `storage/app/.installed` lock.
- `SetLocale` — resolves per-user/session locale.
- `HandleInertiaRequests` — shares `auth.user`, `locale`, `branding`, `canManageUsers`, `sidebarOpen`.
- Rate limiting via `throttle:*` on password update, DB download/restore, user password reset.

### 8.4 Auth features (Fortify)

Email verification + two-factor authentication (with confirmation and password confirm). Login throttling keyed on `lower(email)|ip`.

### 8.5 Notable security considerations

- **Database restore** (upload → import) is a powerful, destructive, staff-only operation, throttled to 3/10min, and gated behind `database_backup.restore_enabled`.
- **Installer** writes `.env` and runs migrations; it self-disables once the lock file exists and refuses to seed if the DB is non-empty.
- FX service disables TLS verification only in local env (`app()->isLocal()`).
- Sensitive user attributes hidden from serialization (`#[Hidden(...)]`): password, 2FA secret/recovery codes, remember token, avatar_path.

---

## 9. Key Workflows (Sequence Diagrams)

### 9.1 Settle a payable/receivable

```mermaid
sequenceDiagram
    actor U as User
    participant R as React (transactions/show)
    participant C as TransactionSettlementController
    participant DB as Database
    participant S as TransactionLedgerSync

    U->>R: Enter payment (amount, date, category, source)
    R->>C: POST /transactions/{t}/settlements
    C->>C: authorize owner + type is payable/receivable
    C->>C: validate; resolve settle_* category
    C->>C: check add + settled ≤ total
    alt payable (cash out)
        C->>DB: PrimaryCashBalance (enough cash?)
    end
    C->>DB: create TransactionSettlement
    C->>DB: recompute transaction.settled_amount = Σ settlements
    C->>S: syncForTransaction(fresh)
    S->>DB: upsert base + settlement ledger_entries; prune removed
    C-->>R: flash toast + Inertia back()
    R-->>U: Updated list + running balance
```

### 9.2 First-run installation

```mermaid
sequenceDiagram
    actor U as User
    participant W as install/wizard.tsx
    participant I as InstallController
    participant Env as EnvFileWriter
    participant DB as Database

    U->>W: Fill DB creds, admin, branding, locale
    W->>I: POST /install
    I->>I: validate; requirement checks
    I->>DB: runtime reconnect + migrate --force
    I->>DB: ensure users table empty
    I->>DB: create Super Admin user
    I->>Env: write APP_*, DB_*, VITE_APP_NAME
    I->>I: store logo, storage:link, mark .installed lock
    I->>U: Auth::login + redirect /dashboard
```

---

## 10. Frontend Architecture

- **Entry:** `resources/js/app.tsx` — Inertia app bootstrap; layout resolver maps page-name prefixes to layouts:
  - `install/*` & `errors/*` → no layout
  - `auth/*` → `AuthLayout`
  - `settings/*` → `[AppLayout, SettingsLayout]`
  - default → `AppLayout`
- **Pages:** `resources/js/pages/**` (one `.tsx` per Inertia render target).
- **Layouts:** `layouts/app/*`, `layouts/auth/*`, `layouts/settings/*` (sidebar nav: Dashboard, Categories, People, Transactions, Ledger, Balance Sheet).
- **UI kit:** `components/ui/*` (shadcn-style over Radix), `components/*` for app-specific composites.
- **Type-safe routing:** Wayfinder generates `resources/js/routes/**` and `resources/js/actions/**` from PHP routes/controllers — call server routes with typed helpers instead of hardcoded URLs.
- **State/data:** Inertia props (server-driven); forms via Inertia `useForm`; toasts via `sonner` fed by `Inertia::flash('toast', …)`.
- **Charts:** Chart.js via `react-chartjs-2` for dashboard monthly/yearly trends.
- **DnD:** `@dnd-kit` for reordering transaction rows (`/transactions/reorder-rows`) and dashboard tiles.
- **Exports:** client-side `xlsx` / `jspdf` / `html2pdf.js` for report/ledger export.
- **i18n:** locale strings shipped as Inertia props (`t` prop = `trans('dashboard')` etc.); `LocaleSync` component + `SetLocale` middleware; Arabic drives RTL.
- **Build:** Vite 8 with React Compiler, Tailwind 4 Oxide plugin, Wayfinder plugin; SSR build available (`build:ssr`).

---

## 11. Configuration & Environment

### Key env variables (`.env.example`)

| Var | Purpose |
|-----|---------|
| `APP_NAME`, `APP_URL`, `APP_ENV`, `APP_DEBUG`, `APP_KEY`, `APP_LOCALE` | Standard Laravel app config |
| `VITE_APP_NAME` | Frontend title |
| `DB_CONNECTION` / `DB_HOST` / `DB_PORT` / `DB_DATABASE` / `DB_USERNAME` / `DB_PASSWORD` | Database (mysql or sqlite) |
| `EXCHANGE_RATES_BASE_URL` | Default FX API base (`https://open.er-api.com/v6/latest/`) |
| `SESSION_DRIVER`, `QUEUE_CONNECTION`, `CACHE_STORE` | Infra (DB-backed suitable for shared hosting) |

### Config files of note

- `config/locales.php` — supported locales (en, bn, es, fr, ar).
- `config/services.php` — `exchange_rates.base_url`.
- `config/database_backup.php` — restore enable flag, binary discovery.
- `config/fortify.php` — enabled auth features (email verification, 2FA).
- `config/inertia.php`, `config/session.php`, `config/queue.php`, `config/cache.php`.

### FX API URL templating (`ExchangeRateService`)

Supports `{base}` / `{key}` placeholders, and heuristics for `exchangerate-api.com/v6` and `open.er-api.com` shapes. Parses both `rates` and `conversion_rates` response formats. Results cached 15 minutes keyed by from/to/url/key.

---

## 12. Installation & Deployment

### Local development

```bash
composer setup      # install, .env, key:generate, migrate, npm install, npm build
composer dev        # concurrently: php serve + queue:listen + vite
```

### Production (shared cPanel — per README)

1. Create MySQL DB + user (ALL PRIVILEGES).
2. Deploy via cPanel **Git Version Control** (requires `cpanel.yml` in repo root) or ZIP upload outside `public_html`.
3. Point domain document root at `public/`.
4. `composer install --no-dev --optimize-autoloader`.
5. `npm ci && npm run build` (or commit prebuilt `public/build`).
6. `php artisan migrate --force` + `config:cache route:cache view:cache event:cache`.
7. `php artisan storage:link`; ensure `storage/` and `bootstrap/cache/` writable.
8. Optional: cron `* * * * * php artisan schedule:run`.
9. First-run browser installer at `/install`.

### Quality tooling

```bash
composer lint          # Pint format
composer lint:check    # Pint --test
composer test          # config:clear + pint --test + artisan test
npm run lint / format / types:check
```

---

## 13. Testing

- **Framework:** Pest 4 (`pestphp/pest`, `pest-plugin-laravel`), Mockery, Faker.
- **13 feature tests** under `tests/Feature`, covering:
  - Auth: authentication, registration, email verification, verification notification, password confirmation, two-factor challenge.
  - Dashboard rendering.
  - Settings: profile update, database backup.
- **Gaps:** no dedicated tests found for the ledger sync engine, settlements accounting, multi-currency derivation, cash-balance guards, or the shared-catalog authorization matrix — these are the highest-value areas to cover (see recommendations).

---

## 14. Observations, Risks & Recommendations

### Strengths

- Clean separation of accounting logic into `TransactionLedgerSync` + `Support/*` helpers.
- Careful dual-currency completeness handling (suppresses misleading partial totals).
- Defensive migrations (idempotent guards, driver-specific SQL, backfills) suited to messy shared-hosting re-runs.
- Solid authorization discipline (per-row ownership checks, role hierarchy, throttling on sensitive routes).
- Type-safe frontend routing via Wayfinder; modern React 19 + Tailwind 4 stack.

### Risks / technical debt

1. **Denormalized `settled_amount`** on `transactions` duplicates the source-of-truth `Σ settlements`. It is recomputed in places but any path that mutates settlements without recompute can drift. Consider always deriving via `withSum` (as `index()` already does) and dropping the column, or centralizing recompute.
2. **Dual contact linkage** — both legacy `transactions.contact_id` (kept null on new writes) and the `contact_transaction` pivot exist. Plan a migration to fully retire the legacy column.
3. **Fat controllers** — `TransactionController` (~756 LOC) and `DashboardController` (~412 LOC) carry substantial business/aggregation logic. Extract dashboard aggregation into a dedicated service/query object; share the near-identical `store`/`update` logic in `TransactionController` via a Form Request + action.
4. **Cash-balance guard is global, not date-aware** — guards use current net cash, so back-dated expenses/receivables can pass/fail counter-intuitively relative to `occurred_on`. Confirm this is intended.
5. **Row limits** — `index()` caps at 600 transactions + 600 settlements and ledger at 1000 with no pagination UI signalled; long-lived accounts will silently truncate. Add pagination or windowing.
6. **FX secondary derivation via ratio** can accumulate rounding differences between the stored `secondary_amount` and settlement-derived secondary values.
7. **Test coverage** of the financial core is thin. Prioritize Pest tests for: ledger sync correctness across all 4 types + settlements, multi-currency derivation, cash guards, and `SharedCatalog` authorization.
8. **`ExchangeRateSetting` is a global singleton** while `users` still carries legacy `exchange_rate_api_url/key` columns — dead columns to clean up.

### Suggested next steps (prioritized)

1. Add a `LedgerSyncTest` and `SettlementTest` Pest suite (accounting invariants: sum of ledger credits−debits == cash balance; settled never exceeds total).
2. Introduce Form Requests for transaction create/update to dedupe validation.
3. Add server-side pagination to transactions & ledger.
4. Decide on `settled_amount` denormalization strategy (derive vs. maintain) and enforce it consistently.
5. Retire legacy `contact_id` and dead `users.exchange_rate_api_*` columns.

---

*End of documentation.*
