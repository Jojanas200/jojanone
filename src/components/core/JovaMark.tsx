import { cn } from "@/lib/utils";

/**
 * Jova assistant mark. A compact glyph in the Jojan One visual family
 * (rounded square, brand blue) - used as Jova's avatar and empty-state icon.
 * Purely decorative: functionality and copy are unchanged.
 */
export function JovaMark({
  className,
  size = 32,
  tone = "solid",
}: {
  className?: string;
  size?: number;
  tone?: "solid" | "soft";
}) {
  const solid = tone === "solid";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-[8px]",
        solid
          ? "bg-primary text-primary-foreground"
          : "bg-[oklch(0.955_0.05_264)] text-primary",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 24 24"
        width={Math.round(size * 0.6)}
        height={Math.round(size * 0.6)}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Stylised "J" spark - same family as the shield brand mark */}
        <path d="M14 4h3" />
        <path d="M15.5 4v10a4 4 0 0 1-4 4h-1a4 4 0 0 1-4-4" opacity="0.95" />
        <path d="M6 8.5l1.4 1.4M9.5 6l0 2M4 12h2" opacity="0.6" />
      </svg>
    </span>
  );
}