import type { BaseNode, Block, GridItem } from "./types";

// Stored wiki-link form: [[<guid>|Display Text]] (display optional). See spec §8.
export const WIKILINK_RE = /\[\[([0-9a-fA-F-]+)(?:\|([^\]]*))?\]\]/g;

export interface WikiLink {
  targetId: string;
  label?: string;
}

/** All wiki-links in a single text string, in order. */
export function wikiLinksInText(text: string): WikiLink[] {
  const out: WikiLink[] = [];
  for (const m of text.matchAll(WIKILINK_RE)) {
    out.push({ targetId: m[1], label: m[2] });
  }
  return out;
}

/** Text-bearing fields per block type, for scanning inline links. */
function textOf(block: Block): string[] {
  switch (block.type) {
    case "paragraph":
    case "heading":
    case "quote":
    case "callout":
      return [block.text];
    case "list":
      return block.items;
    case "checklist":
      return block.items.map((i) => i.text);
    default:
      return [];
  }
}

/** The block items in a node's grid, in reading (array) order. */
export function blockItems(node: BaseNode): Block[] {
  return node.body.items
    .filter((i): i is GridItem & { content: { kind: "block"; block: Block } } => i.content.kind === "block")
    .map((i) => i.content.block);
}

/**
 * Ordered child GUIDs — the `node` grid items. A `node` item is the hierarchy
 * edge (layout-spec §6): the referenced node is this node's child.
 */
export function childPageIds(node: BaseNode): string[] {
  return node.body.items
    .filter((i): i is GridItem & { content: { kind: "node"; nodeId: string } } => i.content.kind === "node")
    .map((i) => i.content.nodeId);
}

/**
 * All outbound reference GUIDs from a node: explicit `links[]`, inline
 * `[[wiki-links]]` in block items, and `node` grid items. De-duplicated.
 */
export function outboundIds(node: BaseNode): string[] {
  const ids = new Set<string>(node.links);
  for (const item of node.body.items) {
    if (item.content.kind === "node") {
      ids.add(item.content.nodeId);
    } else {
      for (const text of textOf(item.content.block)) {
        for (const link of wikiLinksInText(text)) ids.add(link.targetId);
      }
    }
  }
  return [...ids];
}
