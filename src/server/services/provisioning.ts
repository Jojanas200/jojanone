import { sql } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";

/**
 * Bootstrap a new tenant for the current user (onboarding).
 * Calls the SECURITY DEFINER RPC provision_workspace(), which creates the
 * organisation, workspace, owner_admin membership, business profile, settings
 * and a trialing Starter subscription - all for auth.uid() (= claims.sub).
 * Returns the new workspace id.
 */
export async function provisionWorkspace(
  claims: UserClaims,
  opts: { orgName: string; workspaceName: string },
): Promise<string> {
  return withUser(claims, async (tx) => {
    const rows = (await tx.execute(
      sql`select public.provision_workspace(${opts.orgName}, ${opts.workspaceName}) as id`,
    )) as unknown as Array<{ id: string }>;
    return rows[0].id;
  });
}
