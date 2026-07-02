import type { NodeType } from "../../domain/types";
import type { NodeView } from "../../app/viewModels";
import { NodeTypeIcon } from "../components/NodeTypeIcon";
import { NodeSummaryList } from "../components/NodeSummaryList";
import { TagList } from "../components/TagList";
import { OutboundLinksMenu } from "../components/OutboundLinksMenu";
import { GridView } from "./GridView";

/** The full page view of a node — header + grid body + backlinks. */
export function FullNodeView({ view }: { view: NodeView }) {
  const { node } = view;

  return (
    <article className="node">
      <header className="node__header">
        <div className="node__type">
          <NodeTypeIcon type={node.type} /> {node.type}
        </div>
        <div className="node__titlerow">
          <h1>{node.title}</h1>
          <OutboundLinksMenu items={view.outboundLinks} />
        </div>
        <TagList tags={node.tags} className="node__tags" />
      </header>

      <div className="node__body">
        <GridView body={node.body} previews={view.previews} />
      </div>

      {view.backlinks.length > 0 && (
        <footer className="node__footer">
          <NodeSummaryList title="Backlinks" items={view.backlinks} />
        </footer>
      )}
    </article>
  );
}

interface NodeViewSet {
  Full: React.FC<{ view: NodeView }>;
}

const defaultViewSet: NodeViewSet = { Full: FullNodeView };

// One entry per node type (presentation spec §5). Today all share the default
// set; specialize a type's full view here as needed.
export const nodeViewRegistry: Record<NodeType, NodeViewSet> = {
  tidbit: defaultViewSet,
  "doc-summary": defaultViewSet,
  guide: defaultViewSet,
  concept: defaultViewSet,
  reference: defaultViewSet,
  resource: defaultViewSet,
  other: defaultViewSet,
};
