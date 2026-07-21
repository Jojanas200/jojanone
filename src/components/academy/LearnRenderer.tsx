import type { ReactNode } from "react";

/**
 * Very small markdown-lite renderer for lesson `learn` content.
 * Supports:
 *   **bold text**
 *   blank-line paragraph breaks
 *   lines beginning with "- " render as bullets
 */
export function LearnRenderer({ content }: { content: string }) {
  const blocks = content.split(/\n\n+/);
  return (
    <div className="space-y-3 text-[14px] leading-relaxed text-foreground">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        const isBulletBlock = lines.every((l) => l.trim().startsWith("- "));
        if (isBulletBlock) {
          return (
            <ul key={i} className="ml-5 list-disc space-y-1">
              {lines.map((l, j) => (
                <li key={j}>{renderInline(l.replace(/^-\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {renderInline(block)}
          </p>
        );
      })}
    </div>
  );
}

function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (/^\*\*.+\*\*$/.test(p)) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {p.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{p}</span>;
  });
}