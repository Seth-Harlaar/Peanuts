import { useNodeView } from "../hooks";
import { AsyncStatus } from "../components/AsyncStatus";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { nodeViewRegistry } from "../node/NodeView";

/** Renders a node's full page by id — shared by the node route and the homepage. */
export function NodeById({ id }: { id: string }) {
  const state = useNodeView(id);
  if (!state.data) return <AsyncStatus state={state} />;
  const view = state.data;
  const { Full } = nodeViewRegistry[view.node.type];
  return (
    <div className="page">
      <Breadcrumbs trail={view.breadcrumbs} />
      <Full view={view} />
    </div>
  );
}
