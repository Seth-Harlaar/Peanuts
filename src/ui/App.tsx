import { useEffect, useRef, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { HomePage, NodePage, SearchPage, TagPage } from "./pages";

const MIN_WIDTH = 185; // ~2/3 of the default
const DEFAULT_WIDTH = 280;
const maxWidth = () => Math.round(window.innerWidth / 2);
const clamp = (w: number) => Math.max(MIN_WIDTH, Math.min(maxWidth(), w));

export default function App() {
  const [width, setWidth] = useState(() => {
    const saved = Number(localStorage.getItem("sidebarWidth"));
    return Number.isFinite(saved) && saved > 0 ? saved : DEFAULT_WIDTH;
  });
  const dragging = useRef(false);

  // Drag to resize.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragging.current) setWidth(clamp(e.clientX));
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    const onResize = () => setWidth((w) => clamp(w));
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Persist + clamp on mount.
  useEffect(() => {
    setWidth((w) => clamp(w));
  }, []);
  useEffect(() => {
    localStorage.setItem("sidebarWidth", String(width));
  }, [width]);

  const startDrag = () => {
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <div className="app" style={{ gridTemplateColumns: `${width}px 1fr` }}>
      <Sidebar />
      <div
        className="resizer"
        style={{ left: width }}
        onMouseDown={startDrag}
        role="separator"
        aria-orientation="vertical"
      />
      <main className="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/node/:id" element={<NodePage />} />
          <Route path="/tag/:tag" element={<TagPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </main>
    </div>
  );
}
