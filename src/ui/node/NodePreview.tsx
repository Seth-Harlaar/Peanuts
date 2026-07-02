import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { NodePreview as NodePreviewVM } from "../../app/viewModels";
import { NodeTypeIcon } from "../components/NodeTypeIcon";
import { TagList } from "../components/TagList";
import { BlockRenderer } from "../blocks/BlockRenderer";
import { useElementWidth, cellTier } from "../useContainerTier";

/**
 * A node embedded as a `node` grid item — always a bounded preview, never the
 * full node and never its child nodes (layout-spec §5a). Density adapts to the
 * cell size (micro → compact → cozy).
 */
export function NodePreview({ preview }: { preview: NodePreviewVM }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const tier = cellTier(width || 300);
  const { summary } = preview;

  return (
    <div className="node-preview" ref={ref} data-tier={tier}>
      <div className="node-preview__head">
        <span className="node-preview__label">
          <NodeTypeIcon type={summary.type} className="inline-node__icon" />
          <span className="node-preview__title">{summary.title}</span>
        </span>
        <Link
          className="node-preview__open"
          to={`/node/${summary.id}`}
          aria-label={`Open ${summary.title}`}
        >
          <ArrowRight size={16} />
        </Link>
      </div>

      {tier !== "micro" && <TagList tags={summary.tags} className="node-preview__tags" />}

      {tier === "compact" && preview.blocks[0] && (
        <div className="node-preview__summary">
          <BlockRenderer block={preview.blocks[0]} />
        </div>
      )}

      {tier === "cozy" && preview.blocks.length > 0 && (
        <div className="node-preview__body">
          {preview.blocks.slice(0, 4).map((b, i) => (
            <BlockRenderer key={i} block={b} />
          ))}
        </div>
      )}
    </div>
  );
}
