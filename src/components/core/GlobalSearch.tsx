import { useMemo, useState, useRef, useEffect } from "react";
import { Search } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useCoreData } from "@/data/store";
import { MODULES } from "@/config/modules.config";
import { COURSES } from "@/data/academy-catalog";
import { cn } from "@/lib/utils";

interface Hit {
  id: string;
  group: string;
  title: string;
  subtitle?: string;
  onSelect: () => void;
}

export function GlobalSearch() {
  const state = useCoreData((s) => s);
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const hits = useMemo<Hit[]>(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    const out: Hit[] = [];
    state.activities
      .filter((a) => a.title.toLowerCase().includes(query) || a.description.toLowerCase().includes(query))
      .slice(0, 5)
      .forEach((a) =>
        out.push({
          id: `act-${a.id}`,
          group: "Activities",
          title: a.title,
          subtitle: MODULES.find((m) => m.key === a.module)?.title,
          onSelect: () => navigate({ to: "/timeline", search: { a: a.id } }),
        }),
      );
    state.reports
      .filter((r) => r.title.toLowerCase().includes(query) || r.summary.toLowerCase().includes(query))
      .slice(0, 5)
      .forEach((r) =>
        out.push({
          id: `rep-${r.id}`,
          group: "Reports",
          title: r.title,
          subtitle: r.reporting_period,
          onSelect: () => navigate({ to: "/reports", search: { r: r.id } }),
        }),
      );
    state.conversations
      .filter((c) => c.title.toLowerCase().includes(query))
      .slice(0, 5)
      .forEach((c) =>
        out.push({
          id: `conv-${c.id}`,
          group: "Jova conversations",
          title: c.title,
          onSelect: () => navigate({ to: "/jova", search: { c: c.id } }),
        }),
      );
    state.scenario_runs
      .filter((r) => r.scenario_name.toLowerCase().includes(query))
      .slice(0, 5)
      .forEach((r) =>
        out.push({
          id: `scn-${r.id}`,
          group: "Scenarios",
          title: r.scenario_name,
          subtitle: r.result.summary,
          onSelect: () => navigate({ to: "/simulator", search: { s: r.id } }),
        }),
      );
    state.business_entities
      .filter((e) => e.name.toLowerCase().includes(query) || e.relationship.toLowerCase().includes(query))
      .slice(0, 5)
      .forEach((e) =>
        out.push({
          id: `ent-${e.id}`,
          group: "Relationships",
          title: e.name,
          subtitle: e.relationship,
          onSelect: () => navigate({ to: "/business-map", search: { e: e.id } }),
        }),
      );
    state.contracts
      .filter((c) => c.title.toLowerCase().includes(query) || c.counterparty.toLowerCase().includes(query))
      .slice(0, 5)
      .forEach((c) =>
        out.push({
          id: `ctr-${c.id}`,
          group: "Contracts",
          title: c.title,
          subtitle: c.counterparty,
          onSelect: () => navigate({ to: "/contracts", search: { c: c.id } }),
        }),
      );
    state.employees
      .filter((e) => e.full_name.toLowerCase().includes(query) || e.job_title.toLowerCase().includes(query))
      .slice(0, 5)
      .forEach((e) =>
        out.push({
          id: `emp-${e.id}`,
          group: "People",
          title: e.full_name,
          subtitle: e.job_title,
          onSelect: () => navigate({ to: "/hr", search: { e: e.id } }),
        }),
      );
    state.hr_actions
      .filter((a) => a.title.toLowerCase().includes(query))
      .slice(0, 5)
      .forEach((a) =>
        out.push({
          id: `hra-${a.id}`,
          group: "HR actions",
          title: a.title,
          subtitle: a.description,
          onSelect: () => navigate({ to: "/hr", search: { a: a.id } }),
        }),
      );
    state.compliance_obligations
      .filter((o) => o.title.toLowerCase().includes(query) || o.regulator.toLowerCase().includes(query))
      .slice(0, 5)
      .forEach((o) =>
        out.push({
          id: `obl-${o.id}`,
          group: "Compliance",
          title: o.title,
          subtitle: o.regulator,
          onSelect: () => navigate({ to: "/compliance", search: { o: o.id } }),
        }),
      );
    state.compliance_evidence
      .filter((e) => e.title.toLowerCase().includes(query))
      .slice(0, 5)
      .forEach((e) =>
        out.push({
          id: `evi-${e.id}`,
          group: "Evidence",
          title: e.title,
          subtitle: e.reference,
          onSelect: () => navigate({ to: "/compliance", search: { o: e.obligation_id } }),
        }),
      );
    state.processing_activities
      .filter((p) => p.activity_name.toLowerCase().includes(query))
      .slice(0, 5)
      .forEach((p) =>
        out.push({
          id: `pa-${p.id}`,
          group: "Processing activities",
          title: p.activity_name,
          subtitle: p.business_purpose,
          onSelect: () => navigate({ to: "/gdpr", search: { pa: p.id } }),
        }),
      );
    state.data_requests
      .filter((r) => r.requester_reference.toLowerCase().includes(query))
      .slice(0, 5)
      .forEach((r) =>
        out.push({
          id: `dr-${r.id}`,
          group: "Data requests",
          title: r.requester_reference,
          subtitle: r.request_type,
          onSelect: () => navigate({ to: "/gdpr", search: { dr: r.id } }),
        }),
      );
    state.data_breaches
      .filter((b) => b.title.toLowerCase().includes(query))
      .slice(0, 5)
      .forEach((b) =>
        out.push({
          id: `brk-${b.id}`,
          group: "Breaches",
          title: b.title,
          subtitle: b.status,
          onSelect: () => navigate({ to: "/gdpr", search: { br: b.id } }),
        }),
      );
    state.dpias
      .filter((d) => d.title.toLowerCase().includes(query))
      .slice(0, 5)
      .forEach((d) =>
        out.push({
          id: `dpia-${d.id}`,
          group: "DPIAs",
          title: d.title,
          subtitle: d.project,
          onSelect: () => navigate({ to: "/gdpr", search: { dpia: d.id } }),
        }),
      );
    state.governance_records
      .filter((g) => g.title.toLowerCase().includes(query))
      .slice(0, 5)
      .forEach((g) =>
        out.push({
          id: `gov-${g.id}`,
          group: "Governance",
          title: g.title,
          subtitle: g.record_type,
          onSelect: () => navigate({ to: "/governance", search: { g: g.id } }),
        }),
      );
    state.policies
      .filter((p) => p.policy_name.toLowerCase().includes(query))
      .slice(0, 5)
      .forEach((p) =>
        out.push({
          id: `pol-${p.id}`,
          group: "Policies",
          title: p.policy_name,
          subtitle: `v${p.version} - ${p.status}`,
          onSelect: () => navigate({ to: "/governance", search: { p: p.id } }),
        }),
      );
    state.risks
      .filter((r) => r.risk_title.toLowerCase().includes(query))
      .slice(0, 5)
      .forEach((r) =>
        out.push({
          id: `risk-${r.id}`,
          group: "Risks",
          title: r.risk_title,
          subtitle: `${r.risk_category} • ${r.residual_rating}`,
          onSelect: () => navigate({ to: "/risk", search: { r: r.id } }),
        }),
      );
    state.investor_profiles
      .filter((p) => p.funding_stage.includes(query) || p.funding_purpose.toLowerCase().includes(query))
      .slice(0, 3)
      .forEach((p) =>
        out.push({
          id: `ip-${p.id}`,
          group: "Funding profile",
          title: `${p.funding_stage} - ${p.currency} ${p.amount_sought.toLocaleString()}`,
          subtitle: p.status,
          onSelect: () => navigate({ to: "/investor-ready" }),
        }),
      );
    state.due_diligence_items
      .filter((i) => i.title.toLowerCase().includes(query) || i.description.toLowerCase().includes(query))
      .slice(0, 5)
      .forEach((i) =>
        out.push({
          id: `dd-${i.id}`,
          group: "Due diligence",
          title: i.title,
          subtitle: `${i.category} • ${i.status}`,
          onSelect: () => navigate({ to: "/investor-ready", search: { dd: i.id } }),
        }),
      );
    state.data_room_items
      .filter((i) => i.title.toLowerCase().includes(query))
      .slice(0, 5)
      .forEach((i) =>
        out.push({
          id: `dri-${i.id}`,
          group: "Data room",
          title: i.title,
          subtitle: `${i.folder} • ${i.status}`,
          onSelect: () => navigate({ to: "/investor-ready", search: { dr: i.id } }),
        }),
      );
    state.tender_opportunities
      .filter((o) => o.title.toLowerCase().includes(query) || o.authority.toLowerCase().includes(query))
      .slice(0, 5)
      .forEach((o) =>
        out.push({
          id: `opp-${o.id}`,
          group: "Tender opportunities",
          title: o.title,
          subtitle: `${o.authority} • ${o.status}`,
          onSelect: () => navigate({ to: "/tender-ready", search: { o: o.id } }),
        }),
      );
    state.tender_requirements
      .filter((r) => r.title.toLowerCase().includes(query))
      .slice(0, 5)
      .forEach((r) => {
        const op = state.tender_opportunities.find((x) => x.id === r.opportunity_id);
        out.push({
          id: `treq-${r.id}`,
          group: "Tender requirements",
          title: r.title,
          subtitle: op?.title,
          onSelect: () => navigate({ to: "/tender-ready", search: { o: r.opportunity_id } }),
        });
      });
    state.tender_responses
      .filter((r) => r.section_title.toLowerCase().includes(query) || r.question.toLowerCase().includes(query))
      .slice(0, 5)
      .forEach((r) =>
        out.push({
          id: `tresp-${r.id}`,
          group: "Tender responses",
          title: r.section_title,
          subtitle: r.status,
          onSelect: () => navigate({ to: "/tender-ready", search: { o: r.opportunity_id } }),
        }),
      );
    state.evidence_library_items
      .filter((e) => e.title.toLowerCase().includes(query))
      .slice(0, 5)
      .forEach((e) =>
        out.push({
          id: `evl-${e.id}`,
          group: "Evidence library",
          title: e.title,
          subtitle: `${e.category} • ${e.status}`,
          onSelect: () => navigate({ to: "/tender-ready" }),
        }),
      );
    COURSES.filter(
      (c) =>
        c.title.toLowerCase().includes(query) ||
        c.category.toLowerCase().includes(query) ||
        c.tags.some((t) => t.includes(query)),
    )
      .slice(0, 5)
      .forEach((c) =>
        out.push({
          id: `crs-${c.id}`,
          group: "Academy courses",
          title: c.title,
          subtitle: `${c.category} • ${c.duration_minutes} min`,
          onSelect: () => navigate({ to: "/academy", search: { c: c.id } }),
        }),
      );
    state.academy_certificates
      .filter((c) => c.course_title.toLowerCase().includes(query) || c.reference.toLowerCase().includes(query))
      .slice(0, 5)
      .forEach((c) =>
        out.push({
          id: `cert-${c.id}`,
          group: "Certificates",
          title: c.course_title,
          subtitle: `${c.learner_name} • ${c.reference}`,
          onSelect: () => navigate({ to: "/academy", search: { cert: c.id, tab: "certificates" } }),
        }),
      );
    MODULES.filter((m) => m.title.toLowerCase().includes(query))
      .slice(0, 5)
      .forEach((m) =>
        out.push({
          id: `mod-${m.key}`,
          group: "Modules",
          title: m.title,
          subtitle: m.tagline,
          onSelect: () => navigate({ to: m.route as never }),
        }),
      );
    const settingsSections: Array<{ key: string; label: string; desc: string }> = [
      { key: "business", label: "Business Profile", desc: "Identity, operation and regional preferences" },
      { key: "access", label: "Users & Access", desc: "Prototype users, roles and permissions" },
      { key: "jova", label: "Jova Settings", desc: "Communication style, briefing and safeguards" },
      { key: "notifications", label: "Notifications", desc: "Channels, categories and quiet hours" },
      { key: "display", label: "Display & Accessibility", desc: "Appearance, density and readability" },
      { key: "documents", label: "Reports & Documents", desc: "Report, document and certificate defaults" },
      { key: "data", label: "Data Management", desc: "Backup, import and reset" },
      { key: "audit", label: "Audit Log", desc: "Administrative history" },
      { key: "system", label: "System Information", desc: "Environment, connections and checks" },
    ];
    settingsSections
      .filter((s) => s.label.toLowerCase().includes(query) || s.desc.toLowerCase().includes(query) || "settings".includes(query))
      .slice(0, 6)
      .forEach((s) =>
        out.push({
          id: `set-${s.key}`,
          group: "Settings",
          title: s.label,
          subtitle: s.desc,
          onSelect: () => navigate({ to: "/settings", search: { section: s.key } }),
        }),
      );
    return out;
  }, [q, state, navigate]);

  const grouped = useMemo(() => {
    const map = new Map<string, Hit[]>();
    hits.forEach((h) => {
      const arr = map.get(h.group) ?? [];
      arr.push(h);
      map.set(h.group, arr);
    });
    return Array.from(map.entries());
  }, [hits]);

  return (
    <div ref={containerRef} className="relative w-full">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search Jojan One…"
        className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
      />
      {open && q.trim() && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[420px] overflow-y-auto rounded-md border border-border bg-background shadow-lg">
          {grouped.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px] text-muted-foreground">No results.</div>
          ) : (
            grouped.map(([group, items]) => (
              <div key={group} className="border-b border-border last:border-b-0">
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group}
                </div>
                {items.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => {
                      h.onSelect();
                      setOpen(false);
                      setQ("");
                    }}
                    className={cn(
                      "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-accent",
                    )}
                  >
                    <span className="text-[13px] font-medium text-foreground">{h.title}</span>
                    {h.subtitle && <span className="text-[11px] text-muted-foreground">{h.subtitle}</span>}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}