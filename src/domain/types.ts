// The shared domain model — imported by every layer (data, app, ui).
// See spec/knowledge-base-spec.md.

export type NodeType =
  | "tidbit"
  | "doc-summary"
  | "guide"
  | "concept"
  | "reference"
  | "resource"
  | "other";

export type ColumnType = "text" | "number" | "date" | "checkbox" | "tag" | "link";

export interface TableColumn {
  id: string;
  label: string;
  type: ColumnType;
}

export type TableCell = string | number | boolean;
export type TableRow = Record<string, TableCell>;

// --- Blocks: leaf content placed into grid cells (see spec/layout-spec.md). ---
export type Block =
  // prose
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "code"; language: string; text: string }
  | { type: "list"; style: "bullet" | "numbered"; items: string[] }
  | { type: "quote"; text: string }
  | { type: "callout"; style: "info" | "warning" | "success"; text: string }
  | { type: "divider" }
  // artifacts
  | { type: "table"; columns: TableColumn[]; rows: TableRow[] }
  | { type: "image"; path: string; caption?: string; alt?: string }
  | { type: "file"; filename: string; path: string; mimeType: string; size?: number }
  | { type: "checklist"; items: { text: string; checked: boolean }[] }
  | { type: "bookmark"; url: string; title?: string; note?: string; excerpt?: string; favicon?: string };

export type BlockType = Block["type"];

// --- Grid layout: every page is a grid (see spec/layout-spec.md). ---

// Line-based placement (1-indexed grid lines). Used only in `grid` mode, wide tier.
export interface Placement {
  colStart: number;
  colSpan: number;
  rowStart?: number;
  rowSpan?: number;
}

export type GridItemContent =
  | { kind: "block"; block: Block } // leaf content
  | { kind: "node"; nodeId: string }; // another node, rendered as a bounded preview

export interface GridItem {
  id: string; // stable within the page (editor / React keys)
  content: GridItemContent;
  placement?: Placement; // grid mode, wide tier only; ignored in stack mode
}

export interface GridBody {
  kind: "grid";
  mode: "grid" | "stack"; // "stack" = every item full-width, in array order (the simple default)
  columns: number; // base column count (grid mode, wide), e.g. 12
  rowHeight?: number | "auto";
  gap?: number; // px
  items: GridItem[];
}

// `body` stays a union type — reserved for a future non-grid layout (e.g. canvas).
export type NodeBody = GridBody;

export interface BaseNode {
  id: string; // GUID (spec §8)
  type: NodeType;
  title: string;
  tags: string[];
  links: string[]; // explicit outbound GUIDs
  created: string; // ISO 8601
  updated: string; // ISO 8601
  source?: string;
  archived?: boolean;
  body: NodeBody;
}

// Lightweight projection used by sidebar/search/inline views.
// NOTE: folders are a storage-only concern (how source files are arranged on
// disk) and are deliberately absent from the runtime model — see spec §8.
export interface NodeSummary {
  id: string;
  type: NodeType;
  title: string;
  tags: string[];
}

export function toSummary(node: BaseNode): NodeSummary {
  return {
    id: node.id,
    type: node.type,
    title: node.title,
    tags: node.tags,
  };
}
