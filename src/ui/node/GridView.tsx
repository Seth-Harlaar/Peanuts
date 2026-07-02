import type { CSSProperties } from "react";
import type { GridBody, GridItem } from "../../domain/types";
import type { NodePreview as NodePreviewVM } from "../../app/viewModels";
import { BlockRenderer } from "../blocks/BlockRenderer";
import { MissingNodeView } from "../components/InlineNodeView";
import { NodePreview } from "./NodePreview";
import { pageTier, useElementWidth, type PageTier } from "../useContainerTier";

/**
 * Renders a node's grid body (layout-spec §3). Handles the two page-width
 * reflow behaviors (§4a / D3):
 *   - stack mode → every item full width, always.
 *   - grid mode  → large: configured placements · medium: every item half-width
 *                  · small: every item full width.
 * Each cell is a query container so its content can adapt to the cell size.
 */
export function GridView({
  body,
  previews,
}: {
  body: GridBody;
  previews: Record<string, NodePreviewVM>;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const tier = pageTier(width || 1200); // assume large until measured
  const stacked = body.mode === "stack" || tier === "small";
  const columns = stacked ? 1 : body.columns;

  const style: CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    gap: `${body.gap ?? 16}px`,
    gridAutoRows: body.rowHeight && body.rowHeight !== "auto" ? `${body.rowHeight}px` : undefined,
  };

  return (
    <div className="grid" ref={ref} style={style}>
      {body.items.map((item) => (
        <Cell
          key={item.id}
          item={item}
          tier={tier}
          columns={body.columns}
          stacked={stacked}
          previews={previews}
        />
      ))}
    </div>
  );
}

function cellStyle(
  item: GridItem,
  tier: PageTier,
  columns: number,
  stacked: boolean,
): CSSProperties {
  if (stacked) return {}; // single-column grid → each item is its own full-width row
  if (tier === "medium") return { gridColumn: `span ${Math.max(1, Math.round(columns / 2))}` };

  // large: honor placement; unplaced items default to full width
  const p = item.placement;
  if (!p) return { gridColumn: "1 / -1" };
  const style: CSSProperties = { gridColumn: `${p.colStart} / span ${p.colSpan}` };
  if (p.rowStart) style.gridRow = `${p.rowStart} / span ${p.rowSpan ?? 1}`;
  else if (p.rowSpan) style.gridRow = `span ${p.rowSpan}`;
  return style;
}

function Cell({
  item,
  tier,
  columns,
  stacked,
  previews,
}: {
  item: GridItem;
  tier: PageTier;
  columns: number;
  stacked: boolean;
  previews: Record<string, NodePreviewVM>;
}) {
  return (
    <div className="grid-cell" style={cellStyle(item, tier, columns, stacked)}>
      {item.content.kind === "block" ? (
        <BlockRenderer block={item.content.block} />
      ) : previews[item.content.nodeId] ? (
        <NodePreview preview={previews[item.content.nodeId]} />
      ) : (
        <MissingNodeView id={item.content.nodeId} />
      )}
    </div>
  );
}
