import { toSummary, type BaseNode, type NodeSummary } from "../domain/types";
import { childPageIds, outboundIds } from "../domain/references";
import type { KnowledgeRepository } from "./repository";

/**
 * Fully in-memory, writable implementation used for tests, fixtures, and as a
 * reference for repository behavior (data spec §3.2). Derives all indexes on
 * construction / mutation.
 */
export class InMemoryRepository implements KnowledgeRepository {
  private nodes = new Map<string, BaseNode>();

  constructor(seed: BaseNode[] = []) {
    for (const node of seed) this.nodes.set(node.id, node);
    this.validate();
  }

  private validate(): void {
    // One-parent rule: a node may be a child-page in at most one parent.
    const parentOf = new Map<string, string>();
    for (const node of this.nodes.values()) {
      for (const childId of childPageIds(node)) {
        if (parentOf.has(childId)) {
          throw new Error(
            `Node ${childId} is a child-page of both ${parentOf.get(childId)} and ${node.id}`,
          );
        }
        parentOf.set(childId, node.id);
      }
    }
    // (Cycle detection omitted here; the build step enforces it on real data.)
  }

  private summary(node: BaseNode): NodeSummary {
    return toSummary(node);
  }

  async getIndex(): Promise<NodeSummary[]> {
    return [...this.nodes.values()].map((n) => this.summary(n));
  }

  async getNode(id: string): Promise<BaseNode | null> {
    return this.nodes.get(id) ?? null;
  }

  async getNodes(ids: string[]): Promise<BaseNode[]> {
    return ids.map((id) => this.nodes.get(id)).filter((n): n is BaseNode => !!n);
  }

  async getBacklinks(id: string): Promise<string[]> {
    const out: string[] = [];
    for (const node of this.nodes.values()) {
      if (node.id !== id && outboundIds(node).includes(id)) out.push(node.id);
    }
    return out;
  }

  async getChildren(id: string): Promise<string[]> {
    const node = this.nodes.get(id);
    return node ? childPageIds(node) : [];
  }

  async getParent(id: string): Promise<string | null> {
    for (const node of this.nodes.values()) {
      if (childPageIds(node).includes(id)) return node.id;
    }
    return null;
  }

  async search(query: string): Promise<NodeSummary[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return (await this.getIndex()).filter(
      (n) => n.title.toLowerCase().includes(q) || n.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }

  async saveNode(node: BaseNode): Promise<void> {
    this.nodes.set(node.id, node);
    this.validate();
  }

  async deleteNode(id: string): Promise<void> {
    this.nodes.delete(id);
  }
}
