"use client";
// Shared building blocks for the module "board" pages (Contracts, Compliance,
// Risk, HR, Governance, GDPR): stat tiles, a search box, filter selects, and the
// labelled field/input primitives used inside detail + edit drawers. Kept in a
// private folder (underscore prefix) so it is never treated as a route.
import { Search, SlidersHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { nice } from "./format";

export function StatTiles({
  tiles,
}: {
  tiles: { label: string; value: string }[];
}) {
  const cols =
    tiles.length >= 6
      ? "sm:grid-cols-3 lg:grid-cols-6"
      : tiles.length === 5
        ? "sm:grid-cols-3 lg:grid-cols-5"
        : "sm:grid-cols-4";
  return (
    <div className={`mb-6 grid grid-cols-2 gap-3 ${cols}`}>
      {tiles.map((t) => (
        <Card key={t.label} className="p-4">
          <p className="text-xl font-semibold text-foreground">{t.value}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t.label}</p>
        </Card>
      ))}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
        aria-label={placeholder}
      />
    </div>
  );
}

export function FilterIcon() {
  return <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />;
}

export function FilterSelect({
  value,
  onChange,
  allLabel,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  allLabel: string;
  options: { value: string; label: string }[] | string[];
}) {
  const opts = options.map((o) =>
    typeof o === "string" ? { value: o, label: nice(o) } : o,
  );
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-auto min-w-36 text-xs capitalize">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {opts.map((o) => (
          <SelectItem key={o.value} value={o.value} className="capitalize">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{children}</dd>
    </div>
  );
}

export function Block({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-foreground">{body}</p>
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function AreaField({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[] | string[];
}) {
  const opts = options.map((o) =>
    typeof o === "string" ? { value: o, label: nice(o) } : o,
  );
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="capitalize">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {opts.map((o) => (
            <SelectItem key={o.value} value={o.value} className="capitalize">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function SwitchField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
      <div>
        <Label>{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={(v) => onChange(v === true)} />
    </div>
  );
}

// Client-side pagination controls for the register tables. Renders nothing
// when everything fits on one page, so small workspaces never see it.
export function Pager({
  page,
  pageCount,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  if (pageCount <= 1) return null;
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="mt-3 flex items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">
        Showing {from}-{to} of {total}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={page === 0}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </Button>
        <span className="px-2 text-xs text-muted-foreground">
          {page + 1} / {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={page >= pageCount - 1}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
