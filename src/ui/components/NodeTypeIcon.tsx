import {
  Bookmark,
  BookOpen,
  File,
  FileText,
  Lightbulb,
  StickyNote,
  Table,
  type LucideIcon,
} from "lucide-react";
import type { NodeType } from "../../domain/types";

const ICONS: Record<NodeType, LucideIcon> = {
  tidbit: StickyNote,
  "doc-summary": FileText,
  guide: BookOpen,
  concept: Lightbulb,
  reference: Table,
  resource: Bookmark,
  other: File,
};

/** The icon representing a node's type. Single source for type iconography. */
export function NodeTypeIcon({
  type,
  size = 16,
  className,
}: {
  type: NodeType;
  size?: number;
  className?: string;
}) {
  const Icon = ICONS[type] ?? File;
  return <Icon size={size} className={className} />;
}
