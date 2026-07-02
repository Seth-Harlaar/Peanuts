import { useState } from "react";
import { Link2 } from "lucide-react";
import type { NodeSummary } from "../../domain/types";
import { NodeSummaryList } from "./NodeSummaryList";

/**
 * A link icon that toggles a dropdown listing a node's outbound links. Sits
 * beside the node title. Renders nothing when there are no links.
 */
export function OutboundLinksMenu({ items }: { items: NodeSummary[] }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <div className="links-out">
      <button
        type="button"
        className={`links-out__toggle${open ? " links-out__toggle--open" : ""}`}
        aria-label="Links out"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Link2 size={18} />
      </button>
      {open && (
        <div className="links-out__panel">
          <NodeSummaryList items={items} title="Links out" />
        </div>
      )}
    </div>
  );
}
