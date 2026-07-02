import { useEffect, useRef, useState, type RefObject } from "react";

/** Observes an element's inline size (width). See layout-spec §4b. */
export function useElementWidth<T extends HTMLElement>(): [RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(e.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

// Cell size tiers — how an item renders inside its own grid cell (layout-spec §4b).
export type CellTier = "micro" | "compact" | "cozy";
export function cellTier(width: number): CellTier {
  if (width >= 400) return "cozy";
  if (width >= 200) return "compact";
  return "micro";
}

// Page size tiers — how the whole grid reflows (layout-spec §4a / D3).
export type PageTier = "large" | "medium" | "small";
export function pageTier(width: number): PageTier {
  if (width >= 900) return "large";
  if (width >= 560) return "medium";
  return "small";
}
