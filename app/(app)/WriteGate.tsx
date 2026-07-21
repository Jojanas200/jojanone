"use client";
import { useAccess } from "./access";

// Renders its children only for members who can write (owner_admin, manager,
// team_member). Read-only members and advisers see nothing — matching what RLS
// enforces server-side, so the UI never offers an action that would be rejected.
export function WriteGate({ children }: { children: React.ReactNode }) {
  const { canWrite } = useAccess();
  if (!canWrite) return null;
  return <>{children}</>;
}
