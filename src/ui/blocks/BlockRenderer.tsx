import { Fragment, type ReactNode } from "react";
import type { Block } from "../../domain/types";
import type { Inline } from "../../app/viewModels";
import { parseInline } from "../../app/inlineParser";
import { useResolver } from "../context";

// --- Inline token rendering (presentation spec §4). ---
function renderInline(tokens: Inline[]): ReactNode {
  return tokens.map((t, i) => {
    switch (t.kind) {
      case "text":
        return <Fragment key={i}>{t.text}</Fragment>;
      case "bold":
        return <strong key={i}>{renderInline(t.children)}</strong>;
      case "italic":
        return <em key={i}>{renderInline(t.children)}</em>;
      case "code":
        return <code key={i}>{t.text}</code>;
      case "url":
        return (
          <a key={i} href={t.href} target="_blank" rel="noreferrer">
            {t.label}
          </a>
        );
      case "wikiLink":
        return (
          <a
            key={i}
            href={`#/node/${t.targetId}`}
            className={t.exists ? "wikilink" : "wikilink wikilink--broken"}
          >
            {t.label}
          </a>
        );
    }
  });
}

export function InlineText({ text }: { text: string }) {
  const resolver = useResolver();
  return <>{renderInline(parseInline(text, resolver))}</>;
}

// --- Block components ---
const ParagraphBlock = ({ block }: { block: Extract<Block, { type: "paragraph" }> }) => (
  <p>
    <InlineText text={block.text} />
  </p>
);

const HeadingBlock = ({ block }: { block: Extract<Block, { type: "heading" }> }) => {
  const Tag = `h${block.level}` as "h1" | "h2" | "h3";
  return (
    <Tag>
      <InlineText text={block.text} />
    </Tag>
  );
};

const CodeBlock = ({ block }: { block: Extract<Block, { type: "code" }> }) => (
  <pre className="code" data-lang={block.language}>
    <code>{block.text}</code>
  </pre>
);

const ListBlock = ({ block }: { block: Extract<Block, { type: "list" }> }) => {
  const items = block.items.map((it, i) => (
    <li key={i}>
      <InlineText text={it} />
    </li>
  ));
  return block.style === "numbered" ? <ol>{items}</ol> : <ul>{items}</ul>;
};

const QuoteBlock = ({ block }: { block: Extract<Block, { type: "quote" }> }) => (
  <blockquote>
    <InlineText text={block.text} />
  </blockquote>
);

const CalloutBlock = ({ block }: { block: Extract<Block, { type: "callout" }> }) => (
  <div className={`callout callout--${block.style}`}>
    <InlineText text={block.text} />
  </div>
);

const DividerBlock = () => <hr />;

const TableBlock = ({ block }: { block: Extract<Block, { type: "table" }> }) => (
  <table className="table">
    <thead>
      <tr>
        {block.columns.map((c) => (
          <th key={c.id}>{c.label}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {block.rows.map((row, i) => (
        <tr key={i}>
          {block.columns.map((c) => (
            <td key={c.id}>{formatCell(row[c.id], c.type)}</td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

function formatCell(value: unknown, type: string): ReactNode {
  if (value === undefined || value === null) return "";
  if (type === "checkbox") return <input type="checkbox" checked={!!value} readOnly />;
  return String(value);
}

const ImageBlock = ({ block }: { block: Extract<Block, { type: "image" }> }) => (
  <figure>
    <img src={block.path} alt={block.alt ?? block.caption ?? ""} />
    {block.caption && <figcaption>{block.caption}</figcaption>}
  </figure>
);

const FileBlock = ({ block }: { block: Extract<Block, { type: "file" }> }) => (
  <a className="file-block" href={block.path} download>
    📎 {block.filename}
    {block.size ? ` (${Math.round(block.size / 1024)} KB)` : ""}
  </a>
);

const ChecklistBlock = ({ block }: { block: Extract<Block, { type: "checklist" }> }) => (
  <ul className="checklist">
    {block.items.map((it, i) => (
      <li key={i}>
        <input type="checkbox" checked={it.checked} readOnly /> {it.text}
      </li>
    ))}
  </ul>
);

const BookmarkBlock = ({ block }: { block: Extract<Block, { type: "bookmark" }> }) => (
  <a className="bookmark" href={block.url} target="_blank" rel="noreferrer">
    <div className="bookmark__title">{block.title ?? block.url}</div>
    {block.note && <div className="bookmark__note">{block.note}</div>}
    {block.excerpt && <div className="bookmark__excerpt">“{block.excerpt}”</div>}
    <div className="bookmark__url">{block.url}</div>
  </a>
);

const UnknownBlock = ({ block }: { block: Block }) => (
  <div className="unknown-block">Unsupported block: {(block as { type: string }).type}</div>
);

// --- Registry (presentation spec §4). Add a block type → register one component. ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registry: Record<Block["type"], React.FC<{ block: any }>> = {
  paragraph: ParagraphBlock,
  heading: HeadingBlock,
  code: CodeBlock,
  list: ListBlock,
  quote: QuoteBlock,
  callout: CalloutBlock,
  divider: DividerBlock,
  table: TableBlock,
  image: ImageBlock,
  file: FileBlock,
  checklist: ChecklistBlock,
  bookmark: BookmarkBlock,
};

export function BlockRenderer({ block }: { block: Block }) {
  const C = registry[block.type] ?? UnknownBlock;
  return <C block={block} />;
}
