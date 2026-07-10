# Probasirhisab — Data Flow Diagrams (DFD)

Three levels of decomposition: context (Level 0), major processes (Level 1), and a
Level 2 explosion of the "Create Transaction" process. Mermaid flow sources are mirrored
under [`diagrams/`](diagrams/).

---

## Level 0 — Context Diagram

The system has two runtime external entities (the **User** browser and the **Exchange-Rate
API**) plus the **host filesystem** touched during installation.

```mermaid
flowchart LR
    User([User / Browser])
    FX([External Exchange-Rate API])
    FS([Host filesystem / cPanel])

    System{{Probasirhisab System<br/>Laravel + Inertia + React}}

    User -->|credentials, transactions,<br/>settlements, settings| System
    System -->|page props, charts,<br/>reports, toasts, exports| User
    System -->|currency pair request| FX
    FX -->|rate JSON| System
    System -->|.env, migrations, logo,<br/>install lock| FS
```

---

## Level 1 — Major Processes & Data Stores

```mermaid
flowchart TB
    User([User])
    FX([Exchange-Rate API])

    subgraph Processes
        P1[1.0 Auth<br/>Fortify]
        P2[2.0 Transaction Mgmt]
        P3[3.0 Ledger Sync]
        P4[4.0 Analytics & Reports]
        P5[5.0 FX Service<br/>15-min cache]
        P6[6.0 Admin & Settings]
        P7[7.0 Installer]
    end

    D1[(D1 users / sessions)]
    D2[(D2 transactions)]
    D3[(D3 contact_transaction)]
    D4[(D4 categories / contacts)]
    D5[(D5 ledger_entries)]
    D6[(D6 transaction_settlements)]
    D7[(D7 exchange_rate_settings)]

    User -->|login / 2FA| P1 --> D1
    User -->|create / edit tx| P2
    P2 <--> D2
    P2 --> D3
    P2 <--> D4
    P2 -->|syncForTransaction| P3 --> D5
    User -->|add settlement| P2 --> D6
    P3 --> D6
    User -->|dashboard / reports| P4
    P4 --- D2
    P4 --- D5
    P4 --- D6
    User -->|FX preview| P5 -->|request| FX
    FX -->|rate| P5
    P5 <--> D7
    User -->|settings / users / backup| P6 <--> D1
    User -->|first-run install| P7
    P7 -->|.env, migrate, lock| D1
```

**Data stores**

| ID | Store | Written by | Read by |
|----|-------|-----------|---------|
| D1 | users / sessions | Auth, Installer, Admin | all authenticated flows |
| D2 | transactions | Transaction Mgmt | Ledger Sync, Analytics |
| D3 | contact_transaction | Transaction Mgmt | Transaction/Contact views |
| D4 | categories / contacts | Category/Contact Mgmt | Transaction Mgmt |
| D5 | ledger_entries | Ledger Sync | Ledger view, cash balance |
| D6 | transaction_settlements | Settlement Mgmt | Ledger Sync, Analytics |
| D7 | exchange_rate_settings | Currency settings | FX Service |

---

## Level 2 — Process 2.0 "Create Transaction"

```mermaid
flowchart TB
    Req[/Request:<br/>type, amounts, rate,<br/>category_id, contact_ids,<br/>occurred_on, note/]
    V{2.1 Validate input}
    D[2.2 Derive missing amount<br/>from rate]
    C{2.3 Resolve & authorize<br/>category}
    CT{2.4 Validate contacts<br/>ownership}
    G{2.5 Cash guard<br/>expense / receivable}
    W[2.6 Create transaction row]
    SO[2.7 Assign sort_order = max+1]
    PV[2.8 Sync contacts pivot]
    LS[2.9 Ledger sync]
    Toast[/Flash toast +<br/>Inertia redirect back/]

    D2[(transactions)]
    D3[(contact_transaction)]
    D5[(ledger_entries)]

    Req --> V
    V -->|fail| Err1[/back with errors/]
    V -->|ok| D --> C
    C -->|invalid| Err2[/back with errors/]
    C -->|ok| CT
    CT -->|invalid| Err3[/back with errors/]
    CT -->|ok| G
    G -->|insufficient cash| Err4[/back with errors/]
    G -->|ok| W --> D2
    W --> SO --> PV --> D3
    PV --> LS --> D5
    LS --> Toast
```

**Guard rules applied in 2.5**

- `expense` and `receivable` require `PrimaryCashBalance ≥ amount` (else validation error).
- On update, the previous outflow is credited back before re-checking available cash.

---

## Level 2 — Process 3.0 "Ledger Sync" (`TransactionLedgerSync`)

```mermaid
flowchart TB
    In[/syncForTransaction(tx)/]
    Base[Upsert base line<br/>keyed on transaction_id, settlement_id=null]
    Rule{tx.type?}
    Cr[credit_primary = amount]
    Db[debit_primary = amount]
    IsObl{payable or<br/>receivable?}
    Del[Delete stray settlement<br/>ledger lines]
    Loop[For each settlement:<br/>upsert line, derive secondary<br/>via ratio]
    Prune[Prune ledger lines for<br/>removed settlements]
    D5[(ledger_entries)]

    In --> Rule
    Rule -->|income / payable| Cr --> Base
    Rule -->|expense / receivable| Db --> Base
    Base --> IsObl
    IsObl -->|no| Del --> D5
    IsObl -->|yes| Prune --> Loop --> D5
```
