# Data Layer Spec

> Part of a three-layer architecture. Dependency direction points **downward**:
>
> ```
> Presentation  ──depends on──▶  Application  ──depends on──▶  Data (this doc)
>       (React/UI)                (use cases,               (persistence &
>                                  view models)              retrieval)
> ```
>
> All three layers share the **domain model** (`BaseNode`, `Block`, node `type`s) defined in
> [`knowledge-base-spec.md`](./knowledge-base-spec.md). This layer is the concrete realization of
> its §12 "storage seam".

The data layer is the **only** place that knows *where knowledge is stored and how it's fetched* —
files today, a database/API later. Everything above it depends on an interface, never on storage.

---

## 1. Responsibilities

**Does:**
- Persist and retrieve nodes and their derived indexes.
- Expose one storage-agnostic async interface: `KnowledgeRepository`.
- Own the **build step** that generates `index.json` and the derived indexes (backlinks,
  hierarchy) for the static implementation.

**Does not:**
- Assemble view models, resolve `[[wiki-links]]` to titles, or build breadcrumbs — that's the
  Application layer.
- Know anything about React, routing, or rendering.
- Contain domain *policy* beyond what's needed to store/derive (e.g. "one parent max" is validated
  at build time here, but *how a tree is displayed* is not this layer's concern).

---

## 2. The contract: `KnowledgeRepository`

The single seam. Implementations are swappable; call sites never change.

```typescript
interface NodeSummary {
  id: string;
  type: BaseNode["type"];
  title: string;
  tags: string[];
  // NOTE: no `folder` — folders are a storage-only concern (knowledge-base-spec §8).
}

interface KnowledgeRepository {
  // --- reads ---
  getIndex(): Promise<NodeSummary[]>;              // all summaries, for sidebar/search
  getNode(id: string): Promise<BaseNode | null>;   // full node incl. body
  getNodes(ids: string[]): Promise<BaseNode[]>;    // batch fetch (skips missing)

  getBacklinks(id: string): Promise<string[]>;     // ids linking here (via [[wiki-links]] + links[])
  getChildren(id: string): Promise<string[]>;      // ordered child ids (from child-page blocks)
  getParent(id: string): Promise<string | null>;   // single parent id, or null for roots

  search(query: string): Promise<NodeSummary[]>;   // title/tag/body match; impl-defined ranking

  // --- writes: throw ReadOnlyError in the static impl; a DB/API impl fills them in ---
  saveNode(node: BaseNode): Promise<void>;
  deleteNode(id: string): Promise<void>;
}
```

### Design rules

- **Async everywhere**, even where the file impl could be synchronous — moving to network/DB then
  never changes a call site.
- **Returns domain entities and primitives** (`BaseNode`, `NodeSummary`, id arrays) — *not* view
  models. No `[[wiki-link]]` resolution, no assembled trees.
- **Write methods exist from day one.** The static impl throws a typed `ReadOnlyError`; the UI is
  built against them so a future DB impl is a drop-in. This is what makes "turn it into a real web
  app" a localized change.
- **IDs are GUIDs read from file contents, not paths/filenames** (see knowledge-base-spec §8) — a
  node keeps its identity and all inbound links regardless of its filename or folder. References
  (`links[]`, `child-page.nodeId`, `[[wiki-links]]`) are stored as GUIDs, so they're rename-safe and
  become ready-made foreign keys in a DB.

---

## 3. Implementations

### 3.1 `StaticFileRepository` (now)

Backed by JSON files served from `/data` on GitHub Pages.

- `getIndex()` — fetches the generated `index.json` once, caches in memory.
- `getNode(id)` — lazy-fetches `nodes/<guid>.json` (the build emits one normalized copy per node,
  keyed by GUID) on demand; caches fetched nodes.
- `getBacklinks` / `getChildren` / `getParent` — served from build-generated derived indexes
  (`derived/*.json`), not computed at runtime.
- `search(query)` — client-side over the in-memory index (title + tags now; add a prebuilt
  body/text index later if needed).
- writes — throw `ReadOnlyError`.

### 3.2 `InMemoryRepository` (tests / fixtures)

Takes an array of `BaseNode`s, derives all indexes in the constructor, implements the full
interface **including writes**. Lets the Application and Presentation layers be tested with no
files and no network.

### 3.3 `ApiRepository` / `DbRepository` (later)

Same interface, backed by an HTTP API over a real database. Writes become real. Because the schema
was chosen to port cleanly (see §5), this is a new implementation, not a rewrite.

The Application/Presentation layers depend on the **interface**; which implementation is
instantiated is a single composition-root decision (e.g. an env flag).

---

## 4. The build step (static implementation only)

A Node script run at build/commit time. It is the static analogue of what a DB does with indexes
and constraints.

**Inputs:** the authored `data/nodes/**/*.json` files (globbed recursively; **the subdirectory path
is discarded** — folders are a source-file arrangement only, §8).

**Outputs (generated into `public/data/`):**
- `index.json` — `NodeSummary[]`.
- `derived/backlinks.json` — `{ [id]: string[] }`.
- `derived/hierarchy.json` — `{ [id]: { parent: string | null; children: string[] } }`.
- `nodes/<guid>.json` — one normalized copy per node, keyed by GUID (what `getNode` fetches).

**What it computes:**
- **Backlinks** = scan every block's text for `[[<guid>|…]]` wiki-links plus each node's `links[]`;
  invert to `id → [ids linking here]`.
- **Hierarchy** = scan every `child-page` block; build `parent`/ordered-`children`.

**What it validates (fails the build):**
- Duplicate `id`s across files.
- A node used as `child-page` in **more than one** parent (one-parent rule).
- **Cycles** in the child-page tree.
- Dangling references (optional: warn on `[[id]]`/`child-page` to a non-existent id).

Keeping derivation + validation in one build step means the runtime repository is a thin reader,
and the same validations map directly onto DB constraints/queries later.

---

## 5. Why the model ports cleanly to a DB

The schema was chosen so the swap is mechanical (see also `knowledge-base-spec.md` §12):

| Static (files)                          | Database                                             |
|-----------------------------------------|------------------------------------------------------|
| One JSON file per node                  | Row in a `nodes` table                               |
| GUID `id` from file contents            | `id` primary key (GUID); references = foreign keys   |
| `body` block list (JSON)                | `JSONB`/JSON column (indexable in Postgres)          |
| `backlinks.json` (derived)              | Query over a `links` edges table / FTS               |
| `hierarchy.json` (derived)              | `(parent_id, child_id, order)` edges table           |
| Build-time validations                  | Constraints + queries                                |
| `ReadOnlyError` writes                  | Real `INSERT`/`UPDATE`/`DELETE`                       |

---

## 6. Errors & edge cases

- `getNode` on a missing id → `null` (not an error).
- Writes in read-only impl → typed `ReadOnlyError` (so the UI can disable/hide edit affordances by
  catching or by capability-checking).
- Build validation failures → non-zero exit with a clear message (never ship a corrupt index).
- Optional lightweight schema validation of node files at build (e.g. zod) to catch hand-authoring
  mistakes early.

---

## 7. Testing

- `InMemoryRepository` (§3.2) as the substitute in all Application/Presentation tests.
- Build-step unit tests: backlink inversion, hierarchy ordering, one-parent + cycle rejection.
- A contract test suite runnable against **any** `KnowledgeRepository` implementation, so
  `StaticFileRepository` and a future `DbRepository` are verified against identical behavior.
