"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

type State =
  | { kind: "loading" }
  | { kind: "ok" }
  | { kind: "signin" }
  | { kind: "error"; message: string };

export function AcceptInvite() {
  const token = useSearchParams().get("token");
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!token) {
      setState({
        kind: "error",
        message: "This invitation link is missing its token.",
      });
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/team/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (res.status === 401) {
          setState({ kind: "signin" });
          return;
        }
        const data = await res.json();
        if (!res.ok)
          setState({
            kind: "error",
            message: data?.error ?? "Could not accept.",
          });
        else setState({ kind: "ok" });
      } catch {
        setState({ kind: "error", message: "Something went wrong." });
      }
    })();
  }, [token]);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 text-xl font-bold text-foreground">Jojan One</div>
      {state.kind === "loading" && (
        <p className="text-sm text-muted-foreground">
          Accepting your invitation…
        </p>
      )}
      {state.kind === "ok" && (
        <>
          <h1 className="text-lg font-semibold text-foreground">
            You&apos;re in! 🎉
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You&apos;ve joined the workspace.
          </p>
          <Button asChild className="mt-4">
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </>
      )}
      {state.kind === "signin" && (
        <>
          <h1 className="text-lg font-semibold text-foreground">
            Sign in to accept
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in with the email address this invitation was sent to, then
            reopen this link.
          </p>
          <Button asChild className="mt-4">
            <Link href="/login">Sign in</Link>
          </Button>
        </>
      )}
      {state.kind === "error" && (
        <>
          <h1 className="text-lg font-semibold text-foreground">
            Invitation problem
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{state.message}</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/login">Go to sign in</Link>
          </Button>
        </>
      )}
    </div>
  );
}
