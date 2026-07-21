"use client";
import { createContext, useContext } from "react";

// Client-side access context, seeded server-side by the app layout. Write
// components read `canWrite` to hide affordances that RLS would reject for
// read-only members and advisers; `allowedModules` scopes advisers' navigation.

export interface Access {
  canWrite: boolean;
  role: string;
  allowedModules: string[] | null; // null = all
}

const AccessContext = createContext<Access>({
  canWrite: false,
  role: "read_only",
  allowedModules: null,
});

export function AccessProvider({
  value,
  children,
}: {
  value: Access;
  children: React.ReactNode;
}) {
  return (
    <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
  );
}

export const useAccess = () => useContext(AccessContext);
