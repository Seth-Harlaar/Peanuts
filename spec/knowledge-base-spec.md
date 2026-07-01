# Project Peanuts — Knowledge Base Spec

A personal knowledge base. Everything is stored as **JSON files** (one file per note) so it
can be rendered as either an SSG or a SPA and hosted for free on GitHub Pages — no backend.

The guiding principle: **maximum flexibility with a consistent base**, so that different kinds
of knowledge can still be linked, tagged, and searched uniformly (Obsidian-style connections).

---

## 1. Core idea

Every piece of knowledge is a **Node**. A Node has two independent axes:

- `type` — the **semantic** category (*what kind of knowledge is this*: tidbit, guide, concept…).
- `body.kind` — the **structural** shape (*how is the content organized*: a document of blocks,
  a table, a file, an image…).

These are deliberately kept separate. A table is not a different *kind of knowledge* — it's a
note whose *body* happens to be tabular. This is what keeps the model extensible: new content
shapes are new `body.kind` variants, and new knowledge categories are new `type` values, and
neither forces a migration of the other.

The sidebar, tag filter, search index, and backlink graph all operate on the shared `BaseNode`
fields and never care about `body.kind`. Only the **detail view** switches on the body.

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
  status?: "seedling" | "budding" | "evergreen";
  archived?: boolean;     // soft-delete / deprecate without losing history
  body: NodeBody;         // discriminated union on body.kind
}

type NodeBody =
  | DocumentBody
  | TableBody
  | FileBody
  | ImageBody
  | ChecklistBody
  | BookmarkBody;

interface DocumentBody {
  kind: "document";
  content: Block[];
}

interface TableBody {
  kind: "table";
  columns: TableColumn[];
  rows: Record<string, string | number | boolean>[];
}

interface FileBody {
  kind: "file";
  filename: string;
  path: string;           // e.g. /data/files/raft-paper.pdf, or an external URL if large
  mimeType: string;
  size?: number;
}

interface ImageBody {
  kind: "image";
  path: string;
  caption?: string;
  alt?: string;
}

interface ChecklistBody {
  kind: "checklist";
  items: { text: string; checked: boolean }[];
}

interface BookmarkBody {
  kind: "bookmark";
  url: string;            // the webpage / video / resource being saved
  title?: string;         // link's own title if different from the node title (e.g. the page's <title>)
  note?: string;          // your own description / why this is worth remembering
  excerpt?: string;       // an optional quoted snippet pulled from the page itself
  favicon?: string;       // optional icon path/URL for nicer rendering
}
```

### Saving a webpage link with a description

This is the common **resource** case: "I found a good page and want to remember it plus why."
It's a node with `type: "resource"` and `body.kind: "bookmark"` — the `url` is the link and
`note` is your description. So **yes, a link-with-description works out of the box** — you don't
need a separate mechanism for it.

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
    "kind": "bookmark",
    "url": "https://example.com/vector-clocks",
    "note": "Best plain-English explanation I've found; the diagrams make ordering click.",
    "excerpt": "A vector clock is a list of logical clocks, one per node..."
  }
}
```

Two other ways a link can show up, depending on scope — all three coexist:

- **A whole resource note** → `bookmark` body (above). Linkable, taggable, has your notes.
- **An inline link inside prose** → markdown-lite `[text](https://…)` inside a block's `text`
  (rendered as a normal hyperlink), for when a URL is just a passing mention in a paragraph.
- **An external `source`** → the base `source?` field, for citing where a note's info came from
  without making the link the point of the note.

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

```typescript
type Block =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "code"; language: string; text: string }
  | { type: "list"; style: "bullet" | "numbered"; items: string[] }
  | { type: "quote"; text: string }
  | { type: "callout"; style: "info" | "warning" | "success"; text: string }
  | { type: "image"; path: string; caption?: string; alt?: string }
  | { type: "divider" }
  | { type: "table"; columns: TableColumn[]; rows: Record<string, string | number | boolean>[] };
```

Note the `table` block exists **inside** documents too (for a small comparison table embedded in
a regular note). The top-level `TableBody` is for when *the table is the note*. Same shape reused
at two levels — the renderer has one `<TableView>` used in both places.

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
`toggle`/`details` (collapsible), free-form `canvas`.

---

## 4. Linking (Obsidian-style)

Two mechanisms, both used:

- **Explicit** `links: string[]` — outbound node IDs. Easy to parse.
- **Inline** `[[wiki-links]]` inside block text — natural to write.

At load/build time, walk every node's content, extract all `[[id]]` references (a regex over
`text` fields — no markdown parser needed since content is already structured), and compute a
**backlinks index**: `id → [ids that link to it]`. This gives the graph view for free later.

---

## 5. Tags vs types

Kept separate:

- `type` = structural/semantic category (how it's organized).
- `tags` = freeform, many-to-many (what it's about).

Tags stay **loose** — not hierarchical, not strict. A "merge tags" tool can come later once real
usage patterns emerge.

---

## 6. Type values (semantic categories)

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
(author, progress, rating). Most need no new machinery — just new enum values on the document body.

---

## 7. File layout

```
/data
  /nodes
    tidbit-postgres-indexes.json
    concept-cap-theorem.json
    guide-deploying-docker.json
    table-db-comparison.json
  /files
    raft-paper.pdf            <- binary attachments referenced by FileBody/ImageBody
    diagram.png
  index.json                  <- generated: [{ id, type, title, tags, body.kind }, ...]
```

- **One JSON file per node** — clean git diffs, easy to add notes by hand.
- **`index.json` is generated at build time** — a lightweight array of
  `{ id, type, title, tags, body.kind }` for every node, so the app builds the sidebar/search
  instantly without fetching every full node file. Full node content is loaded on demand when a
  note is opened.
- Binary files live in `/data/files/` (or external URLs if large — GitHub repos get uncomfortable
  past ~1GB).

### ID scheme

**Slug-based** (`concept-cap-theorem`), not random UUIDs — human-readable and typeable inside
`[[wiki-links]]` for a personal wiki.

---

## 8. Examples

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
  "status": "budding",
  "body": {
    "kind": "document",
    "content": [
      { "type": "paragraph", "text": "You can only pick two of: Consistency, Availability, Partition tolerance." },
      { "type": "paragraph", "text": "See [[table-db-comparison]] for a breakdown of real systems." }
    ]
  }
}
```

### Table node

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
    "kind": "table",
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
}
```

Both are "just nodes" with the same `id`/`tags`/`links`/dates. Only the detail view switches:
`if (body.kind === "table") <TableView/> else <DocumentView/>`.

---

## 9. Authoring

Hand-writing full notes as raw JSON blocks is tedious (escaping, no line breaks). Plan:

- **Write in Markdown**, run a one-time **converter script** (`markdown → block JSON`) on save,
  so day-to-day writing stays comfortable while storage stays structured.
- A small in-app block editor (textarea per block) is a later, nicer option.

Start with the converter script.

---

## 10. Hosting (GitHub Pages)

File-based JSON is a static "database" — no backend.

- **SPA**: fetch node JSON files client-side.
- **SSG**: read/glob JSON at build time (Vite / Astro / 11ty) and bundle.

Either way, generate `index.json` at build for fast startup.

---

## 11. Build order (recommendation)

**Now:**
- Base schema with `type` + `body` discriminated union.
- Body kinds: `document`, `table`, `file`, `image`, `checklist`, `bookmark`.
- Blocks: paragraph, heading, code, list, quote, callout, image, divider, table.
- Slug IDs, `index.json` generation, `[[wiki-link]]` + backlinks extraction.
- Markdown → block-JSON converter.
- SPA: sidebar + type/tag filters + document/table view + backlinks panel.

**Later (bolt on, no migration needed):**
- Body kinds: `canvas`.
- Blocks: `math`, `embed`/transclude, `toggle`/`details`.
- Types: `snippet`, `decision`, `person`, `project`, `book`.
- Fully-structured inline spans (only if an editor UI is built).
- Spaced-repetition / review resurfacing (`priority`, review dates).
- Tag merge tool, graph view.
