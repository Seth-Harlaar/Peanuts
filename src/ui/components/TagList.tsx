import { Link } from "react-router-dom";

/** A row of tag chips linking to their tag pages. */
export function TagList({ tags, className = "tags" }: { tags: string[]; className?: string }) {
  if (tags.length === 0) return null;
  return (
    <div className={className}>
      {tags.map((t) => (
        <Link key={t} className="tag" to={`/tag/${encodeURIComponent(t)}`}>
          #{t}
        </Link>
      ))}
    </div>
  );
}
