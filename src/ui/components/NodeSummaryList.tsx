import type { NodeSummary } from "../../domain/types";
import { InlineNodeView } from "./InlineNodeView";

/**
 * A list of node summaries rendered as inline links, with an optional heading.
 * Shared by search/tag results, backlinks, and the links-out menu. Renders
 * nothing when empty.
 */
export function NodeSummaryList({ items, title }: { items: NodeSummary[]; title?: string }) {
  if (items.length === 0) return null;
  return (
    <div className="summary-list">
      {title && <h3 className="list-title">{title}</h3>}
      <ul>
        {items.map((s) => (
          <li key={s.id}>
            <InlineNodeView summary={s} />
          </li>
        ))}
      </ul>
    </div>
  );
}
