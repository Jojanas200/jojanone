import { useState, useEffect } from "react";
import { ShieldCheck } from "lucide-react";
import { useCoreData } from "@/data/store";
import { cn } from "@/lib/utils";

type Variant = "header" | "sidebar-collapsed" | "print";

const SIZE: Record<Variant, { className: string; maxHeight: number; maxWidth: number }> = {
  header: { className: "h-8 max-w-[120px]", maxHeight: 32, maxWidth: 120 },
  "sidebar-collapsed": { className: "h-8 w-8", maxHeight: 32, maxWidth: 32 },
  print: { className: "h-12 max-w-[180px]", maxHeight: 48, maxWidth: 180 },
};

export function BrandLogo({
  variant = "header",
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  const logo = useCoreData((s) => s.app_settings?.branding?.logo_data_url ?? null);
  const displayName = useCoreData(
    (s) => s.app_settings?.branding?.display_name || s.business?.name || "Jojan One",
  );
  const [errored, setErrored] = useState(false);
  useEffect(() => {
    setErrored(false);
  }, [logo]);

  const size = SIZE[variant];
  const showLogo = logo && !errored;

  if (showLogo) {
    return (
      <img
        src={logo}
        alt={`${displayName} logo`}
        onError={() => setErrored(true)}
        className={cn(size.className, "object-contain", className)}
        style={{ maxHeight: size.maxHeight, maxWidth: size.maxWidth }}
      />
    );
  }

  return (
    <div
      className={cn(
        "grid place-items-center rounded-lg bg-primary",
        variant === "print" ? "h-10 w-10" : "h-8 w-8",
        className,
      )}
      aria-label={`${displayName} logo`}
    >
      <ShieldCheck
        className={variant === "print" ? "h-6 w-6 text-primary-foreground" : "h-5 w-5 text-primary-foreground"}
        strokeWidth={2}
      />
    </div>
  );
}