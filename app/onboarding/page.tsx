import { redirect } from "next/navigation";
import { getClaims, getSessionUser } from "@/server/auth/session";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import { getOnboarding } from "@/server/services/onboarding";
import { OnboardingWizard } from "./OnboardingWizard";
import { ThemeSwitcher } from "../ThemeSwitcher";
import type { OnboardingAnswers } from "@/shared/onboarding/types";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
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

  // Seed a couple of account-owner fields from the signed-in user.
  const seeded: OnboardingAnswers = {
    ...(user?.email ? { "owner.work_email": user.email } : {}),
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
            required — you can refine the rest anytime.
          </p>
        </div>
        <OnboardingWizard initialAnswers={seeded} />
      </div>
    </main>
  );
}
