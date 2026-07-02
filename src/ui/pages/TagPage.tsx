import { useParams } from "react-router-dom";
import { useTag } from "../hooks";
import { AsyncStatus } from "../components/AsyncStatus";
import { NodeSummaryList } from "../components/NodeSummaryList";

/** The `/tag/:tag` route. */
export function TagPage() {
  const { tag = "" } = useParams();
  const state = useTag(tag);
  return (
    <div className="page">
      <h1>#{tag}</h1>
      {state.data ? <NodeSummaryList items={state.data} /> : <AsyncStatus state={state} />}
    </div>
  );
}
