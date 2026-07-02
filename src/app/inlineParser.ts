import type { Inline } from "./viewModels";

// Resolves a wiki-link target GUID to a current title + existence.
export type LinkResolver = (targetId: string) => { title: string; exists: boolean };

// Ordered inline grammar (markdown-lite, spec §3). First match wins at each position.
const RULES: { kind: string; re: RegExp }[] = [
  { kind: "wikiLink", re: /\[\[([0-9a-fA-F-]+)(?:\|([^\]]*))?\]\]/y },
  { kind: "url", re: /\[([^\]]+)\]\(([^)]+)\)/y },
  { kind: "bold", re: /\*\*([^*]+)\*\*/y },
  { kind: "italic", re: /\*([^*]+)\*/y },
  { kind: "code", re: /`([^`]+)`/y },
];

/**
 * Parse markdown-lite text into an inline token model, resolving wiki-links.
 * A small hand-written scanner — no markdown engine shipped to the browser.
 */
export function parseInline(text: string, resolve: LinkResolver): Inline[] {
  const out: Inline[] = [];
  let i = 0;
  let plainStart = 0;

  const flushPlain = (end: number) => {
    if (end > plainStart) out.push({ kind: "text", text: text.slice(plainStart, end) });
  };

  while (i < text.length) {
    let matched = false;
    for (const rule of RULES) {
      rule.re.lastIndex = i;
      const m = rule.re.exec(text);
      if (!m) continue;
      flushPlain(i);
      switch (rule.kind) {
        case "wikiLink": {
          const targetId = m[1];
          const resolved = resolve(targetId);
          out.push({
            kind: "wikiLink",
            targetId,
            label: m[2]?.trim() || resolved.title || targetId,
            exists: resolved.exists,
          });
          break;
        }
        case "url":
          out.push({ kind: "url", label: m[1], href: m[2] });
          break;
        case "bold":
          out.push({ kind: "bold", children: parseInline(m[1], resolve) });
          break;
        case "italic":
          out.push({ kind: "italic", children: parseInline(m[1], resolve) });
          break;
        case "code":
          out.push({ kind: "code", text: m[1] });
          break;
      }
      i += m[0].length;
      plainStart = i;
      matched = true;
      break;
    }
    if (!matched) i++;
  }
  flushPlain(text.length);
  return out;
}
