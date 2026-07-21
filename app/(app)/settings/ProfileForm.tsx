"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type Profile = {
  businessName: string;
  companyNumber: string | null;
  businessType: string | null;
  industry: string | null;
  incorporationDate: string | null;
  registeredAddress: string | null;
  tradingAddress: string | null;
  financialYearEnd: string | null;
  employeeCount: number;
  contractorCount: number;
  customerCount: number;
  supplierCount: number;
  annualRevenueBand: string | null;
  vatRegistered: boolean;
  employerRegistered: boolean;
  processesPersonalData: boolean;
  tradesInternationally: boolean;
};

const s = (v: string | null) => v ?? "";

export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [f, setF] = useState({
    businessName: s(profile.businessName),
    companyNumber: s(profile.companyNumber),
    businessType: s(profile.businessType),
    industry: s(profile.industry),
    incorporationDate: s(profile.incorporationDate),
    registeredAddress: s(profile.registeredAddress),
    tradingAddress: s(profile.tradingAddress),
    financialYearEnd: s(profile.financialYearEnd),
    employeeCount: String(profile.employeeCount),
    contractorCount: String(profile.contractorCount),
    customerCount: String(profile.customerCount),
    supplierCount: String(profile.supplierCount),
    annualRevenueBand: s(profile.annualRevenueBand),
    vatRegistered: profile.vatRegistered,
    employerRegistered: profile.employerRegistered,
    processesPersonalData: profile.processesPersonalData,
    tradesInternationally: profile.tradesInternationally,
  });

  const setText =
    (k: keyof typeof f) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setF((p) => ({ ...p, [k]: e.target.value }));
  const setBool = (k: keyof typeof f) => (v: boolean) =>
    setF((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const num = (v: string) => (v.trim() === "" ? 0 : Number(v));
      const orNull = (v: string) => (v.trim() === "" ? null : v.trim());
      const payload = {
        businessName: f.businessName.trim(),
        companyNumber: orNull(f.companyNumber),
        businessType: orNull(f.businessType),
        industry: orNull(f.industry),
        incorporationDate: orNull(f.incorporationDate),
        registeredAddress: orNull(f.registeredAddress),
        tradingAddress: orNull(f.tradingAddress),
        financialYearEnd: orNull(f.financialYearEnd),
        employeeCount: num(f.employeeCount),
        contractorCount: num(f.contractorCount),
        customerCount: num(f.customerCount),
        supplierCount: num(f.supplierCount),
        annualRevenueBand: orNull(f.annualRevenueBand),
        vatRegistered: f.vatRegistered,
        employerRegistered: f.employerRegistered,
        processesPersonalData: f.processesPersonalData,
        tradesInternationally: f.tradesInternationally,
      };
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success("Profile saved");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const text = (
    label: string,
    key: keyof typeof f,
    props?: { placeholder?: string; type?: string },
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type={props?.type ?? "text"}
        value={f[key] as string}
        onChange={setText(key)}
        placeholder={props?.placeholder}
      />
    </div>
  );

  const toggle = (label: string, key: keyof typeof f, hint: string) => (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={f[key] as boolean} onCheckedChange={setBool(key)} />
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {text("Business name", "businessName", { placeholder: "Acme Ltd" })}
        {text("Company number", "companyNumber", { placeholder: "12345678" })}
        {text("Business type", "businessType", {
          placeholder: "Private limited company",
        })}
        {text("Industry", "industry", { placeholder: "Professional services" })}
        {text("Incorporation date", "incorporationDate", { type: "date" })}
        {text("Financial year end", "financialYearEnd", {
          placeholder: "31 March",
        })}
        {text("Annual revenue band", "annualRevenueBand", {
          placeholder: "£250k–£1m",
        })}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="registeredAddress">Registered address</Label>
        <Textarea
          id="registeredAddress"
          rows={2}
          value={f.registeredAddress}
          onChange={setText("registeredAddress")}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tradingAddress">Trading address</Label>
        <Textarea
          id="tradingAddress"
          rows={2}
          value={f.tradingAddress}
          onChange={setText("tradingAddress")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {text("Employees", "employeeCount", { type: "number" })}
        {text("Contractors", "contractorCount", { type: "number" })}
        {text("Customers", "customerCount", { type: "number" })}
        {text("Suppliers", "supplierCount", { type: "number" })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {toggle(
          "VAT registered",
          "vatRegistered",
          "Registered for VAT with HMRC.",
        )}
        {toggle(
          "Employer registered",
          "employerRegistered",
          "Registered as an employer (PAYE).",
        )}
        {toggle(
          "Processes personal data",
          "processesPersonalData",
          "Handles personal data (GDPR applies).",
        )}
        {toggle(
          "Trades internationally",
          "tradesInternationally",
          "Buys or sells outside the UK.",
        )}
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
