import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X } from "lucide-react";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterField {
  key: string;
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (v: string) => void;
}

export function FilterBar({
  search,
  onSearchChange,
  fields,
  onClear,
  placeholder = "Search…",
}: {
  search: string;
  onSearchChange: (v: string) => void;
  fields: FilterField[];
  onClear: () => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
      <div className="relative min-w-[220px] flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="pl-9"
        />
      </div>
      {fields.map((f) => (
        <Select key={f.key} value={f.value} onValueChange={f.onChange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={f.label} />
          </SelectTrigger>
          <SelectContent>
            {f.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
      <Button variant="ghost" size="sm" onClick={onClear}>
        <X className="mr-1 h-3.5 w-3.5" /> Clear
      </Button>
    </div>
  );
}