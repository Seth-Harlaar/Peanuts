import { Link } from "react-router-dom";
import type { NodeSummary } from "../../domain/types";

export function Breadcrumbs({ trail }: { trail: NodeSummary[] }) {
  if (trail.length === 0) return null;
  return (
    <nav className="breadcrumbs">
      {trail.map((s) => (
        <span key={s.id}>
          <Link to={`/node/${s.id}`}>{s.title}</Link>
          <span className="breadcrumbs__sep">/</span>
        </span>
      ))}
    </nav>
  );
}
