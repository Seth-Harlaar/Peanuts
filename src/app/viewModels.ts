import type { BaseNode, Block, NodeSummary } from "../domain/types";

// Presentation-ready shapes assembled by the application layer (app spec §2).

// A bounded preview of a node embedded as a `node` grid item (layout-spec §5a):
// its own leaf content only — child `node` items are excluded (no recursion).
export interface NodePreview {
  summary: NodeSummary;
  blocks: Block[];
}

export interface NodeView {
  node: BaseNode;
  breadcrumbs: NodeSummary[]; // root → … → parent
  children: NodeSummary[]; // ordered child targets (node grid items), resolved
  backlinks: NodeSummary[]; // resolved inbound links
  outboundLinks: NodeSummary[]; // resolved [[wiki-links]] + links[]
  previews: Record<string, NodePreview>; // by nodeId, for each `node` grid item in this node
}

export interface PageTreeNode {
  summary: NodeSummary;
  children: PageTreeNode[];
}

export interface SearchResult {
  summary: NodeSummary;
  score: number;
}

// Parsed inline content (produced here; rendered by presentation). app spec §2.
export type Inline =
  | { kind: "text"; text: string }
  | { kind: "bold"; children: Inline[] }
  | { kind: "italic"; children: Inline[] }
  | { kind: "code"; text: string }
  | { kind: "wikiLink"; targetId: string; label: string; exists: boolean }
  | { kind: "url"; href: string; label: string };
