# Project Peanuts — Spec

A personal knowledge base: JSON-stored, block-structured notes rendered as a static SPA (GitHub
Pages), designed so the data layer can later be swapped for a database and turned into a full web
app.

## Documents

| Doc | Scope |
|-----|-------|
| [`knowledge-base-spec.md`](./knowledge-base-spec.md) | **The domain model** — nodes, blocks, tables, linking, hierarchy (`child-page`), types. Shared by all layers. (Folders are storage-only, not in the model.) |
| [`data-layer-spec.md`](./data-layer-spec.md) | Persistence & retrieval — the `KnowledgeRepository` contract, static-file impl, build step, DB portability. |
| [`application-layer-spec.md`](./application-layer-spec.md) | The middle seam — use-case services, view models, content parsing, caching. Framework-agnostic. |
| [`presentation-layer-spec.md`](./presentation-layer-spec.md) | React SPA — components, block-render registry, routing, states. |
| [`tech-stack-spec.md`](./tech-stack-spec.md) | Concrete tooling per layer — framework, build, testing, hosting, repo layout. |

## Architecture at a glance

```
┌─────────────────────────────────────────────────────────┐
│ Presentation   React components, routing, block registry │
│                depends ▼ only on Application              │
├─────────────────────────────────────────────────────────┤
│ Application    services + view models + content parsing  │
│                depends ▼ only on the Data interface       │
├─────────────────────────────────────────────────────────┤
│ Data           KnowledgeRepository (files now, DB later) │
└─────────────────────────────────────────────────────────┘
        shared domain model  ◄── knowledge-base-spec.md ──►
        (BaseNode, Block, types) flows through all three
```

Dependencies point **downward**; the domain model is shared by all. Swapping storage touches only
Data; swapping/adding a UI touches only Presentation.
