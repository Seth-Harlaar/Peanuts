# Application Layer Spec

> The **middle** layer of the three-layer architecture — the seam between UI and storage.
>
> ```
> Presentation  ──depends on──▶  Application (this doc)  ──depends on──▶  Data
>       (React/UI)                (use cases, view models,             (KnowledgeRepository)
>                                  content parsing)
> ```
>
> Shares the domain model in [`knowledge-base-spec.md`](./knowledge-base-spec.md). Depends **only**
> on the `KnowledgeRepository` interface from [`data-layer-spec.md`](./data-layer-spec.md) — never
> on files, `fetch`, or SQL. Contains **no React and no DOM** — pure, framework-agnostic TypeScript.

Its job: turn raw repository primitives (nodes, id arrays) into **presentation-ready view models**
and expose **use-case operations** the UI can call without knowing how anything is stored or
computed. If the UI framework changed (React → something else) or storage changed (files → DB),
this layer would stay put.

---

## 1. Responsibilities

**Does:**
- Assemble **view models** from multiple repository calls (a node + its resolved backlinks +
  ordered child summaries + breadcrumbs, in one object).
- Own **content parsing**: turn markdown-lite block text into a structured **inline token model**
  and resolve `[[wiki-links]]` to real titles/existence. (Parsing = here; rendering = Presentation.)
- Build the **navigation model**: the page tree (the `child-page` hierarchy). (There is no folder
  tree — folders are storage-only, model spec §8.)
- Provide **mutation use cases** (create/update/delete) that call repository writes — no-ops/disabled
  when the repository is read-only.

**Does not:**
- Render anything, own JSX/DOM, or know about routing.
- Fetch files or know storage paths (that's the Data layer).
- Re-derive backlinks/hierarchy from scratch — it *consumes* the repository's derived data and
  *composes* it (e.g. turning child id arrays into ordered `NodeSummary`s).

---

## 2. View models (the outputs)

These are the shapes the Presentation layer consumes. All are plain data.

```typescript
// A fully-resolved node ready to render.
interface NodeView {
  node: BaseNode;
  breadcrumbs: NodeSummary[];      // root → … → parent (from hierarchy)
  children: NodeSummary[];         // ordered child-page targets, resolved to summaries
  backlinks: NodeSummary[];        // resolved inbound links
  outboundLinks: NodeSummary[];    // resolved [[wiki-links]] + links[] targets
}

// Navigation (page hierarchy only — no folder tree).
interface PageTreeNode { summary: NodeSummary; children: PageTreeNode[]; }  // from child-page hierarchy

// Search.
interface SearchResult { summary: NodeSummary; snippet?: string; score: number; }

// Parsed inline content (produced by the content parser; rendered by Presentation).
type Inline =
  | { kind: "text"; text: string }
  | { kind: "bold"; children: Inline[] }
  | { kind: "italic"; children: Inline[] }
  | { kind: "code"; text: string }
  | { kind: "wikiLink"; targetId: string; label: string; exists: boolean }  // targetId = GUID
  | { kind: "url"; href: string; label: string };
```

Note `wikiLink.targetId` is a **GUID** (references are stored by GUID — knowledge-base-spec §8). The
stored inline form is `[[<guid>|Display]]`; `parseInline` looks the GUID up in the index to set
`exists` and the current `label` (falling back to the stored display text). Resolution happens
**here**, so the UI just renders a valid/broken link without doing lookups or knowing about GUIDs.

---

## 3. Services (the operations)

Grouped by use case. Each is a plain class/module taking a `KnowledgeRepository` (dependency
injection) — trivially testable with `InMemoryRepository`.

```typescript
class NodeService {
  getNodeView(id: string): Promise<NodeView | null>;   // the big assembler
}

class NavigationService {
  getPageTree(): Promise<PageTreeNode[]>;              // child-page hierarchy view (§5)
  getBreadcrumbs(id: string): Promise<NodeSummary[]>;
}

class SearchService {
  search(query: string): Promise<SearchResult[]>;
  filterByTag(tag: string): Promise<NodeSummary[]>;
  filterByType(type: BaseNode["type"]): Promise<NodeSummary[]>;
}

class ContentService {
  parseInline(text: string): Inline[];                 // markdown-lite → tokens, links resolved
  // (uses the index to set wikiLink.exists/label)
}

class MutationService {                                // real only when repo is writable
  create(node: BaseNode): Promise<void>;
  update(node: BaseNode): Promise<void>;
  remove(id: string): Promise<void>;
  get canWrite(): boolean;                             // false for StaticFileRepository
}
```

- The **page tree** is the only navigation structure built here (the `child-page` hierarchy — model
  spec §5). There is no folder tree; folders don't exist above storage (§8).
- `getNodeView` is where several repository calls (`getNode`, `getBacklinks`, `getChildren`,
  `getParent`, `getNodes` for resolution) are fanned out (in parallel) and stitched into one object.

---

## 4. Orchestration

- **No caching layer.** Services assemble view models **on demand** each time they're asked; the UI
  fetches when it renders. (The `StaticFileRepository` may keep a trivial in-memory map of
  already-fetched files, but that's a Data-layer detail — there is no view-model cache or
  query/invalidation framework here.)
- **Mutations** call repository writes directly; the UI re-requests whatever it needs afterward. No
  invalidation bookkeeping. In read-only mode, `MutationService.canWrite` is `false` and writes are
  disabled.
- Expose loading/error as data, not exceptions where possible, so the UI can render states cleanly
  (a simple `{ data, error, loading }`).
- Keep everything **framework-agnostic**: no hooks here. The Presentation layer wraps these
  services in plain React hooks (`useEffect`/`useState`) — see the presentation spec.

---

## 5. Why this layer exists (the seam it protects)

Without it, components would call the repository directly and each would re-implement link
resolution, tree building, and breadcrumb logic — coupling UI to both the data shape *and* domain
rules. With it:

- **Swap the data layer** (files → DB): only the repository changes; view models are identical.
- **Swap the UI** (or add an SSG renderer, a CLI, a second client): reuse every service and view
  model unchanged.
- **Test domain logic** (link resolution, tree assembly, ordering) with zero UI and zero I/O.

Rule of thumb: *if it's a decision about what the user's data **means** or how pieces **combine**,
it lives here; if it's about pixels it's Presentation; if it's about bytes it's Data.*
