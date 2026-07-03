// Composition root: the single place a repository implementation is wired in
// (data spec §3). The app runs against Supabase.
import { SupabaseRepository } from "../data/supabaseRepository";
import { isAuthenticated } from "../data/supabaseClient";
import {
  ContentService,
  MutationService,
  NavigationService,
  NodeService,
  SearchService,
} from "../app/services";

const repo = new SupabaseRepository();

export const nodeService = new NodeService(repo);
export const navigationService = new NavigationService(repo);
export const searchService = new SearchService(repo);
export const contentService = new ContentService(repo);

// Writes are allowed whenever a user is signed in (Row Level Security enforces
// this server-side regardless).
export const mutationService = new MutationService(repo, isAuthenticated);
