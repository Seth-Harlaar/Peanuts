import { describe, expect, it } from "vitest";
import { parseInline } from "./inlineParser";

// Wiki-link targets are GUIDs — the parser only matches hex/dash ids by design.
const KNOWN = "abc123";
const MISSING = "def456";
const resolve = (id: string) =>
  id === KNOWN ? { title: "Known Node", exists: true } : { title: "", exists: false };

describe("parseInline", () => {
  it("parses plain text", () => {
    expect(parseInline("hello world", resolve)).toEqual([{ kind: "text", text: "hello world" }]);
  });

  it("parses bold, italic, and code", () => {
    const out = parseInline("a **b** c *d* `e`", resolve);
    expect(out.map((t) => t.kind)).toEqual(["text", "bold", "text", "italic", "text", "code"]);
  });

  it("resolves a known wiki-link with a display label", () => {
    const [token] = parseInline(`[[${KNOWN}|My Label]]`, resolve);
    expect(token).toEqual({ kind: "wikiLink", targetId: KNOWN, label: "My Label", exists: true });
  });

  it("falls back to the resolved title when no label is given", () => {
    const [token] = parseInline(`[[${KNOWN}]]`, resolve);
    expect(token).toMatchObject({ kind: "wikiLink", label: "Known Node", exists: true });
  });

  it("marks an unknown wiki-link as broken", () => {
    const [token] = parseInline(`[[${MISSING}|X]]`, resolve);
    expect(token).toMatchObject({ kind: "wikiLink", exists: false });
  });

  it("parses an external markdown link", () => {
    const [token] = parseInline("[site](https://x.com)", resolve);
    expect(token).toEqual({ kind: "url", label: "site", href: "https://x.com" });
  });
});
