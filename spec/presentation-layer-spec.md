# Presentation Layer Spec

> The **top** layer of the three-layer architecture.
>
> ```
> Presentation (this doc)  ──depends on──▶  Application  ──depends on──▶  Data
>   (React components,               (services, view models)        (KnowledgeRepository)
>    routing, rendering)
> ```
>
> Depends **only** on the Application layer's services and view models
> ([`application-layer-spec.md`](./application-layer-spec.md)) plus the shared domain model
> ([`knowledge-base-spec.md`](./knowledge-base-spec.md)). It **never** fetches files, knows paths,
> resolves `[[wiki-links]]`, or builds trees — it receives ready-made view models and renders them.

Its job: render view models, handle interaction and routing, and render the `Block[]` content via a
pluggable per-block-type registry.

---

## 1. Responsibilities

**Does:** components, layout, routing, block/inline rendering, user interaction, loading/empty/error
UI, theming.

**Does not:** data access, `[[wiki-link]]` resolution, tree assembly, search ranking (all
Application layer). No `fetch`, no file paths, no repository imports.

---

## 2. Stack

- **React + TypeScript + Vite** SPA (recommended now) — trivial to deploy to GitHub Pages.
- **React Router** for navigation.
- Application services are exposed to components through thin **React hooks** (the only place React
  meets the app layer):

```typescript
useNodeView(id): { data?: NodeView; loading; error }
usePageTree(): { data?: PageTreeNode[]; ... }
useSearch(query): { results: SearchResult[]; ... }
useMutations(): MutationService            // .canWrite gates edit UI
```

Hooks wrap the framework-agnostic services; if the framework ever changes, only this thin binding
does. Because the app/data layers are framework-agnostic, an **SSG** build (Astro/Vite SSG walking
the same services at build time) remains possible later without touching them.

---

## 3. Component tree

```
<AppShell>
  <Sidebar>
    <SearchBar/>
    <FilterBar/>                 // type + tag filters
    <PageTreeView/>              // child-page hierarchy axis (model spec §5)
  </Sidebar>
  <MainPane>
    <Breadcrumbs/>
    <NodeView>                   // switches on nothing structural — just walks blocks
      <BlockRenderer/> × content.length
    </NodeView>
    <BacklinksPanel/>            // + outbound links
  </MainPane>
</AppShell>
```

The sidebar shows the **page tree** (the `child-page` hierarchy). There is no folder tree — folders
are a storage-only concern and are never surfaced in the UI (model spec §8).

---

## 4. Block rendering — a registry

The core of the view. `NodeView` walks `body.content` and renders each block through a
**registry** mapping `block.type → component`. Adding a new block type = registering one component;
no switch statements to hunt down. Unknown types fall back gracefully.

```typescript
const blockRegistry: Record<Block["type"], React.FC<{ block: Block }>> = {
  paragraph: ParagraphBlock,   heading: HeadingBlock,   code: CodeBlock,
  list: ListBlock,             quote: QuoteBlock,       callout: CalloutBlock,
  divider: DividerBlock,       table: TableBlock,       image: ImageBlock,
  file: FileBlock,             checklist: ChecklistBlock, bookmark: BookmarkBlock,
  "child-page": ChildPageBlock,
};

function BlockRenderer({ block }: { block: Block }) {
  const C = blockRegistry[block.type] ?? UnknownBlock;
  return <C block={block} />;
}
```

Notable block components:
- **`TableBlock`** — renders columns/rows; column `type` drives cell rendering (checkbox, date,
  tag, link) and future sort/filter.
- **`FileBlock`** — download/preview link from metadata; **`ImageBlock`** — inline `<img>` + caption.
- **`ChecklistBlock`** — checkboxes (read-only until write mode exists).
- **`BookmarkBlock`** — link card (favicon/title/note/excerpt).
- **`ChildPageBlock`** — renders the target node's **inline view** (§5): a compact label — type
  icon + title — **not** the child's content. Clicking routes to the child's full page. This is a
  **reference indicator**, not embedded content (contrast the deferred `embed` block, which *would*
  inline full rendered content).

### Inline rendering

Block text is not raw markdown at render time — the Application layer already parsed it into an
`Inline[]` token model (bold/italic/code/wikiLink/url, with links resolved). An `<InlineText>`
component renders those tokens:
- `wikiLink` → a router link; styled "broken" when `exists === false`.
- `url` → external anchor.

Presentation never parses markdown or looks up link targets itself.

---

## 5. Node views — inline vs. full page

Every node can be rendered at **two levels of detail**, and each node `type` defines both:

- **Inline view** — a compact, one-line **reference indicator**: a type icon + the node's title
  (optionally tag chips). It shows *that a node exists here* and links to it; it renders
  **none** of the node's block content. This is what appears wherever a node is referenced from
  inside another node — a `child-page` block, a wiki-link card, search results, tree rows.
- **Full page view** — the whole node: header + metadata + the block-walked body (§4) + backlinks.
  Shown only on the node's own route (`/node/:id`), i.e. after you click.

So rendering "a page inside a page" shows just the **inline view** (the label), and clicking
navigates to the **full page view** — never nested full content. This also prevents runaway
recursion and keeps large trees cheap to render.

### A per-type view registry

Parallel to the block registry (§4), each node `type` registers an inline and a full renderer:

```typescript
interface NodeViewSet {
  Inline: React.FC<{ summary: NodeSummary }>;     // compact label; data = summary only (cheap)
  Full:   React.FC<{ view: NodeView }>;           // whole page; data = assembled NodeView
}

const nodeViewRegistry: Record<BaseNode["type"], NodeViewSet> = {
  tidbit: {...}, concept: {...}, guide: {...}, "doc-summary": {...},
  reference: {...}, resource: {...}, other: {...},
};

// Renders any node reference compactly — used by child-page blocks, cards, tree rows.
function InlineNodeView({ summary }: { summary: NodeSummary }) {
  const { Inline } = nodeViewRegistry[summary.type] ?? defaultViewSet;
  return <Inline summary={summary} />;
}
```

Design notes:
- **Inline takes only a `NodeSummary`** (id, type, title, tags) — no body fetch — so
  rendering a reference is cheap and never triggers loading the target's content. The summaries for
  a page's `child-page`/link targets are already resolved by the app layer on the assembled
  `NodeView` (`children`, `outboundLinks`); the block renderer reads them from a `NodeView` context
  by GUID rather than fetching per card.
- **Full takes an assembled `NodeView`** (from `useNodeView`), and for most types delegates to the
  shared block-walking `DocumentView`; the `type` mainly customizes the header/badge/chrome. Types
  can specialize further (e.g. a `resource` whose sole block is a bookmark could render a richer
  header) without affecting others.
- Unknown/new types fall back to a `defaultViewSet` (generic icon + title inline; block-walk full).
- `child-page` blocks and wiki-link cards both route their click to `/node/:id` (the Full view).

---

## 6. Routing

| Route              | View                                             |
|--------------------|--------------------------------------------------|
| `/`                | Home / recent / roots                            |
| `/node/:id`        | `NodeView` for the node                          |
| `/tag/:tag`        | Nodes filtered by tag                            |
| `/type/:type`      | Nodes filtered by type                           |
| `/search?q=`       | Search results                                   |

`:id` is the node's GUID. Wiki-links and child-page cards route to `/node/:id` (the app layer
already resolved references to GUIDs). A readable `slug` route could be added later if prettier URLs
are wanted — see knowledge-base-spec §8.

---

## 7. States, theming, accessibility

- Every hook renders explicit **loading / empty / error / broken-link** states.
- **Edit affordances are gated on `useMutations().canWrite`** — hidden entirely in the read-only
  static build, present once a writable repository exists. No other code changes between read-only
  and read-write.
- Theming via CSS variables (light/dark); code blocks get syntax highlighting; `callout` styles map
  to info/warning/success.
- Keyboard: quick-open/search palette, `[[`-style link navigation later.

---

## 8. What must stay out

To keep the seam intact, the Presentation layer must never:
- import a repository or call `fetch`/read a path,
- parse markdown-lite or resolve `[[wiki-links]]`,
- build the page tree,
- rank search results.

All of the above belong to the Application or Data layer. If a component needs one of them, it asks
a hook/service — it does not do it inline.
