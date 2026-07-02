import type { BaseNode, NodeSummary } from "../domain/types";

// The single storage seam. See spec/data-layer-spec.md §2.
export interface KnowledgeRepository {
  // reads
  getIndex(): Promise<NodeSummary[]>;
  getNode(id: string): Promise<BaseNode | null>;
  getNodes(ids: string[]): Promise<BaseNode[]>;

  getBacklinks(id: string): Promise<string[]>;
  getChildren(id: string): Promise<string[]>;
  getParent(id: string): Promise<string | null>;

  search(query: string): Promise<NodeSummary[]>;

  // writes — throw ReadOnlyError in read-only implementations
  saveNode(node: BaseNode): Promise<void>;
  deleteNode(id: string): Promise<void>;
}

export class ReadOnlyError extends Error {
  constructor(op: string) {
    super(`Repository is read-only: ${op} is not supported.`);
    this.name = "ReadOnlyError";
  }
}

// Shape of the generated derived index (spec data-layer §4).
export interface HierarchyEntry {
  parent: string | null;
  children: string[];
}
export type HierarchyIndex = Record<string, HierarchyEntry>;
export type BacklinksIndex = Record<string, string[]>;
