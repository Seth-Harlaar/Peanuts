import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { LinkResolver } from "../app/inlineParser";
import { contentService } from "./services";

// Wiki-link resolution: loaded once, provided app-wide so InlineText can render
// links (and their broken state) without doing lookups itself.
const defaultResolver: LinkResolver = () => ({ title: "", exists: false });
const ResolverContext = createContext<LinkResolver>(defaultResolver);

export function ResolverProvider({ children }: { children: ReactNode }) {
  const [resolver, setResolver] = useState<LinkResolver>(() => defaultResolver);
  useEffect(() => {
    let active = true;
    contentService.getResolver().then((r) => active && setResolver(() => r));
    return () => {
      active = false;
    };
  }, []);
  return <ResolverContext.Provider value={resolver}>{children}</ResolverContext.Provider>;
}

export const useResolver = () => useContext(ResolverContext);
