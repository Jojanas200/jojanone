import { Card } from "@/components/ui/card";
import {
  disabledModuleKeys,
  effectiveModel,
  getPlatformSettings,
} from "@/server/services/platform-settings";
import { requirePlatformAdmin } from "@/server/services/platform-admin";
import { listPlansFull } from "@/server/services/platform-plans";
import { MODULES } from "@/config/modules.config";
import {
  ANTHROPIC_DEFAULT_MODEL,
  OPENROUTER_DEFAULT_MODEL,
} from "@/server/ai/provider";
import { PlatformSettingsForm } from "./PlatformSettingsForm";
import { AnnouncementForm } from "./AnnouncementForm";
import { ModuleFlags } from "./ModuleFlags";
import { PlanEditor } from "./PlanEditor";

type Provider = "anthropic" | "openrouter" | "deterministic";

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-foreground">{v}</dd>
    </div>
  );
}

export default async function AdminSettingsPage() {
  const [{ role }, s, plans] = await Promise.all([
    requirePlatformAdmin(),
    getPlatformSettings(),
    listPlansFull(),
  ]);
  const isOperator = role === "operator";
  const disabled = disabledModuleKeys(s.featureFlags);

  // Which providers have a key in this environment (booleans only, no secrets).
  const keyPresent: Record<string, boolean> = {
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    openrouter: !!process.env.OPENROUTER_API_KEY,
    deterministic: true,
  };
  const defaultModel: Record<string, string> = {
    anthropic: ANTHROPIC_DEFAULT_MODEL,
    openrouter: process.env.OPENROUTER_MODEL || OPENROUTER_DEFAULT_MODEL,
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Platform settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cross-tenant configuration for Jojan One. Applies to every workspace.
        </p>
      </div>

      <Card className="max-w-2xl p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">
          Jova intelligence
        </h2>
        {isOperator ? (
          <PlatformSettingsForm
            initial={{
              aiProvider: s.aiProvider as Provider,
              aiModel: s.aiModel ?? "",
              signupsEnabled: s.signupsEnabled,
            }}
            keyPresent={keyPresent}
            defaultModel={defaultModel}
          />
        ) : (
          <dl className="space-y-2 text-sm">
            <Row k="Provider" v={s.aiProvider} />
            <Row k="Model" v={effectiveModel(s.aiProvider, s.aiModel)} />
            <Row k="New sign-ups" v={s.signupsEnabled ? "Enabled" : "Paused"} />
            <p className="pt-2 text-xs text-muted-foreground">
              Changing settings requires operator access.
            </p>
          </dl>
        )}
      </Card>

      {isOperator && (
        <>
          {/* Announcement banner */}
          <Card className="mt-4 max-w-2xl p-6">
            <h2 className="mb-1 text-base font-semibold text-foreground">
              Tenant announcement
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              A banner shown to every workspace in the app. Leave blank for
              none.
            </p>
            <AnnouncementForm
              initial={{
                announcement: s.announcement,
                level: s.announcementLevel,
              }}
            />
          </Card>

          {/* Module kill-switches */}
          <Card className="mt-4 max-w-2xl p-6">
            <h2 className="mb-1 text-base font-semibold text-foreground">
              Module availability
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Turn a module off to hide it across every workspace (a global
              kill-switch). Settings is always available.
            </p>
            <ModuleFlags
              modules={MODULES.filter((m) => m.key !== "settings").map((m) => ({
                key: m.key,
                title: m.title,
              }))}
              disabled={disabled}
            />
          </Card>

          {/* Plan catalogue */}
          <Card className="mt-4 max-w-2xl p-6">
            <h2 className="mb-1 text-base font-semibold text-foreground">
              Plans
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Edit plan names, prices and seat limits. Stripe price IDs stay in
              the environment.
            </p>
            <PlanEditor plans={plans} />
          </Card>
        </>
      )}

      {s.updatedByEmail && (
        <p className="mt-4 text-xs text-muted-foreground">
          Last changed by {s.updatedByEmail} on{" "}
          {new Date(s.updatedAt).toLocaleString("en-GB")}.
        </p>
      )}
    </div>
  );
}
