import Link from "next/link";
import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import {
  getActiveWorkspaceId,
  getWorkspaceRole,
} from "@/server/services/workspaces";
import {
  getBusinessProfile,
  getWorkspace,
  listMembers,
} from "@/server/services/settings";
import { getBillingOverview } from "@/server/services/billing";
import { getOnboarding, isStarted } from "@/server/services/onboarding";
import { listPendingInvitations } from "@/server/services/invitations";
import { getUserEmails } from "@/server/services/members";
import { InviteTeammate } from "./InviteTeammate";
import { PendingInvites } from "./PendingInvites";
import { MembersTable } from "./MembersTable";
import { PermissionsMatrix } from "./PermissionsMatrix";
import { PreferencesForm } from "./PreferencesForm";
import { getUserPrefs } from "@/server/services/prefs";
import { getActivityFeed } from "@/server/services/timeline";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileForm } from "./ProfileForm";
import { WorkspaceForm } from "./WorkspaceForm";
import { ThemeSelector } from "./ThemeSelector";
import { DocumentUploader } from "../../onboarding/DocumentUploader";

export default async function SettingsPage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  const ws = await getActiveWorkspaceId(claims);
  if (!ws) redirect("/onboarding");

  const [
    profile,
    workspace,
    members,
    role,
    overview,
    invites,
    onboarding,
    prefs,
  ] = await Promise.all([
    getBusinessProfile(claims, ws),
    getWorkspace(claims, ws),
    listMembers(claims, ws),
    getWorkspaceRole(claims, ws),
    getBillingOverview(claims, ws),
    listPendingInvitations(claims, ws),
    getOnboarding(claims, ws),
    getUserPrefs(claims),
  ]);
  const auditTrail = (await getActivityFeed(claims))
    .filter((a) => a.module === "team" || a.module === "settings")
    .slice(0, 50);
  const showResumeSetup =
    isStarted(onboarding) && onboarding.completedAt === null;

  if (!profile || !workspace) redirect("/onboarding");
  const isOwner = role === "owner_admin";
  const seatsAvailable = overview?.seatsAvailable ?? 0;
  const emails = await getUserEmails(members.map((m) => m.userId));

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your business, your data, your control.
        </p>
      </div>

      {showResumeSetup && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <p className="text-sm text-foreground">
            Your workspace setup isn&apos;t finished yet - your saved answers
            are waiting.
          </p>
          <Link
            href="/onboarding"
            className="text-sm font-medium text-primary hover:underline"
          >
            Resume setup →
          </Link>
        </div>
      )}

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Business profile</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <Card className="p-6">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Business profile
                </h2>
                <p className="text-sm text-muted-foreground">
                  Powers your Business Confidence Score and Jova&apos;s
                  guidance.
                </p>
              </div>
              <div className="w-40 shrink-0">
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>Completion</span>
                  <span>{profile.profileCompletion}%</span>
                </div>
                <Progress value={profile.profileCompletion} />
              </div>
            </div>
            <ProfileForm profile={profile} />
          </Card>
        </TabsContent>

        <TabsContent value="workspace" className="mt-4 space-y-4">
          <Card className="p-6">
            <h2 className="mb-4 text-base font-semibold text-foreground">
              Workspace
            </h2>
            <WorkspaceForm workspace={workspace} />
          </Card>

          <Card className="p-6">
            <h2 className="text-base font-semibold text-foreground">
              Company logo
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Upload your logo to brand your workspace - it replaces the Jojan
              One mark in the sidebar for everyone on your team.
            </p>
            <DocumentUploader variant="logo" />
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="mt-4">
          <PreferencesForm initial={prefs} />
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card className="overflow-hidden p-0">
            <div className="border-b border-border p-4">
              <h2 className="text-base font-semibold text-foreground">
                Workspace audit trail
              </h2>
              <p className="text-sm text-muted-foreground">
                Team and settings changes, newest first. Record-level activity
                lives on the Timeline.
              </p>
            </div>
            {auditTrail.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                No team or settings changes recorded yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {auditTrail.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate text-foreground">
                      {a.title}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {a.actorEmail ?? "System"} ·{" "}
                      {new Date(a.createdAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        timeZone: "Europe/London",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="mt-4">
          <Card className="p-6">
            <h2 className="text-base font-semibold text-foreground">Theme</h2>
            <p className="mb-5 text-sm text-muted-foreground">
              Choose how Jojan One looks. Your choice is saved to your account
              and follows you across devices and the sign-in page.
            </p>
            <ThemeSelector />
          </Card>
        </TabsContent>

        <TabsContent value="members" className="mt-4 space-y-4">
          {isOwner && (
            <Card className="space-y-4 p-6">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Invite your team
                </h2>
                <p className="text-sm text-muted-foreground">
                  {overview
                    ? `${overview.seatsUsed} of ${overview.seatsAllowed} seats used · ${seatsAvailable} available.`
                    : "Invite teammates to your workspace."}
                </p>
              </div>
              <InviteTeammate seatsAvailable={seatsAvailable} />
              <PendingInvites
                invites={invites.map((i) => ({
                  ...i,
                  expiresAt: i.expiresAt as unknown as string,
                }))}
              />
            </Card>
          )}

          <Card className="overflow-hidden p-0">
            <div className="border-b border-border p-4">
              <h2 className="text-base font-semibold text-foreground">
                Members
              </h2>
              <p className="text-sm text-muted-foreground">
                {isOwner
                  ? "Change roles, transfer ownership or remove people. Promote a member to Owner to add a co-owner."
                  : "People with access to this workspace."}
              </p>
            </div>
            <MembersTable
              currentUserId={claims.sub}
              isOwner={isOwner}
              members={members.map((m) => ({
                id: m.id,
                userId: m.userId,
                role: m.role,
                scopedModules: m.scopedModules,
                email: emails[m.userId] ?? null,
                createdAt: m.createdAt as unknown as string,
              }))}
            />
          </Card>
          <div className="mt-4">
            <PermissionsMatrix />
          </div>
        </TabsContent>

        <TabsContent value="data" className="mt-4">
          <Card className="p-6">
            <h2 className="text-base font-semibold text-foreground">
              Export your data
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Download everything in this workspace - contracts, compliance,
              risk, HR, GDPR, governance, evidence, reports and your Jova
              history - as a single JSON file (GDPR data portability). Your data
              stays in the UK and is never used to train AI.
            </p>
            {role === "owner_admin" || role === "manager" ? (
              <a
                href="/api/export"
                className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90"
              >
                Download my data (JSON)
              </a>
            ) : (
              <p className="mt-5 text-sm text-muted-foreground">
                Only an owner or manager can export the workspace&apos;s data.
              </p>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
