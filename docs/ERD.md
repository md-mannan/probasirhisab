# Probasirhisab — Entity Relationship Diagram (ERD)

This document describes the relational schema as implemented in `database/migrations/`.
The Mermaid source is also available standalone at [`diagrams/erd.mmd`](diagrams/erd.mmd).

## Overview

The data model is **user-owned**: every domain row carries a `user_id` and cascades on
user deletion. The financial core is `transactions` → `transaction_settlements` →
`ledger_entries`, where the ledger is the derived source of truth for cash balance.

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
        string exchange_rate_api_url "legacy"
        string exchange_rate_api_key "legacy"
        string password
        string role "super_admin|admin|user"
        text two_factor_secret
        text two_factor_recovery_codes
        timestamp two_factor_confirmed_at
        json dashboard_tile_order
        string avatar_path
        timestamps created_updated
    }

    CATEGORIES {
        bigint id PK
        bigint user_id FK
        string name
        string type "income|expense|payable|receivable|settle_payable|settle_receivable"
        timestamps created_updated
    }

    CONTACTS {
        bigint id PK
        bigint user_id FK
        string name
        timestamps created_updated
    }

    TRANSACTIONS {
        bigint id PK
        bigint user_id FK
        bigint category_id FK "nullable"
        bigint contact_id FK "nullable, legacy"
        string type "income|expense|payable|receivable"
        decimal amount "18,3"
        decimal secondary_amount "18,3 nullable"
        decimal settled_amount "18,3 nullable"
        string currency "3"
        string secondary_currency "3 nullable"
        decimal rate "18,8 nullable"
        date occurred_on
        int sort_order "nullable"
        text note
        string source
        timestamps created_updated
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
        timestamps created_updated
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
        timestamps created_updated
    }

    CONTACT_TRANSACTION {
        bigint id PK
        bigint user_id FK
        bigint contact_id FK
        bigint transaction_id FK
        timestamps created_updated
    }

    EXCHANGE_RATE_SETTINGS {
        bigint id PK
        string exchange_rate_api_url "2048"
        string exchange_rate_api_key "255"
        timestamps created_updated
    }
```

## Tables in detail

### `users`
Account holder and owner of all data. Notable columns beyond the Laravel default:
`role` (enum-backed string), `primary_currency`/`secondary_currency`, `locale`,
`dashboard_tile_order` (JSON), `avatar_path`, and Fortify 2FA columns. The legacy
`exchange_rate_api_url/key` columns are superseded by the global `exchange_rate_settings`
table and can be retired.

### `categories`
Per-user labels with a `type`. `UNIQUE(user_id, type, name)` prevents duplicates;
`INDEX(user_id, type)` supports the grouped-by-type reads used throughout the app.

### `contacts`
"People" the user transacts with. `INDEX(user_id, name)`.

### `transactions`
Central record. Dual currency via `amount`/`currency` (primary) and optional
`secondary_amount`/`secondary_currency`/`rate`. `settled_amount` is a **denormalized cache**
of the settlement sum (source of truth is `Σ transaction_settlements.amount`). `sort_order`
drives manual drag ordering. Indexes: `(user_id, type, occurred_on)`,
`(user_id, contact_id, occurred_on)`, `(user_id, sort_order, id)`,
`transactions_user_occurred_id_idx(user_id, occurred_on, id)`.

### `transaction_settlements`
Payments against a payable/receivable. `category_id` references a `settle_*` category.
Indexes: `(transaction_id, paid_on)`, `ts_user_paid_on_idx(user_id, paid_on)`,
`(user_id, sort_order)`.

### `ledger_entries`
Projected debit/credit lines maintained by `TransactionLedgerSync`. One base line per
transaction (`settlement_id = NULL`) plus one line per settlement.
`UNIQUE(transaction_id, settlement_id)` (relaxed from the original `UNIQUE(transaction_id)`
in migration `2026_05_01_000007`). `INDEX(user_id, occurred_on, id)`.

### `contact_transaction`
Many-to-many pivot between contacts and transactions.
`UNIQUE(contact_id, transaction_id)` + `(user_id, contact_id)` + `(user_id, transaction_id)`.

### `exchange_rate_settings`
Single global row (managed via `ExchangeRateSetting::the()`) holding the FX API URL/key
used for rate previews.

## Referential integrity

| Child | Parent | On delete |
|-------|--------|-----------|
| categories.user_id | users.id | cascade |
| contacts.user_id | users.id | cascade |
| transactions.user_id | users.id | cascade |
| transactions.category_id | categories.id | set null |
| transactions.contact_id (legacy) | contacts.id | set null |
| transaction_settlements.transaction_id | transactions.id | cascade |
| transaction_settlements.user_id | users.id | cascade |
| transaction_settlements.category_id | categories.id | set null |
| ledger_entries.user_id | users.id | cascade |
| ledger_entries.transaction_id | transactions.id | cascade |
| ledger_entries.settlement_id | transaction_settlements.id | cascade |
| contact_transaction.* | users/contacts/transactions | cascade |

In addition to DB cascades, `Transaction::booted()` deletes dependent `ledger_entries` on
model deletion, and `User::booted()` removes the avatar file from storage.

## System / framework tables

`password_reset_tokens`, `sessions`, `cache`, `cache_locks`, `jobs`, `job_batches`,
`failed_jobs` — created by the default Laravel migrations for auth, cache, and queue infra.
