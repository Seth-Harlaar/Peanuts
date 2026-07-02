import type { AsyncState } from "../hooks";

/** Renders the loading / error / empty state of an async hook. */
export function AsyncStatus({ state }: { state: AsyncState<unknown> }) {
  if (state.loading) return <p className="status">Loading…</p>;
  if (state.error) return <p className="status status--error">Error: {state.error}</p>;
  return <p className="status">Not found.</p>;
}
