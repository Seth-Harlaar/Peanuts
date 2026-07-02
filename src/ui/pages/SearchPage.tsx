import { useSearchParams } from "react-router-dom";
import { useSearch } from "../hooks";
import { AsyncStatus } from "../components/AsyncStatus";
import { NodeSummaryList } from "../components/NodeSummaryList";

/** The `/search?q=` route. */
export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  const state = useSearch(q);
  return (
    <div className="page">
      <h1>Search: “{q}”</h1>
      {state.data ? (
        state.data.length ? (
          <NodeSummaryList items={state.data.map((r) => r.summary)} />
        ) : (
          <p>No results.</p>
        )
      ) : (
        <AsyncStatus state={state} />
      )}
    </div>
  );
}
