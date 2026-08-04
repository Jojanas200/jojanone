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
  opts: {
    orgName: string;
    workspaceName: string;
    /**
     * The package the customer picked on the pricing page. Recorded as an
     * intent that preselects checkout - it never decides entitlement, or a
     * client could name itself the most expensive package for free. The
     * function discards anything that is not published and sellable.
     */
    intendedPlan?: string | null;
  },
): Promise<string> {
  return withUser(claims, async (tx) => {
    const rows = (await tx.execute(
      sql`select public.provision_workspace(${opts.orgName}, ${opts.workspaceName}, ${opts.intendedPlan ?? null}) as id`,
    )) as unknown as Array<{ id: string }>;
    return rows[0].id;
  });
}
