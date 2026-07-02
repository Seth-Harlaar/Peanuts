import { describe, expect, it } from "vitest";
import type { BaseNode, GridItem } from "../domain/types";
import { InMemoryRepository } from "./inMemoryRepository";

function grid(items: GridItem[]): BaseNode["body"] {
  return { kind: "grid", mode: "stack", columns: 12, items };
}

function node(id: string, items: GridItem[] = []): BaseNode {
  return {
    id,
    type: "concept",
    title: `Node ${id}`,
    tags: [],
    links: [],
    created: "2026-01-01T00:00:00Z",
    updated: "2026-01-01T00:00:00Z",
    body: grid(items),
  };
}

const parent = node("p", [
  { id: "i1", content: { kind: "node", nodeId: "c1" } },
  { id: "i2", content: { kind: "node", nodeId: "c2" } },
  { id: "i3", content: { kind: "block", block: { type: "paragraph", text: "see [[c1|First]]" } } },
]);

const repo = () => new InMemoryRepository([parent, node("c1"), node("c2")]);

describe("InMemoryRepository", () => {
  it("derives ordered children from child-page blocks", async () => {
    expect(await repo().getChildren("p")).toEqual(["c1", "c2"]);
  });

  it("derives the parent of a child", async () => {
    expect(await repo().getParent("c1")).toBe("p");
    expect(await repo().getParent("p")).toBeNull();
  });

  it("computes backlinks from wiki-links and child-page refs", async () => {
    expect(await repo().getBacklinks("c1")).toContain("p");
  });

  it("rejects a node claimed as a child by two parents", () => {
    const p2 = node("p2", [{ id: "x", content: { kind: "node", nodeId: "c1" } }]);
    expect(() => new InMemoryRepository([parent, node("c1"), p2])).toThrow(/child-page of both/);
  });
});
