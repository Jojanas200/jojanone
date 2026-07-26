import Image from "next/image";

/**
 * Jojan One lockup (hexagon mark + wordmark), cropped from
 * public/assets/logo.png with a transparent background. The `.brand-logo`
 * class only adjusts the Dark theme (invert + hue-rotate) so the navy
 * wordmark stays readable. Size via `className`.
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
      src="/assets/logo-header.png"
      alt="Jojan One"
      width={680}
      height={210}
      priority={priority}
      className={`brand-logo ${className}`}
    />
  );
}
