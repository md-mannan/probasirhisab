# Probasirhisab — Documentation Index

Engineering documentation for **Probasirhisab** (প্রবাসীর হিসাব — "the expatriate's
accounts"), a self-hostable, multi-currency personal-finance & bookkeeping app built on
Laravel 13 + Inertia + React 19.

## Contents

| Document | What's inside |
|----------|---------------|
| [`../DOCUMENTATION.md`](../DOCUMENTATION.md) | **Master document** — full project & engineer-level overview, stack, architecture, domain logic, security, workflows, risks & recommendations. Start here. |
| [`ERD.md`](ERD.md) | Entity Relationship Diagram + table-by-table schema, constraints, indexes, referential integrity. |
| [`DFD.md`](DFD.md) | Data Flow Diagrams — Level 0 (context), Level 1 (processes/stores), Level 2 (create transaction, ledger sync). |
| [`BLUEPRINT.md`](BLUEPRINT.md) | Build-level map — layers, middleware pipeline, route→controller→service→store wiring, frontend page tree, extension points. |
| [`TESTING.md`](TESTING.md) | Test strategy, the financial-core suites added, and how to run them. |
| [`diagrams/`](diagrams/) | Standalone Mermaid `.mmd` sources for every diagram (render with `mmdc` or any Mermaid viewer). |

## Rendering the diagrams

The `.mmd` files under `diagrams/` are plain Mermaid. To export images:

```bash
npx @mermaid-js/mermaid-cli -i docs/diagrams/erd.mmd -o docs/diagrams/erd.svg
```

GitHub, GitLab, and most Markdown viewers render the embedded ```mermaid``` blocks in the
`.md` files directly — no tooling required.

## Diagram inventory

| File | Diagram |
|------|---------|
| `diagrams/architecture.mmd` | System architecture (browser ↔ Laravel ↔ DB / FX API) |
| `diagrams/erd.mmd` | Entity relationship diagram |
| `diagrams/dfd-level0.mmd` | Context diagram |
| `diagrams/dfd-level1.mmd` | Level-1 processes & data stores |
| `diagrams/dfd-level2-create-transaction.mmd` | Create-transaction explosion |
| `diagrams/sequence-settlement.mmd` | Settlement sequence diagram |
