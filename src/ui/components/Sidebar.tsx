import { useState, type FormEvent } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, Home } from "lucide-react";
import type { PageTreeNode } from "../../app/viewModels";
import { usePageTree } from "../hooks";
import { InlineNodeView } from "./InlineNodeView";

function SearchBar() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
  };
  return (
    <form className="searchbar" onSubmit={submit}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" />
    </form>
  );
}

function PageTreeItem({ node }: { node: PageTreeNode }) {
  const [open, setOpen] = useState(false);
  const hasChildren = node.children.length > 0;
  return (
    <li>
      <div className="tree-row">
        {hasChildren ? (
          <button
            type="button"
            className="tree-toggle"
            aria-label={open ? "Collapse" : "Expand"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="tree-toggle tree-toggle--spacer" />
        )}
        <InlineNodeView summary={node.summary} />
      </div>
      {hasChildren && open && (
        <ul>
          {node.children.map((c) => (
            <PageTreeItem key={c.summary.id} node={c} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function Sidebar() {
  const pages = usePageTree();
  return (
    <aside className="sidebar">
      <Link to="/" className="sidebar__brand">
        Peanuts
      </Link>
      <SearchBar />

      <NavLink
        to="/"
        end
        className={({ isActive }) => `sidebar__home${isActive ? " sidebar__home--active" : ""}`}
      >
        <Home size={16} /> Home
      </NavLink>

      <h2>Pages</h2>
      <ul className="tree">
        {pages.data?.map((n) => (
          <PageTreeItem key={n.summary.id} node={n} />
        ))}
      </ul>
    </aside>
  );
}
