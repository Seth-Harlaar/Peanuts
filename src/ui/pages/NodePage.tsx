import { useParams } from "react-router-dom";
import { NodeById } from "./NodeById";

/** The `/node/:id` route. */
export function NodePage() {
  const { id = "" } = useParams();
  return <NodeById id={id} />;
}
