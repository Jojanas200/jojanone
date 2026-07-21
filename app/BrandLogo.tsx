import Image from "next/image";

/**
 * Jojan One lockup (hexagon mark + wordmark). The source JPEG has a white
 * background. The `.brand-logo` class blends it into whatever theme surface it
 * sits on: multiply drops the white out on the light + Soft-UI themes, and on
 * the Dark theme it inverts + screens so the mark stays visible on dark.
 * Size via `className` (defaults to a header-height mark).
 */
export function BrandLogo({
  className = "h-8 w-auto",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/assets/logo.jpg"
      alt="Jojan One"
      width={1920}
      height={819}
      priority={priority}
      className={`brand-logo ${className}`}
    />
  );
}
