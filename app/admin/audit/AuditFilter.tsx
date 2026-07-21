"use client";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all__";

// A single URL-param filter dropdown. Updates `param` in the query string and
// preserves the others (passed as `params` from the server page, so this needs
// no useSearchParams / Suspense boundary).
export function AuditFilter({
  param,
  label,
  options,
  value,
  params,
}: {
  param: string;
  label: string;
  options: string[];
  value: string | null;
  params: Record<string, string | undefined>;
}) {
  const router = useRouter();

  function onChange(next: string) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
    if (next === ALL) qs.delete(param);
    else qs.set(param, next);
    const str = qs.toString();
    router.replace(str ? `/admin/audit?${str}` : "/admin/audit");
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Select value={value ?? ALL} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-52">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o.replace(/[._]/g, " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
