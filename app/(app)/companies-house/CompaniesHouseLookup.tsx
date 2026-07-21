"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// CH payloads are external JSON; render defensively with narrow local shapes.
type Addr = {
  address_line_1?: string;
  address_line_2?: string;
  locality?: string;
  region?: string;
  postal_code?: string;
  country?: string;
};
type Profile = {
  company_name?: string;
  company_number?: string;
  company_status?: string;
  type?: string;
  date_of_creation?: string;
  registered_office_address?: Addr;
  sic_codes?: string[];
};
type Officer = {
  name?: string;
  officer_role?: string;
  appointed_on?: string;
  resigned_on?: string;
};
type Filing = {
  date?: string;
  type?: string;
  category?: string;
  description?: string;
};

type Cached<T> = {
  data: T | null;
  fetchedAt: string | null;
  stale: boolean;
  source: "cache" | "live" | "unavailable";
};
type Lookup = {
  companyNumber: string;
  configured: boolean;
  resources: {
    profile: Cached<Profile>;
    officers: Cached<{ items?: Officer[]; total_results?: number }>;
    filing_history: Cached<{ items?: Filing[] }>;
  };
  publicUrl: string;
  filingHistoryUrl: string;
};

const fmt = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";

function SourceLabel({ c }: { c: Cached<unknown> }) {
  if (c.source === "unavailable")
    return (
      <span className="text-[11px] text-muted-foreground">
        Not available yet
      </span>
    );
  return (
    <span className="text-[11px] text-muted-foreground">
      Source: Companies House · retrieved {fmt(c.fetchedAt)}
      {c.stale && " · showing last cached copy"}
    </span>
  );
}

export function CompaniesHouseLookup({ initial }: { initial: string }) {
  const [input, setInput] = useState(initial);
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (num: string, refresh: boolean) => {
    if (!num.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/companies-house/${encodeURIComponent(num.trim())}${
          refresh ? "?refresh=1" : ""
        }`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Lookup failed");
      setLookup(data.lookup as Lookup);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (initial) run(initial, false);
  }, [initial, run]);

  const p = lookup?.resources.profile;
  const officers = lookup?.resources.officers.data?.items ?? [];
  const filings = lookup?.resources.filing_history.data?.items ?? [];
  const addr = p?.data?.registered_office_address;

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(input, false);
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="flex-1 space-y-1.5">
            <label
              htmlFor="ch-number"
              className="text-sm font-medium text-foreground"
            >
              Company number
            </label>
            <Input
              id="ch-number"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. 12345678"
              className="max-w-xs"
            />
          </div>
          <Button type="submit" disabled={busy || !input.trim()}>
            {busy ? "Looking up…" : "Look up"}
          </Button>
          {lookup && (
            <Button
              type="button"
              variant="outline"
              onClick={() => run(lookup.companyNumber, true)}
              disabled={busy}
            >
              Refresh
            </Button>
          )}
        </form>
        {lookup && !lookup.configured && (
          <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
            Live Companies House lookups aren&apos;t connected yet. Showing any
            previously cached data. Add a Companies House API key to enable live
            refresh.
          </p>
        )}
      </Card>

      {p && (
        <Card className="p-6">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {p.data?.company_name ?? "Company"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {p.data?.company_number}
                {p.data?.company_status && (
                  <>
                    {" · "}
                    <Badge variant="secondary">
                      {p.data.company_status.replace(/-/g, " ")}
                    </Badge>
                  </>
                )}
              </p>
            </div>
            <a
              href={lookup!.publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-foreground underline hover:no-underline"
            >
              View on Companies House ↗
            </a>
          </div>
          {p.data ? (
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <Row label="Type" value={p.data.type?.replace(/-/g, " ")} />
              <Row label="Incorporated" value={fmt(p.data.date_of_creation)} />
              <Row
                label="Registered office"
                value={
                  addr
                    ? [
                        addr.address_line_1,
                        addr.locality,
                        addr.postal_code,
                        addr.country,
                      ]
                        .filter(Boolean)
                        .join(", ")
                    : undefined
                }
              />
              <Row
                label="Nature of business (SIC)"
                value={p.data.sic_codes?.join(", ")}
              />
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              No profile data available.
            </p>
          )}
          <div className="mt-4">
            <SourceLabel c={p} />
          </div>
        </Card>
      )}

      {lookup && (
        <Card className="p-6">
          <h2 className="mb-3 text-base font-semibold text-foreground">
            Officers ({officers.length})
          </h2>
          {officers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No officer data available.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {officers.slice(0, 20).map((o, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span className="font-medium text-foreground">{o.name}</span>
                  <span className="text-muted-foreground">
                    {o.officer_role?.replace(/-/g, " ")}
                    {o.resigned_on
                      ? ` · resigned ${fmt(o.resigned_on)}`
                      : o.appointed_on
                        ? ` · since ${fmt(o.appointed_on)}`
                        : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <SourceLabel c={lookup.resources.officers} />
          </div>
        </Card>
      )}

      {lookup && (
        <Card className="p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">
              Filing history ({filings.length})
            </h2>
            <a
              href={lookup.filingHistoryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-foreground underline hover:no-underline"
            >
              File or view on Companies House ↗
            </a>
          </div>
          {filings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No filing history available.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {filings.slice(0, 15).map((f, i) => (
                <li key={i} className="flex gap-3 py-2 text-sm">
                  <span className="w-24 shrink-0 text-muted-foreground">
                    {fmt(f.date)}
                  </span>
                  <span className="min-w-0 flex-1 text-foreground">
                    {f.description?.replace(/-/g, " ") ?? f.type}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <SourceLabel c={lookup.resources.filing_history} />
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Jojan One does not file on your behalf. Use the Companies House link
            above to file, then record completion and evidence in the relevant
            module.
          </p>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value || "-"}</dd>
    </div>
  );
}
