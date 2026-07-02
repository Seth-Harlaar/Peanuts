// Composition root: the single place an implementation is chosen. Swapping to
// a DbRepository later is a one-line change here (data spec §3).
import { StaticFileRepository } from "../data/staticFileRepository";
import {
  ContentService,
  MutationService,
  NavigationService,
  NodeService,
  SearchService,
} from "../app/services";

const repo = new StaticFileRepository();

export const nodeService = new NodeService(repo);
export const navigationService = new NavigationService(repo);
export const searchService = new SearchService(repo);
export const contentService = new ContentService(repo);
export const mutationService = new MutationService(repo, /* canWrite */ false);
