import { redirect } from "next/navigation";
import { getClaims, getSessionUser } from "@/server/auth/session";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import { getOnboarding } from "@/server/services/onboarding";
import { listPublishedPlans } from "@/server/services/platform-plans";
import { OnboardingWizard } from "./OnboardingWizard";
import { ThemeSwitcher } from "../ThemeSwitcher";
import type { OnboardingAnswers } from "@/shared/onboarding/types";

export const dynamic = "force-dynamic";

const money = (minor: number | null, currency: string, interval: string) =>
  minor === null
    ? "Talk to us"
    : minor === 0
      ? "Free"
      : `${new Intl.NumberFormat("en-GB", {
          style: "currency",
          currency,
          maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
        }).format(minor / 100)}/${interval}`;

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  const user = await getSessionUser();

  const ws = await getActiveWorkspaceId(claims);
  let answers: OnboardingAnswers = {};
  if (ws) {
    const state = await getOnboarding(claims, ws);
    if (state.completedAt) redirect("/dashboard");
    answers = state.answers;
  }

  // The packages an operator has actually published, so the billing step can
  // never offer something that is not for sale.
  const published = await listPublishedPlans();
  const planOptions = published.map((plan) => ({
    value: plan.key,
    label: `${plan.name} - ${money(plan.priceMinor, plan.currency, plan.billingInterval)}${
      plan.seatLimit === null ? "" : ` (${plan.seatLimit} seats)`
    }`,
  }));

  // The package chosen on the pricing page: from the URL, or from the account
  // metadata stamped at sign-up when the confirmation email dropped the query
  // string. Only preselects; a package the operator has not published is
  // ignored, and an answer already given always wins.
  const { plan: fromUrl } = await searchParams;
  const wanted = fromUrl ?? user?.intendedPlan ?? null;
  const preselected =
    wanted && planOptions.some((option) => option.value === wanted)
      ? wanted
      : null;

  // Seed a couple of account-owner fields from the signed-in user.
  const seeded: OnboardingAnswers = {
    ...(user?.email ? { "owner.work_email": user.email } : {}),
    ...(preselected ? { "billing.plan": preselected } : {}),
    ...answers,
  };

  return (
    <main className="relative min-h-screen bg-background px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeSwitcher persist />
      </div>
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Welcome to Jojan One
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A few questions to set up your workspace. Only a handful are
            required - you can refine the rest anytime.
          </p>
        </div>
        <OnboardingWizard initialAnswers={seeded} planOptions={planOptions} />
      </div>
    </main>
  );
}
