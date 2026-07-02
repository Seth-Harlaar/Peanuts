# Layout Spec

> Status: **ACCEPTED & IMPLEMENTED.** D1 = Option B (one always-grid body with `mode`); D2–D5 per
> §10. This model is live in `src/` (domain grid types, grid renderer, node previews, hierarchy via
> `node` items). Where this doc and `knowledge-base-spec.md` disagree on layout, **this doc wins**;
> the older linear-body / `child-page`-block passages there are superseded (they carry a pointer).

Replaces the **linear** page body (an ordered `Block[]`) with a **grid** layout: every page *is* a
grid. Items are placed into grid cells, and each item **renders responsively to the size of its own
grid cell** (not the viewport) so it looks right at any size.

Three requirements, three mechanisms:

| Requirement | Mechanism |
|-------------|-----------|
| Every page has a grid setup | The page body is **always** a grid (§2) |
| Know which nodes occupy which cells | `GridItem[]` — each item has a **placement** and holds a block or a node reference |
| Each item looks good at any size | **Container queries** per cell + **size-tiered** rendering (§4b, §5) |

---

## 1. Why this fits the existing model

`body` was kept as a discriminated union on `body.kind` *specifically as the extension point for
non-linear layouts* (knowledge-base-spec §1). This is an **additive** change to that reserved seam:

- Blocks still exist — they're the **leaf content**. A grid item can *be* a block.
- A grid item can also be a **reference to another node**, which is how "nodes occupy grid cells"
  works (and how the `child-page` hierarchy edge is expressed from now on — §6).

---

## 2. Core model

The body is always a grid. `mode` decides whether placements are honored (`grid`) or every item is
simply drawn full-width in order (`stack` — the effortless default, equivalent to the old linear
note).

```typescript
interface GridBody {
  kind: "grid";
  mode: "grid" | "stack";     // "stack" (default) = every item full-width, in array order
  columns: number;            // column count of the base grid (grid mode, wide), e.g. 12
  rowHeight?: number | "auto"; // implicit row track size in px; "auto" = content height
  gap?: number;               // gap between cells, px
  items: GridItem[];
}

interface GridItem {
  id: string;                 // stable id within the page (editor / React keys)
  content: GridItemContent;
  placement?: Placement;      // used only in grid mode at the wide tier; ignored in stack mode
}

type GridItemContent =
  | { kind: "block"; block: Block }     // leaf content (paragraph, table, image, …)
  | { kind: "node"; nodeId: string };   // another node, always rendered as a PREVIEW (§5a)

// Line-based placement (D4): freeform "bento" positioning, 1-indexed grid lines.
interface Placement {
  colStart: number;
  colSpan: number;
  rowStart?: number;  // omit → auto-flow onto the next available row
  rowSpan?: number;   // default 1
}
```

`NodeBody` becomes just `GridBody` (still a union type, reserved for a future `canvas` etc.). There
is **no separate `document` body** — a linear note is a grid in `stack` mode (D1, §10).

### Example (grid mode)

```json
{
  "kind": "grid",
  "mode": "grid",
  "columns": 12,
  "gap": 16,
  "items": [
    { "id": "a", "placement": { "colStart": 1, "colSpan": 12 },
      "content": { "kind": "block", "block": { "type": "heading", "level": 1, "text": "Storage design" } } },
    { "id": "b", "placement": { "colStart": 1, "colSpan": 8 },
      "content": { "kind": "node", "nodeId": "33333333-3333-4333-8333-333333333333" } },
    { "id": "c", "placement": { "colStart": 9, "colSpan": 4 },
      "content": { "kind": "node", "nodeId": "22222222-2222-4222-8222-222222222222" } }
  ]
}
```

A quick note is the same shape with `"mode": "stack"` and no `placement`s.

---

## 3. Rendering pipeline (presentation)

1. Page renders a CSS grid: `grid-template-columns: repeat(columns, 1fr)`, `gap`, implicit rows.
2. Each `GridItem` renders into a **cell wrapper** placed via `grid-column: colStart / span colSpan`
   (+ row equivalents). In `stack` mode the wrapper is always `grid-column: 1 / -1` (full width).
3. **Every cell wrapper is a query container** (`container-type: inline-size`). Children size
   themselves against the *cell*, not the page — this is the crux.
4. Cell content renders through the existing registries, now **size-aware**:
   - `block` items → the **block registry**, components adapting via `@container` queries (§5b).
   - `node` items → rendered as a **preview** whose density adapts to the cell (§5a).

Reading order (for stack mode, narrow reflow, breadcrumbs, and the page tree) is: array order in
`stack` mode; **row-major** of placements (top→bottom, then left→right) in `grid` mode.

---

## 4a. Responsiveness level 1 — page reflow (D3)

Driven by the **page** width, and dead simple:

- **`stack` mode** — every item is full-width at **all** sizes. (The "they didn't pick a grid" case.)
- **`grid` mode:**
  - **Large page** → render the **configured grid** (honor each item's `placement`).
  - **Medium page** → ignore placements; **every item is half-width** (`colSpan = columns / 2`),
    auto-flowing two-per-row in reading order.
  - **Small page** → **every item full-width**, stacked in reading order.

Authors only ever configure the *large* grid; medium/small reflow automatically. No per-item
breakpoint overrides to author. (Large/medium/small thresholds are a small fixed config.)

## 4b. Responsiveness level 2 — container queries (cell size)

Independent of page reflow: **each item adapts to its own cell.** A node in a 3-col cell and the
same node in a 12-col cell render differently at the same page width. Content tiers on cell
inline-size:

| Tier | Cell width | Intent |
|------|-----------|--------|
| `micro` | `< 200px` | icon + title only |
| `compact` | `200–399px` | title + short summary / key facts |
| `cozy` | `≥ 400px` | title + as much leaf content as fits |

Implemented with CSS `@container (min-width: …)`; a `useContainerTier(ref)` (ResizeObserver) hook is
available when a branch is structural rather than purely stylistic.

---

## 5. Size-adaptive rendering

### 5a. Nodes — always a bounded **preview** (D5)

**There is no node-in-node recursion.** A node rendered inside another node (a `node` grid item)
**always** renders as a *preview*, never the full node — and a preview **never includes that node's
child nodes.** The only "full" render is the node you actually navigate to (`/node/:id`).

So exactly two render modes exist, and rendering depth is always ≤ 2:

- **Full** (page you're viewing) — the node's own grid; its `block` items render as blocks; its
  `node` items render as **previews**.
- **Preview** (a node embedded anywhere) — responsive to its cell, but **capped**:
  - `micro` → type icon + title + open-arrow.
  - `compact` → title + type + tags + a one-line summary (first paragraph / bookmark note).
  - `cozy` → title + summary + the node's own **leaf (block) content** (truncated to fit).
  - **At every tier, the node's child `node` items are excluded** — they are not rendered (not even
    as nested previews). No recursion, ever.

Because previews never expand child nodes, there is no depth cap to configure (D5 resolved). The
open-arrow remains the way to navigate into a node for its full view.

### 5b. Blocks — container-responsive leaf content

Each block component adapts to its cell:

- `table` — `cozy`: normal; `compact`: horizontal scroll; `micro`: stacked key/value rows.
- `image` — scales to cell; caption hidden below `compact`.
- `code` — wrap/scroll; hide chrome below `cozy`.
- `paragraph`/`callout`/`quote` — fluid; clamp lines below `compact`.
- `list`/`checklist` — fluid.

---

## 6. Reconciliation with hierarchy (`child-page`) — D2: replace

The `child-page` **block is removed.** A **`node` grid item is the hierarchy edge**: a node placed
as a `node` item in a parent's grid *is* that parent's child. Same rules as before:

- **One parent max** — a node appears as a `node` item in at most one page.
- **Roots / cycles** — unchanged; validated at build.
- **Order** — reading order (§3): array order in `stack` mode, row-major of placements in `grid`
  mode. Used for breadcrumbs, the page tree, and reflow stacking.

Note this dovetails with D5: a page shows its **direct** children as previews; those previews don't
show *their* children — so the page tree in the sidebar remains the way to descend the hierarchy.

---

## 7. Impact on each layer (details land after approval)

- **Domain** (`knowledge-base-spec`): `NodeBody` = `GridBody`; add `GridItem`/`Placement`; **remove
  the `child-page` block**; hierarchy defined by `node` items. Blocks unchanged as leaf content.
- **Data**: grid lives inside the body JSON → still one `jsonb` column. Hierarchy derivation scans
  `node` grid items instead of `child-page` blocks; backlinks count `node` items too. Build also
  validates placements (in-range columns; warn on overlaps).
- **Application**: `NodeView` gains a **layout view model** — items with placements plus, for each
  `node` item, the resolved **preview payload** (summary + a leaf-content excerpt, **children
  omitted**) so previews render without extra fetches or recursion.
- **Presentation**: page renders the CSS grid; cells are query containers; block + node-preview
  rendering become tier-aware; add `useContainerTier`. Node items render as previews only.

---

## 8. Authoring

- Short term: authored JSON; build validates placements. `stack` mode needs no placements.
- Medium term: a **visual grid editor** (drag to move, handles to resize spans, a column ruler) —
  the natural home for a layout model, where it stops being tedious.
- The markdown→JSON converter emits a **`stack`-mode grid** (each block a full-width item), so
  linear notes still "just work."

---

## 9. Phasing

1. `GridBody` model + `stack`-mode renderer (= today's linear behavior, re-expressed as a grid).
2. `grid` mode with placements + large-tier rendering; build validation.
3. Container queries + size-tiered block rendering (§5b).
4. `node` items + preview rendering (§5a) + hierarchy move off `child-page` (§6).
5. Page reflow: medium (half-width) + small (full-width) (§4a).
6. Visual grid editor.

---

## 10. Open decision (need your call)

- **D1 — Confirm Option B** (one always-grid body with `mode: "grid" | "stack"`, `stack` = default =
  all full-width) over Option A (a separate `document` body). Everything above assumes **B**, which
  matches your framing that "these are always grid layouts." Say the word and it's locked.

*Resolved from your feedback:* **D2** replace `child-page` with `node` items · **D3** stack=all
full-width; grid: large=configured, medium=half, small=full · **D4** line-based placement · **D5**
node-in-node is always a preview, never full, never includes child nodes (no recursion).
