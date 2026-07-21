import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Settings as SettingsIcon,
  Building2,
  Users,
  Sparkles,
  Bell,
  Palette,
  FileText,
  Database,
  History,
  Info,
  Shield,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Download,
  Upload,
  RotateCcw,
  Trash2,
  Printer,
  Copy,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/core/ConfirmDialog";
import { BrandLogo } from "@/components/core/BrandLogo";
import { BillingSection } from "@/components/billing/BillingSection";
import {
  useCoreData,
  updateAppSettings,
  updateBusinessProfile,
  logAuditEvent,
  inviteAppUser,
  resendUserInvite,
  setUserRole,
  setUserStatus,
  exportBackup,
  importBackup,
  validateBackup,
  resetSettingsOnly,
  resetDemoNotifications,
  resetJovaConversations,
  resetAcademyProgress,
  resetAllPrototypeData,
  runSystemChecks,
  pushNotification,
} from "@/data/store";
import {
  NOTIFICATION_CATEGORIES,
  PERMISSIONS_MATRIX,
  ROLE_LABELS,
  SAFE_BRAND_PALETTE,
  SUPPORT_TYPES,
  type AppRole,
  type NotificationTiming,
  type SettingsSectionKey,
} from "@/data/settings-types";
import { generateJovaReply, SUGGESTED_PROMPTS as _SP } from "@/data/jova-engine";
import { formatDate } from "@/data/selectors";

void _SP;

const SECTIONS: Array<{ key: SettingsSectionKey; label: string; icon: typeof Building2; desc: string }> = [
  { key: "business", label: "Business Profile", icon: Building2, desc: "Identity, operation and regional preferences." },
  { key: "access", label: "Users & Access", icon: Users, desc: "Prototype users, roles and permissions." },
  { key: "jova", label: "Jova", icon: Sparkles, desc: "Communication style, briefing and safeguards." },
  { key: "notifications", label: "Notifications", icon: Bell, desc: "Channels, categories and quiet hours." },
  { key: "display", label: "Display & Accessibility", icon: Palette, desc: "Appearance, density and readability." },
  { key: "documents", label: "Reports & Documents", icon: FileText, desc: "Report, document and certificate defaults." },
  { key: "data", label: "Data Management", icon: Database, desc: "Backup, import and reset." },
  { key: "audit", label: "Audit Log", icon: History, desc: "Administrative history." },
  { key: "billing", label: "Plans & Billing", icon: CreditCard, desc: "Prototype subscription and billing preferences." },
  { key: "system", label: "System Information", icon: Info, desc: "Environment, connections and checks." },
];

const VALID_SECTIONS = new Set<string>(SECTIONS.map((s) => s.key));

export const Route = createFileRoute("/settings")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    section: typeof s.section === "string" ? s.section : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Settings - Jojan One" },
      { name: "description", content: "Manage your business profile, users, Jova preferences, notifications, data and system information for Jojan One." },
      { property: "og:title", content: "Settings - Jojan One" },
      { property: "og:description", content: "Manage your business profile, users, Jova preferences and Jojan One data." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const rawSection = search.section && VALID_SECTIONS.has(search.section) ? (search.section as SettingsSectionKey) : "business";
  const settings = useCoreData((s) => s.app_settings);

  const goSection = (key: SettingsSectionKey) => {
    navigate({ to: "/settings", search: { section: key }, replace: true });
  };

  const savedAt = new Date(settings.last_saved_at);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 lg:py-8">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-3 border-b border-border pb-6 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent">
              <SettingsIcon className="h-5 w-5 text-primary" strokeWidth={1.75} />
            </div>
            <div>
              <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Settings</h1>
              <p className="mt-1 max-w-2xl text-[14px] text-muted-foreground">
                Manage your business profile, preferences, access and Jojan One data.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-1 md:items-end">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> Saved
            </span>
            <span className="text-[12px] text-muted-foreground">Last saved {savedAt.toLocaleString()} by {settings.last_saved_by}</span>
          </div>
        </header>

        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          <strong>Prototype notice.</strong> Jojan One is currently a functional prototype. Settings demonstrate intended product behaviour, but production authentication, permissions, secure database storage, encrypted backups, external integrations and server-side audit controls are not yet connected.
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
          {/* Desktop side nav */}
          <aside className="hidden lg:block">
            <nav aria-label="Settings sections" className="sticky top-20 flex flex-col gap-1">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                const active = s.key === rawSection;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => goSection(s.key)}
                    aria-current={active ? "page" : undefined}
                    className={
                      "flex items-start gap-2 rounded-md px-3 py-2 text-left text-[13.5px] transition-colors " +
                      (active
                        ? "bg-accent text-primary"
                        : "text-foreground/80 hover:bg-accent/60 hover:text-foreground")
                    }
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="flex flex-col">
                      <span className="font-medium">{s.label}</span>
                      <span className="text-[11.5px] text-muted-foreground">{s.desc}</span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Mobile section picker */}
          <div className="lg:hidden">
            <Label htmlFor="settings-section" className="text-[12px] text-muted-foreground">Section</Label>
            <Select value={rawSection} onValueChange={(v) => goSection(v as SettingsSectionKey)}>
              <SelectTrigger id="settings-section" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SECTIONS.map((s) => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <main>
            {rawSection === "business" && <BusinessProfileSection />}
            {rawSection === "access" && <UsersAccessSection />}
            {rawSection === "jova" && <JovaSection />}
            {rawSection === "notifications" && <NotificationsSection />}
            {rawSection === "display" && <DisplaySection />}
            {rawSection === "documents" && <DocumentsSection />}
            {rawSection === "data" && <DataSection />}
            {rawSection === "audit" && <AuditLogSection />}
            {rawSection === "billing" && <BillingSection />}
            {rawSection === "system" && <SystemSection />}
          </main>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Shared UI helpers
// ============================================================

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-[18px] font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="mt-1 text-[13.5px] text-muted-foreground">{description}</p>
    </div>
  );
}

function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-[12.5px] font-medium text-foreground/90">{label}</Label>
      {children}
      {hint && <p className="text-[11.5px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange, disabled, locked }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; locked?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[13.5px] font-medium text-foreground">{label}</p>
          {locked && <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700"><Lock className="h-3 w-3" />Locked</span>}
        </div>
        {description && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{description}</p>}
        {locked && <p className="mt-0.5 text-[11.5px] text-muted-foreground">{locked}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled || !!locked} aria-label={label} />
    </div>
  );
}

function NotConnectedPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
      <AlertTriangle className="h-3 w-3" /> Not connected in this prototype
    </span>
  );
}

// ============================================================
// Business Profile
// ============================================================

function BusinessProfileSection() {
  const settings = useCoreData((s) => s.app_settings);
  const businessProfile = useCoreData((s) => s.business_profile);
  const employees = useCoreData((s) => s.employees);
  const [draft, setDraft] = useState({
    ...settings.business_extras,
    business_name: businessProfile.business_name,
    company_number: businessProfile.company_number,
    business_type: businessProfile.business_type,
    industry: businessProfile.industry,
    incorporation_date: businessProfile.incorporation_date,
    registered_address: businessProfile.registered_address,
    employee_count: businessProfile.employee_count,
    contractor_count: businessProfile.contractor_count,
    vat_registered: businessProfile.vat_registered,
    trades_internationally: businessProfile.trades_internationally,
  });
  const [ops, setOps] = useState(settings.operations);
  const [regional, setRegional] = useState(settings.regional);
  const [branding, setBranding] = useState(settings.branding);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const set = <K extends keyof typeof draft>(k: K, v: typeof draft[K]) => { setDraft((d) => ({ ...d, [k]: v })); setDirty(true); };
  const setOp = <K extends keyof typeof ops>(k: K, v: typeof ops[K]) => { setOps((o) => ({ ...o, [k]: v })); setDirty(true); };
  const setReg = <K extends keyof typeof regional>(k: K, v: typeof regional[K]) => { setRegional((r) => ({ ...r, [k]: v })); setDirty(true); };
  const setBrand = <K extends keyof typeof branding>(k: K, v: typeof branding[K]) => { setBranding((b) => ({ ...b, [k]: v })); setDirty(true); };

  const hrEmployees = employees.filter((e) => e.employment_type === "employee").length;
  const hrContractors = employees.filter((e) => e.employment_type === "contractor").length;
  const conflict = draft.employee_count !== hrEmployees || draft.contractor_count !== hrContractors;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!draft.business_name.trim()) errs.business_name = "Business name is required.";
    if (draft.main_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.main_email)) errs.main_email = "Enter a valid email format.";
    if (draft.primary_contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.primary_contact_email)) errs.primary_contact_email = "Enter a valid email format.";
    if (draft.website && !/^https?:\/\/.+/i.test(draft.website)) errs.website = "Enter a URL starting with http:// or https://";
    if (draft.company_number && !/^[A-Z0-9]{6,10}$/i.test(draft.company_number)) errs.company_number = "Company number is typically 6–10 letters/digits.";
    if (draft.vat_number && !/^[A-Z]{2}\s?[0-9]{9,}$/i.test(draft.vat_number.replace(/\s+/g, ""))) errs.vat_number = "VAT number format looks unusual - please double-check.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const save = () => {
    if (!validate()) { toast.error("Please fix the highlighted fields."); return; }
    updateBusinessProfile({
      business_name: draft.business_name,
      company_number: draft.company_number,
      business_type: draft.business_type,
      industry: draft.industry,
      incorporation_date: draft.incorporation_date,
      registered_address: draft.registered_address,
      employee_count: draft.employee_count,
      contractor_count: draft.contractor_count,
      vat_registered: draft.vat_registered,
      trades_internationally: draft.trades_internationally,
    });
    updateAppSettings(
      (prev) => ({
        ...prev,
        business_extras: {
          trading_name: draft.trading_name,
          company_status: draft.company_status,
          registered_country: draft.registered_country,
          website: draft.website,
          main_telephone: draft.main_telephone,
          main_email: draft.main_email,
          vat_number: draft.vat_number,
          primary_contact_name: draft.primary_contact_name,
          primary_contact_role: draft.primary_contact_role,
          primary_contact_email: draft.primary_contact_email,
          primary_contact_telephone: draft.primary_contact_telephone,
        },
        regional,
        branding: { ...branding, display_name: draft.business_name || branding.display_name },
        operations: ops,
      }),
      {
        category: "profile",
        action: "Business profile updated",
        target: draft.business_name,
        summary: "Business profile, regional preferences and branding saved.",
      },
    );
    setDirty(false);
    toast.success("Business profile saved.");
  };

  const useHrTotals = () => { setDraft((d) => ({ ...d, employee_count: hrEmployees, contractor_count: hrContractors })); setDirty(true); };

  return (
    <Card className="p-6">
      <SectionHeader title="Business Profile" description="Details about the current business used across Jojan One reports, documents and applicability." />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Legal business name" htmlFor="bn"><Input id="bn" value={draft.business_name} onChange={(e) => set("business_name", e.target.value)} />{errors.business_name && <p className="text-[11.5px] text-destructive">{errors.business_name}</p>}</Field>
        <Field label="Trading name"><Input value={draft.trading_name} onChange={(e) => set("trading_name", e.target.value)} /></Field>
        <Field label="Company number" hint="Format only - Jojan One does not verify Companies House records in this prototype."><Input value={draft.company_number} onChange={(e) => set("company_number", e.target.value.toUpperCase())} />{errors.company_number && <p className="text-[11.5px] text-destructive">{errors.company_number}</p>}</Field>
        <Field label="Business type"><Input value={draft.business_type} onChange={(e) => set("business_type", e.target.value)} /></Field>
        <Field label="Industry / sector"><Input value={draft.industry} onChange={(e) => set("industry", e.target.value)} /></Field>
        <Field label="Company status"><Input value={draft.company_status} onChange={(e) => set("company_status", e.target.value)} /></Field>
        <Field label="Incorporation date"><Input type="date" value={draft.incorporation_date} onChange={(e) => set("incorporation_date", e.target.value)} /></Field>
        <Field label="Registered country"><Input value={draft.registered_country} onChange={(e) => set("registered_country", e.target.value)} /></Field>
        <Field label="Primary business address" htmlFor="addr"><Textarea id="addr" rows={2} value={draft.registered_address} onChange={(e) => set("registered_address", e.target.value)} /></Field>
        <Field label="Website"><Input value={draft.website} onChange={(e) => set("website", e.target.value)} />{errors.website && <p className="text-[11.5px] text-destructive">{errors.website}</p>}</Field>
        <Field label="Main telephone"><Input value={draft.main_telephone} onChange={(e) => set("main_telephone", e.target.value)} /></Field>
        <Field label="Main business email"><Input type="email" value={draft.main_email} onChange={(e) => set("main_email", e.target.value)} />{errors.main_email && <p className="text-[11.5px] text-destructive">{errors.main_email}</p>}</Field>
      </div>

      <Separator className="my-6" />
      <h3 className="mb-3 text-[14.5px] font-semibold text-foreground">Business operation</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Number of employees" hint={conflict ? `HR register currently contains ${hrEmployees} employee${hrEmployees === 1 ? "" : "s"}.` : undefined}>
          <Input type="number" min={0} value={draft.employee_count} onChange={(e) => set("employee_count", Number(e.target.value))} />
        </Field>
        <Field label="Number of contractors" hint={conflict ? `HR register currently contains ${hrContractors} contractor${hrContractors === 1 ? "" : "s"}.` : undefined}>
          <Input type="number" min={0} value={draft.contractor_count} onChange={(e) => set("contractor_count", Number(e.target.value))} />
        </Field>
        <Field label="VAT registered">
          <div className="flex items-center gap-2"><Switch checked={draft.vat_registered} onCheckedChange={(v) => set("vat_registered", v)} /><span className="text-[13px] text-muted-foreground">{draft.vat_registered ? "Yes" : "No"}</span></div>
        </Field>
        <Field label="VAT number"><Input value={draft.vat_number} onChange={(e) => set("vat_number", e.target.value)} disabled={!draft.vat_registered} />{errors.vat_number && <p className="text-[11.5px] text-destructive">{errors.vat_number}</p>}</Field>
      </div>
      {conflict && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          <span>The HR register currently contains {hrEmployees} employee{hrEmployees === 1 ? "" : "s"} and {hrContractors} contractor{hrContractors === 1 ? "" : "s"}.</span>
          <Button size="sm" variant="outline" onClick={useHrTotals}>Use HR register totals</Button>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-1 md:grid-cols-2">
        <ToggleRow label="Processes personal data" checked={ops.processes_personal_data} onChange={(v) => setOp("processes_personal_data", v)} />
        <ToggleRow label="Employs staff" checked={ops.employs_staff} onChange={(v) => setOp("employs_staff", v)} />
        <ToggleRow label="Uses contractors" checked={ops.uses_contractors} onChange={(v) => setOp("uses_contractors", v)} />
        <ToggleRow label="Trades internationally" checked={ops.trades_internationally} onChange={(v) => setOp("trades_internationally", v)} />
        <ToggleRow label="Operates a public website or online service" checked={ops.operates_public_service} onChange={(v) => setOp("operates_public_service", v)} />
        <ToggleRow label="Carries out regulated activities" checked={ops.regulated_activities} onChange={(v) => setOp("regulated_activities", v)} />
        <ToggleRow label="Relies on external suppliers" checked={ops.relies_on_external_suppliers} onChange={(v) => setOp("relies_on_external_suppliers", v)} />
      </div>
      <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-[12.5px] text-muted-foreground">
        Business profile answers help Jojan One organise likely obligations and recommendations. They do not constitute a legal or regulatory determination.
      </p>

      <Separator className="my-6" />
      <h3 className="mb-3 text-[14.5px] font-semibold text-foreground">Regional preferences</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field label="Country"><Input value={regional.country} onChange={(e) => setReg("country", e.target.value)} /></Field>
        <Field label="Currency">
          <Select value={regional.currency} onValueChange={(v) => setReg("currency", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["GBP", "EUR", "USD"].map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
          </Select>
        </Field>
        <Field label="Time zone"><Input value={regional.time_zone} onChange={(e) => setReg("time_zone", e.target.value)} /></Field>
        <Field label="Date format">
          <Select value={regional.date_format} onValueChange={(v) => setReg("date_format", v as typeof regional.date_format)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
              <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
              <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Financial year end"><Input value={regional.financial_year_end} onChange={(e) => setReg("financial_year_end", e.target.value)} /></Field>
        <Field label="Week starts on">
          <Select value={regional.week_starts_on} onValueChange={(v) => setReg("week_starts_on", v as typeof regional.week_starts_on)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="monday">Monday</SelectItem><SelectItem value="sunday">Sunday</SelectItem></SelectContent>
          </Select>
        </Field>
      </div>

      <Separator className="my-6" />
      <h3
        id="primary-contact"
        tabIndex={-1}
        className="mb-3 scroll-mt-24 text-[14.5px] font-semibold text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Primary contact
      </h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Name"><Input value={draft.primary_contact_name} onChange={(e) => set("primary_contact_name", e.target.value)} /></Field>
        <Field label="Role"><Input value={draft.primary_contact_role} onChange={(e) => set("primary_contact_role", e.target.value)} /></Field>
        <Field label="Email"><Input type="email" value={draft.primary_contact_email} onChange={(e) => set("primary_contact_email", e.target.value)} />{errors.primary_contact_email && <p className="text-[11.5px] text-destructive">{errors.primary_contact_email}</p>}</Field>
        <Field label="Telephone"><Input value={draft.primary_contact_telephone} onChange={(e) => set("primary_contact_telephone", e.target.value)} /></Field>
      </div>

      <Separator className="my-6" />
      <h3 className="mb-3 text-[14.5px] font-semibold text-foreground">Branding</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Business display name"><Input value={branding.display_name} onChange={(e) => setBrand("display_name", e.target.value)} /></Field>
        <Field label="Primary brand colour" hint="Choose from a safe palette. Jojan One core accessibility colours are unaffected.">
          <div className="flex flex-wrap gap-2">
            {SAFE_BRAND_PALETTE.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setBrand("primary_color", c.value)}
                aria-label={`Set brand colour to ${c.name}`}
                aria-pressed={branding.primary_color === c.value}
                className={"grid h-8 w-8 place-items-center rounded-full border-2 " + (branding.primary_color === c.value ? "border-foreground" : "border-transparent")}
                style={{ backgroundColor: c.value }}
              >
                {branding.primary_color === c.value && <CheckCircle2 className="h-4 w-4 text-white" />}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Logo (local browser only)" hint="Stored in this browser only. Not uploaded to any server in this prototype.">
          <LogoUploader
            value={branding.logo_data_url}
            displayName={branding.display_name || draft.business_name || "Business"}
            onChange={(v) => setBrand("logo_data_url", v)}
            onSaveNow={(v) => {
              setBrand("logo_data_url", v);
              updateAppSettings(
                (prev) => ({ ...prev, branding: { ...prev.branding, logo_data_url: v } }),
                {
                  category: "profile",
                  action: v ? "Logo updated" : "Logo removed",
                  target: "Branding",
                  summary: v ? "Business logo saved to local browser storage." : "Business logo removed.",
                },
              );
              toast.success(v ? "Logo saved." : "Logo removed.");
            }}
          />
        </Field>
        <Field label="Report footer contact information"><Textarea rows={2} value={branding.report_footer} onChange={(e) => setBrand("report_footer", e.target.value)} /></Field>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
        <p className="text-[12px] text-muted-foreground">{dirty ? "Unsaved changes." : "All changes saved."}</p>
        <div className="flex items-center gap-2">
          <RestoreDefaultsButton
            label="Restore Business Profile defaults"
            onConfirm={() => {
              updateAppSettings((prev) => ({ ...prev, business_extras: { ...prev.business_extras }, regional: { ...prev.regional }, branding: { ...prev.branding }, operations: { ...prev.operations } }), {
                category: "profile", action: "Business profile section restored", target: "Business Profile", summary: "Section restored to defaults.",
              });
              toast.success("Section restored.");
            }}
          />
          <Button onClick={save} disabled={!dirty}>Save changes</Button>
        </div>
      </div>
    </Card>
  );
}

function RestoreDefaultsButton({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Restore defaults</Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={label}
        description="This affects only the current settings section. Business, module and audit data are preserved."
        confirmLabel="Restore"
        onConfirm={() => { onConfirm(); setOpen(false); }}
      />
    </>
  );
}

// ============================================================
// Users & Access
// ============================================================

function UsersAccessSection() {
  const users = useCoreData((s) => s.app_users);
  const [invite, setInvite] = useState({ name: "", email: "", role: "team_member" as AppRole });
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <SectionHeader title="Users & Access" description="Prototype users with roles and access summaries. Production access must be enforced through authenticated server-side permissions." />
          </div>
          <Button onClick={() => setInviteOpen(true)}>Invite user</Button>
        </div>

        <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[12.5px] text-slate-700">
          Access controls in this prototype demonstrate intended product behaviour. Production access must be enforced through authenticated server-side permissions and database policies.
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="text-[11.5px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Last active</th>
                <th className="py-2 pr-3">Areas</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <UserRow key={u.id} userId={u.id} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-6">
        <SectionHeader title="Permissions matrix" description="Prototype role permissions - for illustration only." />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="text-[11.5px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Area</th>
                <th className="py-2 pr-3">Owner/Admin</th>
                <th className="py-2 pr-3">Manager</th>
                <th className="py-2 pr-3">Team Member</th>
                <th className="py-2 pr-3">Adviser</th>
                <th className="py-2 pr-3">Read Only</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS_MATRIX.map((r) => (
                <tr key={r.area} className="border-t border-border">
                  <td className="py-2 pr-3 font-medium text-foreground">{r.area}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.owner_admin}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.manager}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.team_member}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.adviser}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.read_only}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite user</DialogTitle>
            <DialogDescription>Prototype invitation - no email will be sent.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Full name"><Input value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} /></Field>
            <Field label="Role">
              <Select value={invite.role} onValueChange={(v) => setInvite({ ...invite, role: v as AppRole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                const id = inviteAppUser({ full_name: invite.name, email: invite.email, role: invite.role });
                if (!id) { toast.error("Enter a valid email that isn't already in use."); return; }
                toast.success("Prototype invitation created - no email has been sent.");
                setInvite({ name: "", email: "", role: "team_member" });
                setInviteOpen(false);
              }}
            >Send invitation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UserRow({ userId }: { userId: string }) {
  const user = useCoreData((s) => s.app_users.find((u) => u.id === userId));
  const [detailOpen, setDetailOpen] = useState(false);
  if (!user) return null;
  const statusTone = user.status === "active" ? "bg-emerald-50 text-emerald-700" : user.status === "invited" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-700";
  return (
    <tr className="border-t border-border align-top">
      <td className="py-2 pr-3 font-medium text-foreground">{user.full_name}</td>
      <td className="py-2 pr-3 text-muted-foreground">{user.email}</td>
      <td className="py-2 pr-3">
        <Select value={user.role} onValueChange={(v) => { const r = setUserRole(user.id, v as AppRole); if (!r.ok) toast.error(r.reason ?? "Cannot change role."); }}>
          <SelectTrigger className="h-8 w-[150px] text-[12.5px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => (<SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>))}
          </SelectContent>
        </Select>
      </td>
      <td className="py-2 pr-3"><span className={"rounded-full px-2 py-0.5 text-[11.5px] " + statusTone}>{user.status}</span></td>
      <td className="py-2 pr-3 text-[12.5px] text-muted-foreground">{user.last_active_at ? new Date(user.last_active_at).toLocaleDateString() : "-"}</td>
      <td className="py-2 pr-3 text-[12.5px] text-muted-foreground">{user.areas.length ? user.areas.join(", ") : "-"}</td>
      <td className="py-2 pr-3">
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="ghost" onClick={() => setDetailOpen(true)}>Details</Button>
          {user.status === "invited" && <Button size="sm" variant="ghost" onClick={() => { resendUserInvite(user.id); toast.success("Prototype invitation resent - no email has been sent."); }}>Resend</Button>}
          {user.status !== "active" && <Button size="sm" variant="ghost" onClick={() => { const r = setUserStatus(user.id, "active"); if (!r.ok) toast.error(r.reason ?? ""); else toast.success("User reactivated."); }}>Reactivate</Button>}
          {user.status === "active" && <Button size="sm" variant="ghost" onClick={() => { const r = setUserStatus(user.id, "deactivated"); if (!r.ok) toast.error(r.reason ?? ""); else toast.success("User deactivated."); }}>Deactivate</Button>}
        </div>
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{user.full_name}</DialogTitle>
              <DialogDescription>{ROLE_LABELS[user.role]} · {user.status}</DialogDescription>
            </DialogHeader>
            <dl className="space-y-2 text-[13px]">
              <div><dt className="text-muted-foreground">Email</dt><dd>{user.email}</dd></div>
              <div><dt className="text-muted-foreground">Assigned areas</dt><dd>{user.areas.length ? user.areas.join(", ") : "None"}</dd></div>
              <div><dt className="text-muted-foreground">Invited</dt><dd>{user.invited_at ? new Date(user.invited_at).toLocaleString() : "-"}</dd></div>
              <div><dt className="text-muted-foreground">Last active</dt><dd>{user.last_active_at ? new Date(user.last_active_at).toLocaleString() : "-"}</dd></div>
              <div><dt className="text-muted-foreground">Notes</dt><dd>{user.notes || "-"}</dd></div>
            </dl>
          </DialogContent>
        </Dialog>
      </td>
    </tr>
  );
}

// ============================================================
// Jova
// ============================================================

function JovaSection() {
  const settings = useCoreData((s) => s.app_settings);
  const j = settings.jova;
  const [preview, setPreview] = useState<string | null>(null);
  const state = useCoreData((s) => s);

  const update = (patch: Partial<typeof j>, audit?: { action: string; summary: string; before?: string; after?: string }) => {
    updateAppSettings((prev) => ({ ...prev, jova: { ...prev.jova, ...patch } }), audit ? { category: "jova", action: audit.action, target: "Jova preferences", summary: audit.summary, before: audit.before, after: audit.after } : undefined);
  };

  const previewResponse = () => {
    const draft = generateJovaReply(state, "What needs my attention today?");
    let content = draft.content;
    if (j.communication_style === "concise") content = content.split(". ").slice(0, 2).join(". ") + (content.includes(".") ? "" : ".");
    if (j.communication_style === "detailed") content = content + " I can also open the record and walk through the recommended next step.";
    if (j.explanation_level === "plain") content = content.replace(/obligation/g, "task").replace(/priorit/g, "priorit");
    setPreview(content);
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <SectionHeader title="Jova" description="Preferences for how Jova communicates. Mandatory safeguards below cannot be disabled." />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Field label="Communication style">
            <Select value={j.communication_style} onValueChange={(v) => update({ communication_style: v as typeof j.communication_style }, { action: "Jova communication style changed", summary: `Style set to ${v}.`, before: j.communication_style, after: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="concise">Concise</SelectItem><SelectItem value="balanced">Balanced</SelectItem><SelectItem value="detailed">Detailed</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Explanation level">
            <Select value={j.explanation_level} onValueChange={(v) => update({ explanation_level: v as typeof j.explanation_level }, { action: "Jova explanation level changed", summary: `Explanation level set to ${v}.`, before: j.explanation_level, after: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="plain">Plain English</SelectItem><SelectItem value="standard">Standard business</SelectItem><SelectItem value="advanced">Advanced</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Max briefing priorities">
            <Input type="number" min={1} max={10} value={j.briefing_max_priorities} onChange={(e) => update({ briefing_max_priorities: Math.max(1, Math.min(10, Number(e.target.value))) })} />
          </Field>
        </div>

        <Separator className="my-6" />
        <h3 className="mb-2 text-[14.5px] font-semibold">Morning briefing</h3>
        <ToggleRow label="Morning briefing enabled" checked={j.morning_briefing_enabled} onChange={(v) => update({ morning_briefing_enabled: v })} />
        <div className="mt-2 grid grid-cols-1 gap-1 md:grid-cols-2">
          {([
            ["overdue", "Include overdue work"],
            ["risks", "Include risks"],
            ["compliance", "Include compliance deadlines"],
            ["contracts", "Include contract renewals"],
            ["training", "Include training"],
            ["growth", "Include investor/tender readiness"],
          ] as const).map(([key, label]) => (
            <ToggleRow key={key} label={label} checked={j.briefing_include[key]} onChange={(v) => update({ briefing_include: { ...j.briefing_include, [key]: v } })} />
          ))}
        </div>

        <Separator className="my-6" />
        <h3 className="mb-2 text-[14.5px] font-semibold">Response behaviour</h3>
        <ToggleRow label="Ask clarifying questions when context is ambiguous" checked disabled locked="Always enabled - protects response quality." onChange={() => {}} />
        <ToggleRow label="Show source module or record" checked={j.show_sources} onChange={(v) => update({ show_sources: v })} />
        <ToggleRow label="Show confidence / limitations" checked={j.show_confidence} onChange={(v) => update({ show_confidence: v })} />
        <ToggleRow label="Include professional-support triggers" checked disabled locked="Always enabled - mandatory safeguard." onChange={() => {}} />
        <ToggleRow label="Preserve conversation context" checked={j.preserve_context} onChange={(v) => update({ preserve_context: v })} />
        <ToggleRow label="Allow cross-module summaries" checked={j.allow_cross_module} onChange={(v) => update({ allow_cross_module: v })} />

        <Separator className="my-6" />
        <h3 className="mb-2 text-[14.5px] font-semibold">Professional-support preferences</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Preferred support types">
            <div className="flex flex-wrap gap-2">
              {SUPPORT_TYPES.map((t) => {
                const on = j.preferred_support_types.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={on}
                    onClick={() => update({ preferred_support_types: on ? j.preferred_support_types.filter((x) => x !== t) : [...j.preferred_support_types, t] })}
                    className={"rounded-full border px-2.5 py-1 text-[12px] " + (on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}
                  >{t}</button>
                );
              })}
            </div>
          </Field>
          <Field label="Display support recommendation threshold">
            <Select value={j.support_threshold} onValueChange={(v) => update({ support_threshold: v as typeof j.support_threshold })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="standard">Standard</SelectItem><SelectItem value="cautious">Cautious</SelectItem><SelectItem value="very_cautious">Very cautious</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Preferred adviser notes">
            <Textarea rows={2} value={j.preferred_adviser_notes} onChange={(e) => update({ preferred_adviser_notes: e.target.value })} />
          </Field>
        </div>

        <Separator className="my-6" />
        <h3 className="mb-2 flex items-center gap-2 text-[14.5px] font-semibold"><Shield className="h-4 w-4 text-primary" /> Non-editable safeguards</h3>
        <ul className="space-y-1 text-[12.5px] text-muted-foreground">
          <li className="flex items-center gap-2"><Lock className="h-3 w-3" /> Jova's non-advice boundary</li>
          <li className="flex items-center gap-2"><Lock className="h-3 w-3" /> Professional-support escalation for sensitive matters</li>
          <li className="flex items-center gap-2"><Lock className="h-3 w-3" /> Source and uncertainty disclosure for high-risk responses</li>
          <li className="flex items-center gap-2"><Lock className="h-3 w-3" /> Prohibition on inventing facts</li>
          <li className="flex items-center gap-2"><Lock className="h-3 w-3" /> Prohibition on presenting prototype data as live regulatory monitoring</li>
          <li className="flex items-center gap-2"><Lock className="h-3 w-3" /> Prohibition on revealing unsubmitted Academy quiz answers</li>
        </ul>
        <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-[12.5px] italic text-muted-foreground">
          Jova provides business information and guidance, not legal advice. Where professional judgement is required, Jova will recommend expert support.
        </p>

        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
          <Button variant="outline" size="sm" onClick={previewResponse}><Sparkles className="mr-1.5 h-3.5 w-3.5" /> Preview Jova response</Button>
          <RestoreDefaultsButton
            label="Restore recommended Jova settings"
            onConfirm={() => {
              updateAppSettings((prev) => ({ ...prev, jova: { ...prev.jova, communication_style: "balanced", explanation_level: "plain", morning_briefing_enabled: true, briefing_max_priorities: 5, show_sources: true, show_confidence: true, preserve_context: true, allow_cross_module: true, support_threshold: "standard" } }), { category: "jova", action: "Jova settings restored", target: "Jova preferences", summary: "Restored to recommended defaults." });
              toast.success("Jova settings restored.");
            }}
          />
        </div>
        {preview && (
          <div className="mt-4 rounded-md border border-border bg-accent/40 p-3 text-[13px]">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Preview</p>
            <p>{preview}</p>
          </div>
        )}
      </Card>
    </div>
  );
}

// ============================================================
// Notifications
// ============================================================

function NotificationsSection() {
  const settings = useCoreData((s) => s.app_settings);
  const n = settings.notifications;

  const setCategory = (key: string, channel: "in_app" | "email" | "push", value: NotificationTiming) => {
    updateAppSettings((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        categories: prev.notifications.categories.map((c) => c.key === key ? { ...c, [channel]: value } : c),
      },
    }), { category: "notifications", action: "Notification preference changed", target: NOTIFICATION_CATEGORIES.find((c) => c.key === key)?.label ?? key, summary: `${channel} timing set to ${value}.` });
  };

  const testNotification = () => {
    pushNotification({
      kind: "insight",
      title: "Test notification",
      description: "This is a test notification from Settings. If you can see this, the in-app notification centre is working.",
      reference_type: null,
      reference_id: null,
      read: false,
    });
    toast.success("Test in-app notification sent.");
  };

  const groups = useMemo(() => {
    const map = new Map<string, typeof n.categories>();
    for (const c of n.categories) {
      const arr = map.get(c.group) ?? [];
      arr.push(c);
      map.set(c.group, arr);
    }
    return Array.from(map.entries());
  }, [n.categories]);

  return (
    <Card className="p-6">
      <SectionHeader title="Notifications" description="Choose which notifications appear in the in-app bell and how often. Email and push are not connected in this prototype." />

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[12.5px]">
        <span className="font-medium">Channels:</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">In-app · Connected</span>
        <span>Email <NotConnectedPill /></span>
        <span>Push <NotConnectedPill /></span>
        <div className="ml-auto"><Button size="sm" variant="outline" onClick={testNotification}>Send test in-app notification</Button></div>
      </div>

      <div className="space-y-6">
        {groups.map(([group, cats]) => (
          <div key={group}>
            <h3 className="mb-2 text-[13.5px] font-semibold text-foreground">{group}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="text-[11.5px] uppercase tracking-wider text-muted-foreground">
                  <tr><th className="py-2 pr-3">Category</th><th className="py-2 pr-3">In-app</th><th className="py-2 pr-3">Email</th><th className="py-2 pr-3">Push</th></tr>
                </thead>
                <tbody>
                  {cats.map((c) => (
                    <tr key={c.key} className="border-t border-border">
                      <td className="py-2 pr-3">{c.label}</td>
                      <td className="py-2 pr-3"><TimingSelect value={c.in_app} onChange={(v) => setCategory(c.key, "in_app", v)} /></td>
                      <td className="py-2 pr-3"><TimingSelect value={c.email} onChange={(v) => setCategory(c.key, "email", v)} disabled title="Email delivery is not connected in this prototype." /></td>
                      <td className="py-2 pr-3"><TimingSelect value={c.push} onChange={(v) => setCategory(c.key, "push", v)} disabled title="Push delivery is not connected in this prototype." /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <Separator className="my-6" />
      <h3 className="mb-2 text-[14.5px] font-semibold">Escalation thresholds</h3>
      <p className="mb-2 text-[12.5px] text-muted-foreground">Days before due date at which reminders should trigger.</p>
      <div className="flex flex-wrap gap-2">
        {[0, 3, 7, 14, 30].map((d) => {
          const on = n.escalation_days.includes(d);
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              onClick={() => updateAppSettings((prev) => ({ ...prev, notifications: { ...prev.notifications, escalation_days: on ? prev.notifications.escalation_days.filter((x) => x !== d) : [...prev.notifications.escalation_days, d].sort((a, b) => a - b) } }), { category: "notifications", action: "Escalation threshold changed", target: `${d} days`, summary: on ? `Removed ${d}-day threshold.` : `Added ${d}-day threshold.` })}
              className={"rounded-full border px-2.5 py-1 text-[12px] " + (on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}
            >{d === 0 ? "Due today" : `${d} days`}</button>
          );
        })}
      </div>

      <Separator className="my-6" />
      <h3 className="mb-2 text-[14.5px] font-semibold">Quiet hours</h3>
      <ToggleRow label="Quiet hours enabled" checked={n.quiet_hours.enabled} onChange={(v) => updateAppSettings((prev) => ({ ...prev, notifications: { ...prev.notifications, quiet_hours: { ...prev.notifications.quiet_hours, enabled: v } } }))} />
      <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Field label="Start"><Input type="time" value={n.quiet_hours.start} onChange={(e) => updateAppSettings((prev) => ({ ...prev, notifications: { ...prev.notifications, quiet_hours: { ...prev.notifications.quiet_hours, start: e.target.value } } }))} /></Field>
        <Field label="End"><Input type="time" value={n.quiet_hours.end} onChange={(e) => updateAppSettings((prev) => ({ ...prev, notifications: { ...prev.notifications, quiet_hours: { ...prev.notifications.quiet_hours, end: e.target.value } } }))} /></Field>
        <Field label="Weekends off"><Switch checked={n.quiet_hours.weekends_off} onCheckedChange={(v) => updateAppSettings((prev) => ({ ...prev, notifications: { ...prev.notifications, quiet_hours: { ...prev.notifications.quiet_hours, weekends_off: v } } }))} /></Field>
      </div>
    </Card>
  );
}

function TimingSelect({ value, onChange, disabled, title }: { value: NotificationTiming; onChange: (v: NotificationTiming) => void; disabled?: boolean; title?: string }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as NotificationTiming)} disabled={disabled}>
      <SelectTrigger className="h-8 w-[130px] text-[12.5px]" title={title}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="immediate">Immediate</SelectItem>
        <SelectItem value="daily">Daily digest</SelectItem>
        <SelectItem value="weekly">Weekly digest</SelectItem>
        <SelectItem value="off">Off</SelectItem>
      </SelectContent>
    </Select>
  );
}

// ============================================================
// Display & Accessibility
// ============================================================

function DisplaySection() {
  const settings = useCoreData((s) => s.app_settings);
  const d = settings.display;
  const set = <K extends keyof typeof d>(k: K, v: typeof d[K]) => {
    updateAppSettings((prev) => ({ ...prev, display: { ...prev.display, [k]: v } }), { category: "display", action: "Display preference changed", target: String(k), summary: `${String(k)} set to ${String(v)}.` });
  };

  // Apply display preferences at the document root (safe, reversible).
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.textSize = d.text_size;
    root.dataset.density = d.density;
    root.dataset.reduceMotion = d.reduce_motion ? "true" : "false";
    root.dataset.highContrast = d.high_contrast ? "true" : "false";
    if (d.text_size === "large") root.style.setProperty("font-size", "16.5px"); else root.style.removeProperty("font-size");
  }, [d.text_size, d.density, d.reduce_motion, d.high_contrast]);

  return (
    <Card className="p-6">
      <SectionHeader title="Display & Accessibility" description="Appearance, density and readability. Preferences are saved for this prototype user." />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Appearance">
          <Select value={d.appearance} onValueChange={(v) => set("appearance", v as typeof d.appearance)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Dark mode" hint="Planned - the current design system is optimised for light mode.">
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground"><Info className="h-4 w-4" /> Planned</div>
        </Field>
        <Field label="Density">
          <Select value={d.density} onValueChange={(v) => set("density", v as typeof d.density)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="comfortable">Comfortable</SelectItem><SelectItem value="compact">Compact</SelectItem></SelectContent>
          </Select>
        </Field>
        <Field label="Text size">
          <Select value={d.text_size} onValueChange={(v) => set("text_size", v as typeof d.text_size)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="standard">Standard</SelectItem><SelectItem value="large">Large</SelectItem></SelectContent>
          </Select>
        </Field>
      </div>

      <Separator className="my-6" />
      <h3 className="mb-2 text-[14.5px] font-semibold">Navigation</h3>
      <ToggleRow label="Remember last sidebar state" checked={d.remember_sidebar} onChange={(v) => set("remember_sidebar", v)} />
      <ToggleRow label="Show section labels in sidebar" checked={d.show_section_labels} onChange={(v) => set("show_section_labels", v)} />
      <ToggleRow label="Reduce navigation animation" checked={d.reduce_nav_animation} onChange={(v) => set("reduce_nav_animation", v)} />

      <Separator className="my-6" />
      <h3 className="mb-2 text-[14.5px] font-semibold">Readability</h3>
      <ToggleRow label="Increased line spacing" checked={d.increased_line_spacing} onChange={(v) => set("increased_line_spacing", v)} />
      <ToggleRow label="High contrast" checked={d.high_contrast} onChange={(v) => set("high_contrast", v)} />
      <ToggleRow label="Underline text links" checked={d.underline_links} onChange={(v) => set("underline_links", v)} />
      <ToggleRow label="Reduce motion" description="Also respects your browser's prefers-reduced-motion setting." checked={d.reduce_motion} onChange={(v) => set("reduce_motion", v)} />

      <Separator className="my-6" />
      <h3 className="mb-2 text-[14.5px] font-semibold">Tables</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Default view">
          <Select value={d.default_table_view} onValueChange={(v) => set("default_table_view", v as typeof d.default_table_view)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="table">Table</SelectItem><SelectItem value="cards">Cards</SelectItem></SelectContent>
          </Select>
        </Field>
        <Field label="Rows per page"><Input type="number" min={10} max={200} value={d.rows_per_page} onChange={(e) => set("rows_per_page", Math.max(10, Math.min(200, Number(e.target.value))))} /></Field>
        <ToggleRow label="Sticky headers" checked={d.sticky_headers} onChange={(v) => set("sticky_headers", v)} />
        <ToggleRow label="Wrap long text" checked={d.wrap_long_text} onChange={(v) => set("wrap_long_text", v)} />
      </div>

      <div className="mt-6 flex justify-end">
        <RestoreDefaultsButton
          label="Reset display preferences"
          onConfirm={() => {
            updateAppSettings((prev) => ({ ...prev, display: { ...prev.display, text_size: "standard", density: "comfortable", high_contrast: false, increased_line_spacing: false, reduce_motion: false, underline_links: false, default_table_view: "table", rows_per_page: 25, sticky_headers: true, wrap_long_text: true } }), { category: "display", action: "Display preferences reset", target: "Display & Accessibility", summary: "Display preferences restored to defaults." });
            toast.success("Display preferences reset.");
          }}
        />
      </div>
    </Card>
  );
}

// ============================================================
// Reports & Documents
// ============================================================

function DocumentsSection() {
  const settings = useCoreData((s) => s.app_settings);
  const rd = settings.report_defaults;
  const dd = settings.document_defaults;
  const cd = settings.certificate_defaults;
  const setR = <K extends keyof typeof rd>(k: K, v: typeof rd[K]) => updateAppSettings((prev) => ({ ...prev, report_defaults: { ...prev.report_defaults, [k]: v } }), { category: "documents", action: "Report default changed", target: String(k), summary: `${String(k)} set to ${String(v)}.` });
  const setD = <K extends keyof typeof dd>(k: K, v: typeof dd[K]) => updateAppSettings((prev) => ({ ...prev, document_defaults: { ...prev.document_defaults, [k]: v } }));
  const setC = <K extends keyof typeof cd>(k: K, v: typeof cd[K]) => updateAppSettings((prev) => ({ ...prev, certificate_defaults: { ...prev.certificate_defaults, [k]: v } }));

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <SectionHeader title="Report defaults" description="Applied to new reports. Existing final reports are not silently changed." />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Default period">
            <Select value={rd.default_period} onValueChange={(v) => setR("default_period", v as typeof rd.default_period)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="this_month">This month</SelectItem><SelectItem value="last_quarter">Last quarter</SelectItem><SelectItem value="ytd">Year to date</SelectItem><SelectItem value="trailing_12">Trailing 12 months</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Default status">
            <Select value={rd.default_status} onValueChange={(v) => setR("default_status", v as typeof rd.default_status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="final">Final</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Print orientation">
            <Select value={rd.print_orientation} onValueChange={(v) => setR("print_orientation", v as typeof rd.print_orientation)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="portrait">Portrait</SelectItem><SelectItem value="landscape">Landscape</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Paper size"><Input value={rd.paper_size} disabled /></Field>
        </div>
        <div className="mt-2">
          <ToggleRow label="Include business logo" checked={rd.include_logo} onChange={(v) => setR("include_logo", v)} />
          <ToggleRow label="Include executive summary" checked={rd.include_executive_summary} onChange={(v) => setR("include_executive_summary", v)} />
          <ToggleRow label="Include source modules" checked={rd.include_source_modules} onChange={(v) => setR("include_source_modules", v)} />
          <ToggleRow label="Include generated date/time" checked={rd.include_generated_at} onChange={(v) => setR("include_generated_at", v)} />
          <ToggleRow label="Include point-in-time wording" checked={rd.include_point_in_time} onChange={(v) => setR("include_point_in_time", v)} />
          <ToggleRow label="Include professional-support statement" checked disabled locked="Mandatory disclaimer on Jojan One reports." onChange={() => {}} />
          <ToggleRow label="Page numbering" checked={rd.page_numbering} onChange={(v) => setR("page_numbering", v)} />
        </div>
        <Field label="Report footer"><Textarea rows={2} value={rd.report_footer} onChange={(e) => setR("report_footer", e.target.value)} /></Field>
      </Card>

      <Card className="p-6">
        <SectionHeader title="Document defaults" description="Applied to new documents generated inside Jojan One." />
        <p className="mb-3 rounded-md bg-slate-50 px-3 py-2 text-[12.5px] text-muted-foreground">Default document status: <strong>{dd.draft_status}</strong> - locked to protect draft handling.</p>
        <ToggleRow label="Include company details" checked={dd.include_company_details} onChange={(v) => setD("include_company_details", v)} />
        <ToggleRow label="Include version number" checked={dd.include_version_number} onChange={(v) => setD("include_version_number", v)} />
        <ToggleRow label="Include generated date" checked={dd.include_generated_date} onChange={(v) => setD("include_generated_date", v)} />
        <ToggleRow label="Include document owner" checked={dd.include_owner} onChange={(v) => setD("include_owner", v)} />
        <ToggleRow label="Include review date" checked={dd.include_review_date} onChange={(v) => setD("include_review_date", v)} />
        <ToggleRow label="Include professional-review reminder" checked disabled locked="Mandatory for prototype-generated legal, governance and compliance documents." onChange={() => {}} />
        <ToggleRow label="Print-friendly header/footer" checked={dd.print_header_footer} onChange={(v) => setD("print_header_footer", v)} />
        <Field label="Default font size">
          <Select value={dd.default_font_size} onValueChange={(v) => setD("default_font_size", v as typeof dd.default_font_size)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="standard">Standard</SelectItem><SelectItem value="large">Large</SelectItem></SelectContent>
          </Select>
        </Field>
      </Card>

      <Card className="p-6">
        <SectionHeader title="Certificate defaults" description="Applied to new Academy certificates. Existing certificates are preserved as issued." />
        <ToggleRow label="Include logo" checked={cd.include_logo} onChange={(v) => setC("include_logo", v)} />
        <ToggleRow label="Include completion date" checked={cd.include_completion_date} onChange={(v) => setC("include_completion_date", v)} />
        <ToggleRow label="Include quiz score" checked={cd.include_quiz_score} onChange={(v) => setC("include_quiz_score", v)} />
        <ToggleRow label="Include duration" checked={cd.include_duration} onChange={(v) => setC("include_duration", v)} />
        <ToggleRow label="Include certificate reference" checked={cd.include_reference} onChange={(v) => setC("include_reference", v)} />
        <ToggleRow label="Include non-accreditation statement" checked disabled locked="Mandatory - Jojan One certificates are not accredited qualifications." onChange={() => {}} />
      </Card>
    </div>
  );
}

// ============================================================
// Data Management
// ============================================================

function DataSection() {
  const state = useCoreData((s) => s);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<{ raw: unknown; summary: ReturnType<typeof validateBackup> } | null>(null);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceConfirmText, setReplaceConfirmText] = useState("");
  const [resetType, setResetType] = useState<null | "settings" | "notifications" | "jova" | "academy" | "all">(null);
  const [resetConfirmText, setResetConfirmText] = useState("");

  const counts: Array<[string, number]> = [
    ["Business records", 1],
    ["Contracts", state.contracts.length],
    ["Employees & contractors", state.employees.length],
    ["Compliance obligations", state.compliance_obligations.length],
    ["GDPR processing activities", state.processing_activities.length],
    ["Governance records", state.governance_records.length],
    ["Risks", state.risks.length],
    ["Investor readiness items", state.due_diligence_items.length],
    ["Tender opportunities", state.tender_opportunities.length],
    ["Academy assignments", state.academy_assignments.length],
    ["Reports", state.reports.length],
    ["Timeline activities", state.activities.length],
    ["Jova conversations", state.conversations.length],
    ["Notifications", state.notifications.length],
    ["Certificates", state.academy_certificates.length],
    ["Audit events", state.audit_events.length],
  ];

  const download = () => {
    const backup = exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `jojan-one-backup-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup downloaded.");
  };

  const onFileChosen = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const summary = validateBackup(raw);
      setImportPreview({ raw, summary });
    } catch {
      toast.error("Could not read this file as JSON.");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <SectionHeader title="Data summary" description="Current prototype record counts stored in this browser." />
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
          Jojan One currently stores prototype data in this browser using localStorage. It is not yet connected to a production database. Clearing browser storage may remove this data.
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {counts.map(([label, count]) => (
            <div key={label} className="rounded-md border border-border px-3 py-2 text-[12.5px]">
              <div className="text-muted-foreground">{label}</div>
              <div className="mt-0.5 text-[16px] font-semibold text-foreground">{count}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <SectionHeader title="Export & import backup" description="Backup is a JSON download containing prototype data only. No secrets, passwords or tokens are exported. The backup is not encrypted." />
        <div className="flex flex-wrap gap-2">
          <Button onClick={download}><Download className="mr-1.5 h-4 w-4" />Export Jojan One backup</Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="mr-1.5 h-4 w-4" />Import backup</Button>
          <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={(e) => onFileChosen(e.target.files?.[0])} />
        </div>
      </Card>

      <Card className="p-6">
        <SectionHeader title="Reset options" description="Each reset affects only the stated scope and requires confirmation." />
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <ResetRow title="Reset Settings only" description="Restores all Settings sections to defaults. Business, module and audit data preserved." destructive={false} onClick={() => setResetType("settings")} />
          <ResetRow title="Reset demo notifications" description="Restores seeded notification list. Preferences are preserved." destructive={false} onClick={() => setResetType("notifications")} />
          <ResetRow title="Reset Jova conversations" description="Deletes all Jova conversations and messages." destructive onClick={() => setResetType("jova")} />
          <ResetRow title="Reset Academy progress" description="Deletes learner progress, quiz attempts and certificates. Assignments retained." destructive onClick={() => setResetType("academy")} />
          <div className="md:col-span-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <ResetRow title="Reset all Jojan One prototype data" description="Removes every prototype collection and restores the seeded demo state. Requires typing the business name to confirm." destructive onClick={() => setResetType("all")} />
          </div>
        </div>
      </Card>

      {/* Import preview */}
      <Dialog open={!!importPreview} onOpenChange={(o) => !o && setImportPreview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import backup</DialogTitle>
            <DialogDescription>Review the summary and choose how to apply.</DialogDescription>
          </DialogHeader>
          {importPreview && (
            importPreview.summary.ok ? (
              <div className="space-y-3 text-[13px]">
                <p>Backup is valid. Collections found:</p>
                <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px] text-muted-foreground">
                  {Object.entries(importPreview.summary.counts ?? {}).map(([k, v]) => (<li key={k}>{k}: {v}</li>))}
                </ul>
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
                  A pre-import backup can be downloaded first. Replace requires typing the current business name to confirm.
                </div>
                {replaceOpen && (
                  <Field label={`Type the business name (${state.business.name}) to confirm replace`}>
                    <Input value={replaceConfirmText} onChange={(e) => setReplaceConfirmText(e.target.value)} />
                  </Field>
                )}
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setImportPreview(null)}>Cancel</Button>
                  <Button variant="outline" onClick={download}>Download current data first</Button>
                  <Button
                    onClick={() => {
                      const r = importBackup(importPreview.raw, "merge");
                      if (!r.ok) toast.error(r.reason ?? "Import failed."); else { toast.success("Backup merged."); setImportPreview(null); }
                    }}
                  >Merge</Button>
                  {!replaceOpen ? (
                    <Button variant="destructive" onClick={() => setReplaceOpen(true)}>Replace…</Button>
                  ) : (
                    <Button
                      variant="destructive"
                      disabled={replaceConfirmText.trim() !== state.business.name}
                      onClick={() => {
                        const r = importBackup(importPreview.raw, "replace");
                        if (!r.ok) toast.error(r.reason ?? "Import failed."); else { toast.success("Backup imported (replace)."); setImportPreview(null); setReplaceOpen(false); setReplaceConfirmText(""); }
                      }}
                    >Confirm replace</Button>
                  )}
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[13px] text-destructive">This file does not look like a valid Jojan One backup.</p>
                <p className="text-[12.5px] text-muted-foreground">Reason: {importPreview.summary.reason}</p>
                <DialogFooter><Button variant="ghost" onClick={() => setImportPreview(null)}>Close</Button></DialogFooter>
              </div>
            )
          )}
        </DialogContent>
      </Dialog>

      {/* Reset dialogs */}
      <Dialog open={!!resetType} onOpenChange={(o) => { if (!o) { setResetType(null); setResetConfirmText(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm reset</DialogTitle>
            <DialogDescription>
              {resetType === "settings" && "All Settings sections will be restored to defaults. Business, module and audit data are preserved."}
              {resetType === "notifications" && "Demo notifications will be restored to seeded defaults. Notification preferences are preserved."}
              {resetType === "jova" && "All Jova conversations and messages will be deleted. Cannot be undone."}
              {resetType === "academy" && "All learner progress, quiz attempts and certificates will be deleted. Assignments are retained."}
              {resetType === "all" && "All prototype data will be reset to the seeded demo state. Type the business name to confirm."}
            </DialogDescription>
          </DialogHeader>
          {resetType === "all" && (
            <Field label={`Type ${state.business.name} to confirm`}>
              <Input value={resetConfirmText} onChange={(e) => setResetConfirmText(e.target.value)} />
            </Field>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setResetType(null); setResetConfirmText(""); }}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={resetType === "all" && resetConfirmText.trim() !== state.business.name}
              onClick={() => {
                if (resetType === "settings") { resetSettingsOnly(); toast.success("Settings restored."); }
                if (resetType === "notifications") { resetDemoNotifications(); toast.success("Demo notifications reset."); }
                if (resetType === "jova") { resetJovaConversations(); toast.success("Jova conversations reset."); }
                if (resetType === "academy") { resetAcademyProgress(); toast.success("Academy progress reset."); }
                if (resetType === "all") { resetAllPrototypeData(); toast.success("All prototype data reset."); }
                setResetType(null); setResetConfirmText("");
              }}
            >Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ResetRow({ title, description, destructive, onClick }: { title: string; description: string; destructive: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={"flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-left hover:bg-accent/40 " + (destructive ? "border-destructive/30" : "border-border")}
    >
      <span>
        <span className="block text-[13.5px] font-medium text-foreground">{title}</span>
        <span className="mt-0.5 block text-[12.5px] text-muted-foreground">{description}</span>
      </span>
      <Trash2 className={"h-4 w-4 shrink-0 " + (destructive ? "text-destructive" : "text-muted-foreground")} />
    </button>
  );
}

// ============================================================
// Audit Log
// ============================================================

function AuditLogSection() {
  const events = useCoreData((s) => s.audit_events);
  const [q, setQ] = useState("");
  const [actor, setActor] = useState("all");
  const [category, setCategory] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const actors = Array.from(new Set(events.map((e) => e.actor)));
  const cats = Array.from(new Set(events.map((e) => e.category)));

  const filtered = events.filter((e) => {
    if (q && !(`${e.action} ${e.target} ${e.summary}`.toLowerCase().includes(q.toLowerCase()))) return false;
    if (actor !== "all" && e.actor !== actor) return false;
    if (category !== "all" && e.category !== category) return false;
    if (from && new Date(e.timestamp) < new Date(from)) return false;
    if (to && new Date(e.timestamp) > new Date(to + "T23:59:59")) return false;
    return true;
  });

  const exportCsv = () => {
    const rows = [["Timestamp", "Actor", "Category", "Action", "Target", "Summary", "Event ID"], ...filtered.map((e) => [e.timestamp, e.actor, e.category, e.action, e.target, e.summary, e.id])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `jojan-audit-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="p-6">
      <SectionHeader title="Audit Log" description="Prototype browser-based audit history - not an immutable production audit trail." />

      <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-6">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search actions, targets, summary…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={actor} onValueChange={setActor}><SelectTrigger><SelectValue placeholder="Actor" /></SelectTrigger><SelectContent><SelectItem value="all">All actors</SelectItem>{actors.map((a) => (<SelectItem key={a} value={a}>{a}</SelectItem>))}</SelectContent></Select>
        <Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{cats.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent></Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <div className="mb-3 flex gap-2">
        <Button variant="outline" size="sm" onClick={() => { setQ(""); setActor("all"); setCategory("all"); setFrom(""); setTo(""); }}>Clear</Button>
        <Button variant="outline" size="sm" onClick={exportCsv}><Download className="mr-1.5 h-3.5 w-3.5" />Export CSV</Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="mr-1.5 h-3.5 w-3.5" />Print</Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead className="text-[11.5px] uppercase tracking-wider text-muted-foreground">
            <tr><th className="py-2 pr-3">Timestamp</th><th className="py-2 pr-3">Actor</th><th className="py-2 pr-3">Category</th><th className="py-2 pr-3">Action</th><th className="py-2 pr-3">Target</th><th className="py-2 pr-3">Summary</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (<tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No matching audit events.</td></tr>)}
            {filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((e) => (
              <tr key={e.id} className="border-t border-border align-top">
                <td className="py-2 pr-3 text-[12.5px] text-muted-foreground">{new Date(e.timestamp).toLocaleString()}</td>
                <td className="py-2 pr-3">{e.actor}</td>
                <td className="py-2 pr-3 capitalize text-muted-foreground">{e.category}</td>
                <td className="py-2 pr-3 font-medium">{e.action}</td>
                <td className="py-2 pr-3 text-muted-foreground">{e.target}</td>
                <td className="py-2 pr-3 text-muted-foreground">{e.summary}{e.before && e.after && <span className="ml-1 text-[11.5px] text-muted-foreground">({e.before} → {e.after})</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ============================================================
// System Information
// ============================================================

function SystemSection() {
  const state = useCoreData((s) => s);
  const settings = state.app_settings;
  const [checks, setChecks] = useState<ReturnType<typeof runSystemChecks> | null>(null);
  const [copied, setCopied] = useState(false);

  const storageBytes = useMemo(() => {
    try {
      if (typeof window === "undefined") return 0;
      const raw = window.localStorage.getItem("jojan_one_core_v1");
      return raw ? new Blob([raw]).size : 0;
    } catch { return 0; }
  }, [state]);

  const connections: Array<[string, boolean, string]> = [
    ["Production database", false, "Not connected"],
    ["Real authentication", false, "Not connected"],
    ["AI model", true, "Deterministic prototype engine"],
    ["Email delivery", false, "Not connected"],
    ["Push notifications", false, "Not connected"],
    ["Companies House", false, "Not connected"],
    ["HMRC", false, "Not connected"],
    ["ICO", false, "Not connected"],
    ["Live regulatory monitoring", false, "Not connected"],
    ["External tender portals", false, "Not connected"],
    ["Document e-signature", false, "Not connected"],
  ];

  const productRows: Array<[string, string]> = [
    ["Product name", "Jojan One"],
    ["Assistant", "Jova"],
    ["Environment", "Prototype / Demonstration"],
    ["Settings schema version", String(settings.schema_version)],
    ["Last data migration", new Date(state.last_refreshed).toLocaleString()],
    ["Browser storage", typeof window !== "undefined" ? "Available (localStorage)" : "Unavailable"],
    ["Approx. stored data", `${(storageBytes / 1024).toFixed(1)} KB`],
    ["Current route", "/settings"],
    ["Build", "prototype-2026.07"],
  ];

  const copyDiagnostic = async () => {
    const summary = {
      product: "Jojan One",
      build: "prototype-2026.07",
      schema_version: settings.schema_version,
      current_route: "/settings",
      browser: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      connections: connections.map(([n, ok, note]) => ({ name: n, connected: ok, note })),
      checks: checks ?? [],
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(summary, null, 2));
      setCopied(true); setTimeout(() => setCopied(false), 2000);
      toast.success("Diagnostic summary copied.");
    } catch { toast.error("Could not copy to clipboard."); }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <SectionHeader title="Product & environment" description="Truthful information about this prototype build." />
        <dl className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {productRows.map(([k, v]) => (
            <div key={k} className="rounded-md border border-border px-3 py-2 text-[13px]">
              <dt className="text-[11.5px] uppercase tracking-wider text-muted-foreground">{k}</dt>
              <dd className="mt-0.5 font-medium text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="p-6">
        <SectionHeader title="Connections" description="No fake green states. Real integrations will be enabled during production." />
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {connections.map(([name, ok, note]) => (
            <div key={name} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-[13px]">
              <span>{name}</span>
              {ok ? (
                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">{note}</Badge>
              ) : (
                <Badge variant="secondary" className="bg-slate-100 text-slate-700">{note}</Badge>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <SectionHeader title="System check" description="Runs safe local checks - does not test external services." />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setChecks(runSystemChecks())}>Run system check</Button>
          <Button variant="outline" onClick={copyDiagnostic}><Copy className="mr-1.5 h-3.5 w-3.5" />{copied ? "Copied" : "Copy diagnostic summary"}</Button>
        </div>
        {checks && (
          <ul className="mt-4 divide-y divide-border rounded-md border border-border">
            {checks.map((c) => (
              <li key={c.name} className="flex items-center justify-between px-3 py-2 text-[13px]">
                <span>{c.name}{c.note && <span className="ml-1 text-[11.5px] text-muted-foreground">- {c.note}</span>}</span>
                <span className={
                  "rounded-full px-2 py-0.5 text-[11.5px] " +
                  (c.status === "passed" ? "bg-emerald-50 text-emerald-700" : c.status === "attention" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-700")
                }>{c.status === "passed" ? "Passed" : c.status === "attention" ? "Attention" : "Not configured"}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11.5px] text-muted-foreground">
          Diagnostic export excludes business records, personal data, conversation contents, document contents, secrets and tokens.
        </p>
      </Card>
    </div>
  );
}

// Prevent unused-import errors for helpers referenced only conditionally.
void formatDate;

// -------------------- Logo Uploader --------------------

const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml";
const LOGO_ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

function LogoUploader({
  value,
  displayName,
  onChange,
  onSaveNow,
}: {
  value: string | null;
  displayName: string;
  onChange: (v: string | null) => void;
  onSaveNow: (v: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [decodeError, setDecodeError] = useState(false);

  const handleFile = (file: File | undefined | null) => {
    setError(null);
    setDecodeError(false);
    if (!file) return;
    if (!LOGO_ALLOWED.has(file.type)) {
      setError("Unsupported file type. Please upload a PNG, JPG, WebP or SVG.");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setError("File is too large. Please choose an image up to 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setError("Could not read the selected file. Please try another image.");
    reader.onload = () => {
      const result = String(reader.result || "");
      if (!result.startsWith("data:image/")) {
        setError("Could not decode the image. Please try another file.");
        return;
      }
      onSaveNow(result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="grid h-14 w-32 place-items-center rounded border border-border bg-background p-1">
          {value && !decodeError ? (
            <img
              src={value}
              alt={`${displayName} logo`}
              className="h-full w-full object-contain"
              onError={() => setDecodeError(true)}
            />
          ) : (
            <span className="text-[11px] text-muted-foreground">{decodeError ? "Cannot display" : "No logo"}</span>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={LOGO_ACCEPT}
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            {value ? "Replace logo" : "Upload logo"}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setError(null);
                setDecodeError(false);
                onSaveNow(null);
              }}
            >
              Remove logo
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onSaveNow(value)}
            title="Persist the current logo immediately"
          >
            Save branding now
          </Button>
        </div>
      </div>
      {error && (
        <p className="text-[12px] text-destructive" role="alert">
          {error}
        </p>
      )}
      <p className="text-[11.5px] text-muted-foreground">
        PNG, JPG, WebP or SVG up to 2 MB. Stored locally in this browser only - not uploaded to any server.
      </p>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-[11.5px] text-muted-foreground">Live preview:</span>
        <div className="rounded border border-border bg-background px-2 py-1">
          <BrandLogo variant="header" />
        </div>
      </div>
    </div>
  );
}