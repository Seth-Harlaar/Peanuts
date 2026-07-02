import { z } from "zod";

// Runtime validation of node files (data spec §6). Kept structurally in sync
// with types.ts; the build step uses it to reject malformed hand-authored data.

const tableColumn = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(["text", "number", "date", "checkbox", "tag", "link"]),
});

const tableCell = z.union([z.string(), z.number(), z.boolean()]);

export const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("paragraph"), text: z.string() }),
  z.object({ type: z.literal("heading"), level: z.union([z.literal(1), z.literal(2), z.literal(3)]), text: z.string() }),
  z.object({ type: z.literal("code"), language: z.string(), text: z.string() }),
  z.object({ type: z.literal("list"), style: z.enum(["bullet", "numbered"]), items: z.array(z.string()) }),
  z.object({ type: z.literal("quote"), text: z.string() }),
  z.object({ type: z.literal("callout"), style: z.enum(["info", "warning", "success"]), text: z.string() }),
  z.object({ type: z.literal("divider") }),
  z.object({ type: z.literal("table"), columns: z.array(tableColumn), rows: z.array(z.record(tableCell)) }),
  z.object({ type: z.literal("image"), path: z.string(), caption: z.string().optional(), alt: z.string().optional() }),
  z.object({ type: z.literal("file"), filename: z.string(), path: z.string(), mimeType: z.string(), size: z.number().optional() }),
  z.object({ type: z.literal("checklist"), items: z.array(z.object({ text: z.string(), checked: z.boolean() })) }),
  z.object({ type: z.literal("bookmark"), url: z.string(), title: z.string().optional(), note: z.string().optional(), excerpt: z.string().optional(), favicon: z.string().optional() }),
]);

const placementSchema = z.object({
  colStart: z.number().int().positive(),
  colSpan: z.number().int().positive(),
  rowStart: z.number().int().positive().optional(),
  rowSpan: z.number().int().positive().optional(),
});

const gridItemSchema = z.object({
  id: z.string(),
  content: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("block"), block: blockSchema }),
    z.object({ kind: z.literal("node"), nodeId: z.string().uuid() }),
  ]),
  placement: placementSchema.optional(),
});

const gridBodySchema = z.object({
  kind: z.literal("grid"),
  mode: z.enum(["grid", "stack"]),
  columns: z.number().int().positive(),
  rowHeight: z.union([z.number(), z.literal("auto")]).optional(),
  gap: z.number().optional(),
  items: z.array(gridItemSchema),
});

export const nodeSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["tidbit", "doc-summary", "guide", "concept", "reference", "resource", "other"]),
  title: z.string(),
  tags: z.array(z.string()),
  links: z.array(z.string()),
  created: z.string(),
  updated: z.string(),
  source: z.string().optional(),
  archived: z.boolean().optional(),
  body: gridBodySchema,
});
