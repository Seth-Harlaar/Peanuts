/**
 * Build step (data spec §4). Reads authored node files from data/nodes/**,
 * validates them, derives backlinks/hierarchy, and emits the static
 * "database" the app fetches at runtime into public/data/. Source subdirectories
 * are discarded — folders are a storage-only concern (spec §8).
 *
 * Run: npm run build:data
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fg from "fast-glob";
import { toSummary, type BaseNode, type NodeSummary } from "../src/domain/types";
import { childPageIds, outboundIds } from "../src/domain/references";
import { nodeSchema } from "../src/domain/schema";
import type { BacklinksIndex, HierarchyIndex } from "../src/data/repository";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");
const SRC = path.join(ROOT, "data", "nodes");
const OUT = path.join(ROOT, "public", "data");

function fail(msg: string): never {
  console.error(`✗ build-index: ${msg}`);
  process.exit(1);
}

// Globs recursively: subdirectories under data/nodes are purely a way to
// organize source files and carry NO meaning into the runtime model (spec §8).
async function loadNodes(): Promise<BaseNode[]> {
  const files = (await fg("**/*.json", { cwd: SRC })).sort(); // deterministic order
  if (files.length === 0) fail(`no node files found under ${SRC}`);

  const loaded: BaseNode[] = [];
  const seenIds = new Map<string, string>();

  for (const rel of files) {
    const abs = path.join(SRC, rel);
    let json: unknown;
    try {
      json = JSON.parse(await fs.readFile(abs, "utf8"));
    } catch (e) {
      fail(`invalid JSON in ${rel}: ${(e as Error).message}`);
    }
    const parsed = nodeSchema.safeParse(json);
    if (!parsed.success) fail(`schema error in ${rel}: ${parsed.error.issues[0]?.message}`);

    const node = parsed.data as BaseNode;
    if (seenIds.has(node.id)) fail(`duplicate id ${node.id} in ${rel} and ${seenIds.get(node.id)}`);
    seenIds.set(node.id, rel);

    // Grid-mode placements must fit within the declared column count.
    if (node.body.mode === "grid") {
      for (const item of node.body.items) {
        const p = item.placement;
        if (p && (p.colStart < 1 || p.colStart + p.colSpan - 1 > node.body.columns)) {
          fail(`item ${item.id} in ${rel} is placed outside the ${node.body.columns}-column grid`);
        }
      }
    }

    loaded.push(node);
  }
  return loaded;
}

function buildHierarchy(nodes: BaseNode[]): HierarchyIndex {
  const parentOf = new Map<string, string>();
  const childrenOf = new Map<string, string[]>();
  const ids = new Set(nodes.map((n) => n.id));

  for (const node of nodes) {
    const children = childPageIds(node);
    childrenOf.set(node.id, children);
    for (const childId of children) {
      if (!ids.has(childId)) fail(`node ${node.id} references missing child-page ${childId}`);
      if (parentOf.has(childId))
        fail(`node ${childId} is a child-page of both ${parentOf.get(childId)} and ${node.id}`);
      parentOf.set(childId, node.id);
    }
  }

  // Cycle detection over the child-page tree.
  const state = new Map<string, 0 | 1 | 2>(); // 0=unvisited implied, 1=in-stack, 2=done
  const visit = (id: string) => {
    if (state.get(id) === 1) fail(`cycle detected in child-page hierarchy at ${id}`);
    if (state.get(id) === 2) return;
    state.set(id, 1);
    for (const c of childrenOf.get(id) ?? []) visit(c);
    state.set(id, 2);
  };
  for (const node of nodes) visit(node.id);

  const index: HierarchyIndex = {};
  for (const node of nodes) {
    index[node.id] = { parent: parentOf.get(node.id) ?? null, children: childrenOf.get(node.id) ?? [] };
  }
  return index;
}

function buildBacklinks(nodes: BaseNode[]): BacklinksIndex {
  const index: BacklinksIndex = {};
  for (const node of nodes) index[node.id] = [];
  for (const node of nodes) {
    for (const target of outboundIds(node)) {
      if (target !== node.id && index[target] && !index[target].includes(node.id)) {
        index[target].push(node.id);
      }
    }
  }
  return index;
}

async function writeJson(rel: string, data: unknown): Promise<void> {
  const abs = path.join(OUT, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, JSON.stringify(data, null, 2));
}

async function main() {
  const nodes = await loadNodes();

  const summaries: NodeSummary[] = nodes.map((n) => toSummary(n));
  const hierarchy = buildHierarchy(nodes);
  const backlinks = buildBacklinks(nodes);

  // Fresh output tree.
  await fs.rm(OUT, { recursive: true, force: true });
  await writeJson("index.json", summaries);
  await writeJson("derived/hierarchy.json", hierarchy);
  await writeJson("derived/backlinks.json", backlinks);
  for (const node of nodes) await writeJson(`nodes/${node.id}.json`, node);

  console.log(`✓ build-index: ${nodes.length} nodes → public/data/`);
}

main().catch((e) => fail((e as Error).message));
