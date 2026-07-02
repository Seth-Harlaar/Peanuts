import { Link } from "react-router-dom";
import type { NodeSummary } from "../../domain/types";
import { NodeTypeIcon } from "./NodeTypeIcon";

/**
 * The compact inline view of a node — a type icon + title that links to the
 * full page (presentation spec §5). Takes only a NodeSummary; never loads the
 * target's content.
 */
export function InlineNodeView({ summary }: { summary: NodeSummary }) {
  return (
    <Link className="inline-node" to={`/node/${summary.id}`}>
      <NodeTypeIcon type={summary.type} className="inline-node__icon" />
      <span>{summary.title}</span>
    </Link>
  );
}

/** Fallback for an unresolved reference (target missing from the index). */
export function MissingNodeView({ id }: { id: string }) {
  return <span className="inline-node inline-node--missing">⚠ unknown node ({id.slice(0, 8)})</span>;
}
