# Project Peanuts — Knowledge Base Spec

A personal knowledge base. Everything is stored as **JSON files** (one file per note) so it
can be rendered as either an SSG or a SPA and hosted for free on GitHub Pages — no backend.

The guiding principle: **maximum flexibility with a consistent base**, so that different kinds
of knowledge can still be linked, tagged, and searched uniformly (Obsidian-style connections).

---

> **⚠ Layout superseded by [`layout-spec.md`](./layout-spec.md).** Sections describing a *linear*
> `document` body (an ordered `Block[]`) and the `child-page` **block** are out of date: the page
> body is now always a **grid** (`body.kind: "grid"`, `mode: "grid" | "stack"`), items are grid
> cells holding a block *or* a `node` reference, and the hierarchy edge is a `node` grid item (not a
> `child-page` block). Blocks, linking, tags, types, IDs, folders, and the data/DB story below are
> all still current. This doc will be merged into the grid model on the next pass.

## 1. Core idea

Every piece of knowledge is a **Node**. A Node has:

- `type` — the **semantic** category (*what kind of knowledge is this*: tidbit, guide, concept…).
- `body` — the content, which for essentially everything is a **document: an ordered list of
  blocks**.

The single most important structural decision: **content is always blocks, and everything that
isn't plain prose (tables, files, images, checklists, bookmarks) is a *block type*, not a separate
body.** A "table note" is just a document whose content happens to be one table block; a "saved
webpage" is a document containing a bookmark block. This means **any node can freely mix prose, a
table, an image, and a file in any order** — you're never boxed into a single-purpose shape, and
you can always add explanatory notes around any artifact.

`body` stays a discriminated union on `body.kind` purely as an **extension point** for future
*non-linear* layouts (e.g. a free-form `canvas`) that genuinely can't be expressed as a linear
block list. For now there is exactly one body kind — `document` — and the renderer's main job is
to walk `content` and render each block.

The sidebar, tag filter, search index, and backlink graph all operate on the shared `BaseNode`
fields and never care about the body's contents.

---

## 2. Base schema (TypeScript)

```typescript
// Shared by every single node, no exceptions
interface BaseNode {
  id: string;
  type: "tidbit" | "doc-summary" | "guide" | "concept" | "reference" | "resource" | "other";
  title: string;
  tags: string[];
  links: string[];        // explicit outbound links (IDs), on top of any [[wiki-links]] in content
  created: string;        // ISO 8601
  updated: string;        // ISO 8601
  source?: string;
  archived?: boolean;     // soft-delete / deprecate without losing history
  body: NodeBody;         // discriminated union on body.kind — see §1 (only "document" for now)
}

// The extension point for future non-linear layouts (e.g. canvas).
// Today there is exactly one variant.
type NodeBody = DocumentBody;

interface DocumentBody {
  kind: "document";
  content: Block[];       // the universal content model — see §3 for block types
}
```

All content shapes — tables, files, images, checklists, bookmarks — are **block types inside
`content`**, defined in §3. There are no per-artifact bodies.

### Table column typing

```typescript
interface TableColumn {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "checkbox" | "tag" | "link";
}
```

Column typing is worth adding now — it's nearly free and expensive to retrofit. It gives free
sorting/filtering later: numbers sort numerically, dates chronologically, checkboxes render as
checkboxes, etc.

**Rows are objects keyed by column `id`, not positional arrays.** Reordering or adding columns
then never breaks existing rows.

---

## 3. Blocks (inside `DocumentBody.content`)

Everything a node can contain is a block. Prose blocks (paragraph/heading/…) and **artifact
blocks** (table/file/image/checklist/bookmark) sit side by side, so a single note can interleave
them freely.

```typescript
type Block =
  // --- prose ---
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "code"; language: string; text: string }
  | { type: "list"; style: "bullet" | "numbered"; items: string[] }
  | { type: "quote"; text: string }
  | { type: "callout"; style: "info" | "warning" | "success"; text: string }
  | { type: "divider" }
  // --- artifacts (previously bodies; now first-class blocks) ---
  | { type: "table"; columns: TableColumn[]; rows: Record<string, string | number | boolean>[] }
  | { type: "image"; path: string; caption?: string; alt?: string }
  | { type: "file"; filename: string; path: string; mimeType: string; size?: number }
  | { type: "checklist"; items: { text: string; checked: boolean }[] }
  | { type: "bookmark"; url: string; title?: string; note?: string; excerpt?: string; favicon?: string }
  // --- references to other nodes ---
  | { type: "child-page"; nodeId: string };   // a nested child page, inline; see §5 Hierarchy
```

The `child-page` block is special: besides rendering an inline navigable card for `nodeId`, its
**position in `content` defines that child's order**, and its presence is what makes `nodeId` a
child of this node. It's the only block that carries structural (tree) meaning — everything else
is pure content. See §5.

Because these are all just blocks, a "standalone table/file/image/bookmark" is simply a document
whose `content` is a single block of that type — no special-casing. The renderer has **one** path:
walk `content`, render each block by its `type`.

### Saving a webpage link with a description

The common **resource** case ("I found a good page and want to remember it plus why") is a node
with `type: "resource"` whose content contains a **`bookmark` block** — `url` is the link, `note`
is your description. And because it's just a block, you can add paragraphs of your own thoughts
around it in the same note. So **a link-with-description works out of the box**.

```json
{
  "id": "resource-vector-clocks-explained",
  "type": "resource",
  "title": "Vector Clocks, explained",
  "tags": ["distributed-systems"],
  "links": ["concept-cap-theorem"],
  "created": "2026-07-01T09:00:00Z",
  "updated": "2026-07-01T09:00:00Z",
  "body": {
    "kind": "document",
    "content": [
      {
        "type": "bookmark",
        "url": "https://example.com/vector-clocks",
        "note": "Best plain-English explanation I've found; the diagrams make ordering click.",
        "excerpt": "A vector clock is a list of logical clocks, one per node..."
      },
      { "type": "paragraph", "text": "Ties back to [[concept-cap-theorem]] — ordering without a global clock." }
    ]
  }
}
```

Two other ways a link can show up, depending on scope — all three coexist:

- **A whole resource note** → a `bookmark` block (above). Linkable, taggable, has your notes.
- **An inline link inside prose** → markdown-lite `[text](https://…)` inside a block's `text`
  (rendered as a normal hyperlink), for when a URL is just a passing mention in a paragraph.
- **An external `source`** → the base `source?` field, for citing where a note's info came from
  without making the link the point of the note.

### Inline text — the pragmatic choice

Block `text` is a **plain string** using "markdown-lite" inline syntax parsed at render time:

- `**bold**`, `*italic*`, `` `code` ``
- `[[wiki-link]]` and `[[wiki-link|display text]]` — internal links to other nodes
- `[text](https://…)` — external hyperlinks inline in prose

This gives ~90% of the value of block-based content (structure, per-block rendering, easy
programmatic access to code/lists/tables) without making every note tedious to hand-author as
JSON. A fully-structured span model (array of `{text, marks}`) is deferred — block boundaries stay
the same either way, so migration later is cheap.

### Deferred blocks (add when missed)

`math` (KaTeX), `embed`/transclude another node (`{ type: "embed", nodeId }`),
`toggle`/`details` (collapsible). (A free-form `canvas` is *not* a block — it's a future
`body.kind`, since it isn't a linear list of blocks.)

---

## 4. Linking (Obsidian-style)

Two mechanisms, both used:

- **Explicit** `links: string[]` — outbound node IDs. Easy to parse.
- **Inline** `[[wiki-links]]` inside block text — natural to write.

At load/build time, walk every node's content, extract all `[[id]]` references (a regex over
`text` fields — no markdown parser needed since content is already structured), and compute a
**backlinks index**: `id → [ids that link to it]`. This gives the graph view for free later.

Linking here is **associative** (a web of related notes) and has nothing to do with the
**hierarchy** in §5 — a node can be linked from anywhere while still having exactly one place in
the tree.

---

## 5. Hierarchy (parent / children)

> **Updated by [`layout-spec.md`](./layout-spec.md) §6:** the hierarchy edge is now a **`node` grid
> item**, not a `child-page` block. Everything below about *derived parent/children, one-parent,
> roots, and cycles* still holds verbatim — only the mechanism that declares an edge changed
> (a `node` cell instead of a `child-page` block). Order is reading order of the grid.

Nodes form a **tree** (Notion-style), but the tree is not stored as fields on the node — it is
expressed **inline** and **derived**.

A node becomes the child of another node by the parent's `content` containing a **`child-page`
block** that points at it. That single fact carries three things at once:

- **Membership** — `nodeId` is a child of the node whose content holds the block.
- **Order** — the child's position among its siblings is just where the `child-page` block sits in
  `content` (mixed freely with prose, images, etc. — order is implicit in the document, not a
  separate list).
- **Placement** — the child renders as an inline navigable card exactly at that spot.

Nothing about the child's own file changes when it's placed. It's referenced by **id only**, never
embedded — so the child stays a normal top-level node with its own file, tags, links, and
backlinks, and moving it in the tree is just moving one block.

This tree is also completely independent of **folders** (§8): folders are only how source files
are arranged on disk and don't exist in the runtime model at all, so they have no effect on
parent/child.

### Rules (enforced by the build step)

- **One parent max.** A given `nodeId` may appear as a `child-page` block in at most one node. If
  it appears in more than one, that's an authoring error (the build fails / warns and picks the
  first). This mirrors Notion: a page has exactly one parent.
- **Roots** are nodes not referenced by any `child-page` block anywhere.
- **No cycles.** The build step walks the tree and rejects any cycle.

### Derived, not stored

The build step scans all `child-page` blocks and produces, per node, a derived `parent` (id or
`null`) and an ordered `children: string[]`. These land in `index.json` so the sidebar tree and
breadcrumbs are instant without opening files. Because the block is the single source of truth,
`parent`/`children` can never drift out of sync.

> Deliberately *not* adding `parent`/`order`/`children` fields to `BaseNode`. If self-contained
> child files ever become desirable (e.g. a different data layer — see §12), a stored `parent`
> field can be added as a derived-from-blocks mirror, but the `child-page` block stays the source
> of truth so there's still only one place ordering lives.

---

## 6. Tags vs types

Kept separate:

- `type` = structural/semantic category (how it's organized).
- `tags` = freeform, many-to-many (what it's about).

Tags stay **loose** — not hierarchical, not strict. A "merge tags" tool can come later once real
usage patterns emerge.

---

## 7. Type values (semantic categories)

Start with a subset; add more as "other" gets overused.

| type          | purpose                                                                 |
|---------------|-------------------------------------------------------------------------|
| `tidbit`      | quick notes, one-off facts, TIL-style. Low ceremony.                    |
| `doc-summary` | condensed external documentation. (`source`, source version).           |
| `guide`       | a how-to you wrote yourself; longer, step-based.                        |
| `concept`     | explains an idea/term — personal glossary/wiki atomic note. Linked most.|
| `reference`   | dense lookup material (cheat sheets, API tables) — for scanning.        |
| `resource`    | a link/book/video/course + your notes on it.                           |
| `other`       | catch-all escape hatch.                                                 |

**Day-one set:** `tidbit`, `doc-summary`, `guide`, `concept`. Add the rest on demand.

Deferred type ideas: `snippet` (copy-paste code), `decision` (ADR — "why X over Y"),
`person`/`contact`, `project` (a hub node — falls out of `links` naturally), `book`/`reading`
(author, progress, rating). Most need no new machinery — just new values in the `type` enum.

---

## 8. File layout

Authoring source (`data/nodes/**`) may be arranged in any subdirectories you like. The build step
globs them recursively and emits a flat, GUID-keyed runtime set:

```
/data                               # authoring SOURCE (human-arranged)
  /nodes
    inbox-note.json
    work/db/cap-theorem.json        # subdirs are just for YOUR convenience
    reading/vector-clocks.json
  /files
    raft-paper.pdf                  <- binary attachments referenced by file/image blocks

/public/data                        # GENERATED runtime set (fetched by the app)
  index.json                        <- [{ id, type, title, tags }, ...]  (no folder)
  derived/backlinks.json
  derived/hierarchy.json
  nodes/<guid>.json                 <- one normalized copy per node, keyed by GUID
```

- **One JSON file per node** in source — clean git diffs, easy to add notes by hand.
- **`index.json` is generated at build time** — a lightweight array of `{ id, type, title, tags }`
  for every node, so the app builds the sidebar/search instantly without fetching every full node
  file. Full node content is loaded on demand (by GUID) when a note is opened.
- Binary files live in `/data/files/` (or external URLs if large — GitHub repos get uncomfortable
  past ~1GB).

### Folders are a storage concern only

The subdirectories under `data/nodes/` are **purely how you arrange source files on disk** — nothing
more. They have **no representation in the runtime model** and no bearing on any other layer:

- **Not** part of `id`, `links`, `[[wiki-links]]`, backlinks, the `child-page` hierarchy (§5), the
  domain model, `NodeSummary`, the repository interface, the app layer, or the UI.
- The build step globs `data/nodes/**` recursively and **discards the directory path** — a node's
  identity is its GUID (read from file contents), independent of where the file sits or is moved to.
- There is **no folder browser, no `folder` field, and no folder tree.** The only navigation trees
  are the `child-page` **page tree** (§5) and search/tag filters.

> If folders ever need to be *visible* in the app (a folder-browse pane), that would be a deliberate
> new feature: reintroduce an explicit `folder` field on the node (authored, not path-derived) and
> surface it through the repository. Until then, folders stay invisible above storage.

### ID scheme

**`id` is a GUID/UUID** (e.g. `6f9a1c2e-...`) — a stable, collision-free, rename-safe primary key
that maps directly to a DB primary/foreign key later. It is **read from the file's contents, not
its path or filename** — so a node keeps its identity (and all inbound links) no matter which
folder its file is moved to, or what the file is named.

Consequences of GUIDs (and how they're handled):

- **Filenames stay human-readable.** Since the canonical id lives *inside* the file, the file can be
  named with a readable slug (`concept-cap-theorem.json`) purely for git browsing — the name has no
  meaning to the system. No separate field needed.
- **All references are GUIDs.** `links[]`, `child-page.nodeId`, and `[[wiki-links]]` store the
  target's GUID. Like Notion, this makes links **rename-safe** — retitling a node never breaks
  inbound links, because nothing references it by title.
- **Wiki-links keep a display label so prose stays legible.** The stored inline form is
  `[[<guid>|Display Text]]`; the renderer shows *Display Text* and resolves the GUID to the current
  title/existence. Authoring a link by hand means pasting a GUID — so this is **tool-assisted**: the
  markdown→JSON converter (§10) and any future editor resolve a typed `[[Title]]` into
  `[[<guid>|Title]]` at save time. Raw hand-authoring still works, just less ergonomically.

> This is the deliberate trade of GUIDs: rock-solid identity/rename-safety and a clean DB path, at
> the cost of links being tool-managed rather than hand-typed. If pure hand-authoring of links ever
> matters more than rename-safety, a readable `slug` field could be reintroduced as the reference
> token — but GUID stays the canonical `id`.

---

## 9. Examples

> The `id`s and references below use **readable placeholders** (`concept-cap-theorem`) purely for
> legibility. In real data, every `id` and every reference (`links[]`, `child-page.nodeId`,
> `[[…]]`) is a **GUID** — see §8. A real wiki-link is stored as `[[<guid>|CAP Theorem]]`.

### Document node

```json
{
  "id": "concept-cap-theorem",
  "type": "concept",
  "title": "CAP Theorem",
  "tags": ["distributed-systems", "databases"],
  "links": [],
  "created": "2026-06-30T14:23:01Z",
  "updated": "2026-06-30T14:23:01Z",
  "body": {
    "kind": "document",
    "content": [
      { "type": "paragraph", "text": "You can only pick two of: Consistency, Availability, Partition tolerance." },
      { "type": "paragraph", "text": "See [[table-db-comparison]] for a breakdown of real systems." }
    ]
  }
}
```

### Table node (a document whose content is one table block)

```json
{
  "id": "table-db-comparison",
  "type": "reference",
  "title": "Database Comparison Matrix",
  "tags": ["databases", "distributed-systems"],
  "links": ["concept-cap-theorem"],
  "created": "2026-06-30T15:00:00Z",
  "updated": "2026-06-30T15:00:00Z",
  "body": {
    "kind": "document",
    "content": [
      {
        "type": "table",
        "columns": [
          { "id": "name", "label": "System", "type": "text" },
          { "id": "consistency", "label": "Consistency Model", "type": "tag" },
          { "id": "released", "label": "Released", "type": "date" }
        ],
        "rows": [
          { "name": "PostgreSQL", "consistency": "Strong", "released": "1996-07-08" },
          { "name": "DynamoDB", "consistency": "Eventual", "released": "2012-01-18" }
        ]
      }
    ]
  }
}
```

Both are "just nodes" with the same `id`/`tags`/`links`/dates and the same `document` body. The
detail view never forks on body kind — it walks `content` and renders each block, so the table
above is rendered by the same `<TableBlock>` component whether it's alone or mid-note.

---

## 10. Authoring

Hand-writing full notes as raw JSON blocks is tedious (escaping, no line breaks). Plan:

- **Write in Markdown**, run a one-time **converter script** (`markdown → block JSON`) on save,
  so day-to-day writing stays comfortable while storage stays structured.
- A small in-app block editor (textarea per block) is a later, nicer option.

Start with the converter script.

---

## 11. Hosting (GitHub Pages)

File-based JSON is a static "database" — no backend.

- **SPA**: fetch node JSON files client-side.
- **SSG**: read/glob JSON at build time (Vite / Astro / 11ty) and bundle.

Either way, generate `index.json` at build for fast startup.

---

## 12. Data layer & storage seam

The JSON-files-on-GitHub-Pages setup is the *first* backend, not the only one. The goal is that
switching to **DB-backed storage + a real web app** later touches **one module**, not the UI.

### The seam: a repository interface

The UI never fetches files, knows paths, or parses JSON. It depends only on a small async
interface. The static-file version is one implementation; a DB/API version is another with the
same signatures.

```typescript
interface KnowledgeRepository {
  // reads
  getIndex(): Promise<NodeSummary[]>;             // {id, type, title, tags} for sidebar/search
  getNode(id: string): Promise<BaseNode | null>;  // full node with body
  getBacklinks(id: string): Promise<string[]>;    // ids linking here (via [[wiki-links]]/links)
  getChildren(id: string): Promise<string[]>;     // ordered child ids (from child-page blocks)
  getParent(id: string): Promise<string | null>;
  search(query: string): Promise<NodeSummary[]>;

  // writes — throw "read-only" in the static impl; a DB impl fills them in
  saveNode(node: BaseNode): Promise<void>;
  deleteNode(id: string): Promise<void>;
}
```

- **Async from day one**, even though the file version *could* be synchronous — so moving to
  network/DB never changes a single call site.
- **Write methods exist now** and just throw `read-only` in the static implementation. The UI can
  be built against them; the DB implementation later makes them real. (This is what makes "turn it
  into an actual web application" a drop-in.)
- Only the repository implementation knows about `/data/*.json`, `fetch`, or (later) SQL/HTTP.

### First implementation

`StaticFileRepository` — loads `index.json` once, lazy-fetches `/data/nodes/{id}.json` on demand,
and serves `getBacklinks`/`getChildren`/`getParent` from the build-generated derived indexes.

### Why the schema already ports cleanly to a DB

The model was chosen so the swap is mechanical, not a rewrite:

- **Domain types are pure, JSON-serializable data** (`BaseNode`, `Block`) with no file/transport
  concerns baked in — they map straight to rows or documents.
- **GUID `id`s** are stable **primary keys** (and references are ready-made foreign keys).
- **`body` is a JSON block list** → a single `JSONB`/JSON column on a `nodes` table (no brittle
  per-block-type table sprawl). Postgres can even index/query into it.
- **Derived indexes** (backlinks, children/tree, search) are *computed*, not authored — a build
  step today, SQL queries / an edges table / full-text search tomorrow. The interface hides which.
- **`child-page` blocks** normalize to a `(parent_id, child_id, order)` edges table if wanted,
  while staying inside the body JSON for the static version.
- **Folders** don't appear here at all — they're a source-file arrangement discarded at build time
  and never enter the model or the DB (see §8).

### Rule of thumb

Anything that says "read a file" or "know a path" lives **only** behind `KnowledgeRepository`.
Components, views, and routing depend on the interface and the domain types — never on storage.

---

## 13. Build order (recommendation)

**Now:**
- Base schema: `type` + a single `document` body (`body.kind` kept as a future extension point).
- Blocks: paragraph, heading, code, list, quote, callout, divider, table, image, file, checklist,
  bookmark.
- GUID IDs (read from file contents), `index.json` generation, `[[wiki-link]]` + backlinks
  extraction (references resolved by GUID).
- Derived hierarchy: parse `child-page` blocks → parent/ordered-children indexes (one-parent +
  cycle checks).
- `KnowledgeRepository` interface + `StaticFileRepository` — the data-layer seam (§12).
- Markdown → block-JSON converter.
- SPA: sidebar (page tree) + type/tag filters + block-walking document view + backlinks panel —
  all depending on the repository interface, never on files directly. (No folder UI — folders are
  storage-only, §8.)

**Later (bolt on, no migration needed):**
- Body kinds: `canvas` (the first genuinely non-block body).
- Blocks: `math`, `embed`/transclude, `toggle`/`details`.
- Types: `snippet`, `decision`, `person`, `project`, `book`.
- Fully-structured inline spans (only if an editor UI is built).
- Spaced-repetition / review resurfacing (`priority`, review dates).
- Tag merge tool, graph view.
