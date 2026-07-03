import type { BaseNode, NodeSummary, NodeType } from "../domain/types";
import { blockItems, outboundIds } from "../domain/references";
import { toSummary } from "../domain/types";
import type { KnowledgeRepository } from "../data/repository";
import { parseInline, type LinkResolver } from "./inlineParser";
import type { Inline, NodePreview, NodeView, PageTreeNode, SearchResult } from "./viewModels";

async function summaryMap(repo: KnowledgeRepository): Promise<Map<string, NodeSummary>> {
  const index = await repo.getIndex();
  return new Map(index.map((s) => [s.id, s]));
}

function resolveMany(ids: string[], map: Map<string, NodeSummary>): NodeSummary[] {
  return ids.map((id) => map.get(id)).filter((s): s is NodeSummary => !!s);
}

/** Assembles the fully-resolved NodeView (app spec §3). */
export class NodeService {
  constructor(private repo: KnowledgeRepository) {}

  async getNodeView(id: string): Promise<NodeView | null> {
    const [node, map] = await Promise.all([this.repo.getNode(id), summaryMap(this.repo)]);
    if (!node) return null;

    const [childIds, backlinkIds] = await Promise.all([
      this.repo.getChildren(id),
      this.repo.getBacklinks(id),
    ]);

    const breadcrumbs = await this.breadcrumbs(id, map);
    const outbound = outboundIds(node).filter((x) => x !== id);
    const previews = await this.previews(childIds);

    return {
      node,
      breadcrumbs,
      children: resolveMany(childIds, map),
      backlinks: resolveMany(backlinkIds, map),
      outboundLinks: resolveMany(outbound, map),
      previews,
    };
  }

  // Bounded previews for the `node` grid items on this page: each referenced
  // node's leaf blocks only — its own child `node` items are excluded (no
  // recursion, layout-spec §5a).
  private async previews(nodeIds: string[]): Promise<Record<string, NodePreview>> {
    const nodes = await this.repo.getNodes(nodeIds);
    const out: Record<string, NodePreview> = {};
    for (const n of nodes) {
      out[n.id] = { summary: toSummary(n), blocks: blockItems(n) };
    }
    return out;
  }

  private async breadcrumbs(id: string, map: Map<string, NodeSummary>): Promise<NodeSummary[]> {
    const chain: NodeSummary[] = [];
    const seen = new Set<string>([id]);
    let parent = await this.repo.getParent(id);
    while (parent && !seen.has(parent)) {
      seen.add(parent);
      const s = map.get(parent);
      if (s) chain.unshift(s);
      parent = await this.repo.getParent(parent);
    }
    return chain;
  }
}

/** The page tree (child-page hierarchy). Folders are not a navigation concern. */
export class NavigationService {
  constructor(private repo: KnowledgeRepository) {}

  /**
   * The node to show at `/`. A user-selected homepage takes precedence; until
   * that's configured, fall back to the first page found in the index.
   */
  async getHomepageId(): Promise<string | null> {
    // TODO: honor a user-selected homepage once site config exists.
    const selected: string | null = null;
    if (selected) return selected;
    const index = await this.repo.getIndex();
    return index[0]?.id ?? null;
  }

  async getPageTree(): Promise<PageTreeNode[]> {
    const map = await summaryMap(this.repo);
    const childIdsById = new Map<string, string[]>();
    const hasParent = new Set<string>();

    await Promise.all(
      [...map.keys()].map(async (id) => {
        const children = await this.repo.getChildren(id);
        childIdsById.set(id, children);
        for (const c of children) hasParent.add(c);
      }),
    );

    const build = (id: string): PageTreeNode => ({
      summary: map.get(id)!,
      children: (childIdsById.get(id) ?? []).filter((c) => map.has(c)).map(build),
    });

    return [...map.keys()].filter((id) => !hasParent.has(id)).map(build);
  }
}

export class SearchService {
  constructor(private repo: KnowledgeRepository) {}

  async search(query: string): Promise<SearchResult[]> {
    const hits = await this.repo.search(query);
    return hits.map((summary) => ({ summary, score: 1 }));
  }

  async filterByTag(tag: string): Promise<NodeSummary[]> {
    return (await this.repo.getIndex()).filter((n) => n.tags.includes(tag));
  }

  async filterByType(type: NodeType): Promise<NodeSummary[]> {
    return (await this.repo.getIndex()).filter((n) => n.type === type);
  }
}

/** Parses block text into the inline token model, resolving wiki-links. */
export class ContentService {
  constructor(private repo: KnowledgeRepository) {}

  async getResolver(): Promise<LinkResolver> {
    const map = await summaryMap(this.repo);
    return (targetId) => {
      const s = map.get(targetId);
      return { title: s?.title ?? "", exists: !!s };
    };
  }

  parse(text: string, resolver: LinkResolver): Inline[] {
    return parseInline(text, resolver);
  }
}

/** Write use cases — disabled when the repository is read-only (app spec §3). */
export class MutationService {
  // A predicate (not a fixed boolean) so write capability can track live state
  // such as the current auth session — see src/ui/services.ts.
  constructor(
    private repo: KnowledgeRepository,
    private readonly _canWrite: boolean | (() => boolean),
  ) {}

  get canWrite(): boolean {
    return typeof this._canWrite === "function" ? this._canWrite() : this._canWrite;
  }

  create(node: BaseNode): Promise<void> {
    return this.repo.saveNode(node);
  }
  update(node: BaseNode): Promise<void> {
    return this.repo.saveNode(node);
  }
  remove(id: string): Promise<void> {
    return this.repo.deleteNode(id);
  }
}
