# Tech Stack Spec

The concrete tooling for building the knowledge base described in the other specs. Chosen to match
the three-layer architecture ([`README.md`](./README.md)) and the two hard constraints:

1. **Ship as a static SPA on GitHub Pages** — no server, no runtime backend.
2. **Keep the data-layer seam** so a real backend/DB can be added later without rewriting the UPPER
   layers ([`data-layer-spec.md`](./data-layer-spec.md) §5).

> Legend: **Use** = the recommended default for v1. **Alternative** = a reasonable swap. **Later** =
> only when the feature it enables is actually needed.

---

## 1. Foundations

| Concern | Use | Notes / alternatives |
|---------|-----|----------------------|
| Language | **TypeScript** (strict) | Non-negotiable — the specs are interface-driven; types are the contract across layers. |
| Package manager | **npm** | Ubiquitous, zero-setup; workspaces available if §7 is promoted to packages. |
| Bundler / dev server | **Vite** | Instant HMR, trivial static build, first-class TS/React. Also supports an SSG path later. |
| Runtime target | Modern evergreen browsers | No IE; lets us use `crypto.randomUUID`, native ESM, etc. |

---

## 2. Presentation layer

| Concern | Use | Notes / alternatives |
|---------|-----|----------------------|
| UI framework | **React 18 + TypeScript** | Matches the component/registry design in the presentation spec. |
| Routing | **React Router** (data router) | `/node/:id`, `/tag/:tag`, `/search`. Hash history (simplest for GH Pages sub-paths). |
| Styling | **CSS Modules + CSS variables** | Scoped, zero runtime, easy theming (light/dark) via variables. *Alt:* Tailwind if you prefer utility-first. |
| Icons | **lucide-react** | For node-type icons in the inline node view + block affordances. |
| Syntax highlighting | **Shiki** | For `code` blocks; accurate VS Code themes. *Alt:* Prism (lighter, less exact). |
| Math (`math` block) | **KaTeX** | **Later** — only when the math block is added. |

React is the **only** place the framework meets the app layer, via thin hooks (`useNodeView`,
`usePageTree`, …). Everything below stays framework-agnostic.

---

## 3. Application layer

| Concern | Use | Notes / alternatives |
|---------|-----|----------------------|
| Implementation | **Plain TypeScript** (no framework) | Services + view models; pure and unit-testable. |
| Data fetching in the UI | **Plain React hooks** (`useEffect` + `useState`) | Thin bindings call the async services and expose `{ data, loading, error }`. No caching layer — fetch on demand. (The `StaticFileRepository` may keep a trivial in-memory map of already-fetched files, but there is no query cache/invalidation framework.) |
| Markdown-lite inline parser | **Custom, small** | The inline grammar is tiny (`**bold**`, `*italic*`, `` `code` ``, `[[guid\|label]]`, `[text](url)`). A hand-written tokenizer producing the `Inline[]` model beats pulling in a full markdown engine. |
| Markdown → block JSON converter | **`unified` / `remark`** | **Authoring tool** (§10 of model spec), run at author time — parse real markdown into the block model and resolve `[[Title]]` → `[[guid\|Title]]`. Heavier deps are fine here; it's build-time, not shipped. |

Deliberately **not** shipping a full markdown runtime to the browser — content is already structured
blocks, and inline is a tiny custom grammar.

---

## 4. Data layer

| Concern | Use | Notes / alternatives |
|---------|-----|----------------------|
| v1 storage | **JSON files** under `/data` | One file per node; served statically. `StaticFileRepository`. |
| Fetching | Native **`fetch`** | Lazy per-node; `index.json` + `/data/derived/*.json` loaded up front. |
| ID generation | **`crypto.randomUUID()`** | GUIDs (model spec §8). *Alt:* `uuid` pkg if a polyfill is ever needed. |
| Schema validation | **Zod** | Validate node files at build time (catch hand-authoring errors); the schema doubles as a source of truth for types via `z.infer`. |
| Full-text search | **In-memory** over the index (v1) | Title + tags now. **Later:** prebuilt **MiniSearch/FlexSearch** index for body text. |
| Later backend | **Postgres + Drizzle** (or **Supabase**) | `DbRepository`/`ApiRepository` implementing the same interface; `body` → `jsonb`, references → FK/edge tables (data spec §5). *Only when "real web app" is wanted.* |

---

## 5. Build step & scripts

The static analogue of a database's indexer (data spec §4).

| Concern | Use | Notes |
|---------|-----|-------|
| Script runner | **tsx** | Run TypeScript build scripts directly (no separate compile). |
| File globbing | **fast-glob** | Walk `/data/nodes/**/*.json`. |
| Outputs | `index.json`, `derived/*.json`, `nodes/<guid>.json` | Generated into `public/data/`; source subdirectories are discarded (storage-only). |
| Validations | Zod + custom | Duplicate ids, one-parent rule, cycle detection, dangling refs. Fail the build on error. |

---

## 6. Quality & CI

| Concern | Use | Notes |
|---------|-----|-------|
| Unit / integration tests | **Vitest** | Fast, Vite-native, shared config. |
| Component tests | **React Testing Library** | Render views against `InMemoryRepository`. |
| Contract tests | Vitest suite run against **any** `KnowledgeRepository` | Guarantees `StaticFileRepository` and a future `DbRepository` behave identically (data spec §7). |
| Lint | **ESLint** (typescript-eslint) | Enforce layer boundaries (e.g. an import rule: presentation must not import the repository or `fetch`). |
| Format | **Prettier** | |
| Hosting | **GitHub Pages** | Static `dist/` from Vite. |
| CI/CD | **GitHub Actions** | On push: install → validate/build data → test → `vite build` → deploy to Pages. |

An ESLint boundary rule (e.g. `eslint-plugin-boundaries` or `import/no-restricted-paths`) is worth
adding early to keep the dependency direction (Presentation → Application → Data) from eroding.

---

## 7. Repository layout

Layer boundaries mirrored as folders (or pnpm workspace packages if you want hard enforcement):

```
/
├─ data/                     # the "database": node JSON + generated indexes + binary files
│  ├─ nodes/**              #   one file per node (human-named; id is a GUID inside)
│  ├─ files/                #   binary attachments
│  ├─ derived/              #   generated: backlinks.json, hierarchy.json
│  └─ index.json            #   generated
├─ scripts/                  # build step (tsx): validate + generate derived indexes
├─ spec/                     # these documents
└─ src/
   ├─ domain/               # shared types (BaseNode, Block, NodeSummary) — the contract
   ├─ data/                 # KnowledgeRepository + StaticFileRepository + InMemoryRepository
   ├─ app/                  # services, view models, inline parser (framework-agnostic)
   └─ ui/                   # React: hooks, components, block + node-view registries, routing
```

`src/domain` is imported by all; `src/data` knows storage; `src/app` imports only `domain` + the
repository interface; `src/ui` imports only `app` + `domain`. Same rule as the specs — enforced by
the ESLint boundary config.

---

## 8. Summary — the v1 install

React · TypeScript · Vite · React Router · CSS Modules · lucide-react · Shiki · Zod · tsx ·
fast-glob · Vitest · React Testing Library · ESLint · Prettier — deployed static to GitHub Pages via
GitHub Actions. Postgres/Drizzle (or Supabase), MiniSearch, and KaTeX are
**Later**, added behind the existing seams without disturbing the layers above.
