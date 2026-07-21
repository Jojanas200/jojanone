import { z } from "zod";

// Team invitations.
export const inviteRoleEnum = z.enum([
  "team_member",
  "manager",
  "read_only",
  "adviser",
]);

export const createInviteSchema = z.object({
  email: z.string().trim().email().max(200),
  role: inviteRoleEnum.default("team_member"),
  // Only meaningful for advisers. Empty/omitted = full access. Unknown keys are
  // filtered server-side against the module registry.
  scopedModules: z.array(z.string().max(64)).max(64).optional(),
});

export const acceptInviteSchema = z.object({
  token: z.string().trim().min(10).max(200),
});

// Member management.
export const memberRoleEnum = z.enum([
  "owner_admin",
  "manager",
  "team_member",
  "adviser",
  "read_only",
]);

export const updateMemberSchema = z.object({
  role: memberRoleEnum,
});

// Re-scope an existing adviser. Empty = full access.
export const updateMemberScopeSchema = z.object({
  scopedModules: z.array(z.string().max(64)).max(64),
});

export const transferOwnershipSchema = z.object({
  membershipId: z.string().uuid(),
  stepDownRole: z
    .enum(["manager", "team_member", "read_only"])
    .default("manager"),
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;
