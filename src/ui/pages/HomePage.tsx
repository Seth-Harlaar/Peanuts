import { useHomepage } from "../hooks";
import { AsyncStatus } from "../components/AsyncStatus";
import { NodeById } from "./NodeById";

/** The `/` route: the selected homepage, or the first page found (app spec). */
export function HomePage() {
  const home = useHomepage();
  if (home.loading || home.error) return <AsyncStatus state={home} />;
  if (!home.data) {
    return (
      <div className="page">
        <h1>Knowledge Base</h1>
        <p>No pages yet.</p>
      </div>
    );
  }
  return <NodeById id={home.data} />;
}
