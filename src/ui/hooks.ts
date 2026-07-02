import { useEffect, useState } from "react";
import type { NodeSummary } from "../domain/types";
import type { NodeView, PageTreeNode, SearchResult } from "../app/viewModels";
import { navigationService, nodeService, searchService, mutationService } from "./services";

// Minimal on-demand async binding — no caching (app spec §4). Re-runs when deps change.
export interface AsyncState<T> {
  data?: T;
  loading: boolean;
  error?: string;
}

function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ loading: true });
  useEffect(() => {
    let active = true;
    setState({ loading: true });
    fn().then(
      (data) => active && setState({ data, loading: false }),
      (e: unknown) => active && setState({ loading: false, error: (e as Error).message }),
    );
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

export const useNodeView = (id: string): AsyncState<NodeView | null> =>
  useAsync(() => nodeService.getNodeView(id), [id]);

export const usePageTree = (): AsyncState<PageTreeNode[]> =>
  useAsync(() => navigationService.getPageTree(), []);

export const useHomepage = (): AsyncState<string | null> =>
  useAsync(() => navigationService.getHomepageId(), []);

export const useSearch = (query: string): AsyncState<SearchResult[]> =>
  useAsync(() => searchService.search(query), [query]);

export const useTag = (tag: string): AsyncState<NodeSummary[]> =>
  useAsync(() => searchService.filterByTag(tag), [tag]);

export const useMutations = () => mutationService;
