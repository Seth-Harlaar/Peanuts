import type { SupabaseClient } from "@supabase/supabase-js";
import { toSummary, type BaseNode, type NodeBody, type NodeSummary, type NodeType } from "../domain/types";
import { childPageIds, outboundIds } from "../domain/references";
import type { KnowledgeRepository } from "./repository";
import { supabase } from "./supabaseClient";

const TABLE = "nodes";

// Row shape of the `nodes` table (supabase/migrations/0001_init.sql).
interface NodeRow {
  id: string;
  type: NodeType;
  title: string;
  tags: string[];
  links: string[];
  created: string;
  updated: string;
  source: string | null;
  archived: boolean;
  body: NodeBody;
}

function rowToNode(row: NodeRow): BaseNode {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    tags: row.tags ?? [],
    links: row.links ?? [],
    created: row.created,
    updated: row.updated,
    ...(row.source ? { source: row.source } : {}),
    ...(row.archived ? { archived: true } : {}),
    body: row.body,
  };
}

function nodeToRow(node: BaseNode): NodeRow {
  return {
    id: node.id,
    type: node.type,
    title: node.title,
    tags: node.tags,
    links: node.links,
    created: node.created,
    updated: node.updated,
    source: node.source ?? null,
    archived: node.archived ?? false,
    body: node.body,
  };
}

/**
 * Read/write repository backed by Supabase Postgres (data spec §3.3).
 *
 * All nodes are loaded once and cached in a Map; children/parent/backlinks are
 * derived in memory with the same helpers as the static build step
 * (src/domain/references.ts) — cheap at this scale and keeps this class a thin
 * translation of the same behavior as InMemoryRepository. Writes go to Postgres
 * (RLS enforces auth) and keep the cached Map in sync.
 */
export class SupabaseRepository implements KnowledgeRepository {
  private nodesPromise?: Promise<Map<string, BaseNode>>;

  constructor(private client: SupabaseClient = supabase) {}

  private nodes(): Promise<Map<string, BaseNode>> {
    return (this.nodesPromise ??= this.loadAll());
  }

  private async loadAll(): Promise<Map<string, BaseNode>> {
    const { data, error } = await this.client.from(TABLE).select("*");
    if (error) throw new Error(`Supabase load failed: ${error.message}`);
    const map = new Map<string, BaseNode>();
    for (const row of (data ?? []) as NodeRow[]) map.set(row.id, rowToNode(row));
    return map;
  }

  async getIndex(): Promise<NodeSummary[]> {
    return [...(await this.nodes()).values()].map(toSummary);
  }

  async getNode(id: string): Promise<BaseNode | null> {
    return (await this.nodes()).get(id) ?? null;
  }

  async getNodes(ids: string[]): Promise<BaseNode[]> {
    const map = await this.nodes();
    return ids.map((id) => map.get(id)).filter((n): n is BaseNode => !!n);
  }

  async getBacklinks(id: string): Promise<string[]> {
    const out: string[] = [];
    for (const node of (await this.nodes()).values()) {
      if (node.id !== id && outboundIds(node).includes(id)) out.push(node.id);
    }
    return out;
  }

  async getChildren(id: string): Promise<string[]> {
    const node = (await this.nodes()).get(id);
    return node ? childPageIds(node) : [];
  }

  async getParent(id: string): Promise<string | null> {
    for (const node of (await this.nodes()).values()) {
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
    const { error } = await this.client.from(TABLE).upsert(nodeToRow(node));
    if (error) throw new Error(`Supabase saveNode failed: ${error.message}`);
    (await this.nodes()).set(node.id, node);
  }

  async deleteNode(id: string): Promise<void> {
    const { error } = await this.client.from(TABLE).delete().eq("id", id);
    if (error) throw new Error(`Supabase deleteNode failed: ${error.message}`);
    (await this.nodes()).delete(id);
  }
}
