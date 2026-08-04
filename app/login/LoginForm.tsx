"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

/** Package keys are slugs; anything else in the URL is ignored. */
const asPlanKey = (v: string | null) =>
  v && /^[a-z0-9][a-z0-9-]{0,48}$/.test(v) ? v : null;

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  // The package chosen on the pricing page, arriving as ?plan=. It preselects
  // the billing step in onboarding; it never grants entitlement.
  const [plan, setPlan] = useState<string | null>(null);

  // Surface an error passed back from the /auth/callback route, then clean it
  // out of the URL so it doesn't linger on refresh. The plan is read here too,
  // and deliberately left in the URL so it survives a refresh.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPlan(asPlanKey(params.get("plan")));
    const err = params.get("error");
    if (err) {
      toast.error(err);
      params.delete("error");
      const query = params.toString();
      window.history.replaceState(
        {},
        "",
        query
          ? `${window.location.pathname}?${query}`
          : window.location.pathname,
      );
    }
  }, []);

  // Signing in with a package in hand goes to onboarding so the billing step
  // can be preselected; the app redirects on to the dashboard if that
  // workspace has already finished onboarding.
  const destination = plan
    ? `/onboarding?plan=${encodeURIComponent(plan)}`
    : "/dashboard";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push(destination);
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destination)}`,
            // Stamped on the account so the choice survives the confirmation
            // email, which a query string would not.
            data: {
              full_name: fullName.trim(),
              ...(plan ? { intended_plan: plan } : {}),
            },
          },
        });
        if (error) throw error;
        if (data.session) {
          router.push(destination);
          router.refresh();
        } else {
          toast.success("Account created", {
            description: "Check your email to confirm, then sign in.",
          });
          setMode("signin");
        }
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm"
    >
      {mode === "signup" && (
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            required
            minLength={2}
            maxLength={200}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            placeholder="Shown on certificates and team lists"
          />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          {mode === "signin" && (
            <Link
              href="/auth/reset"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Forgot password?
            </Link>
          )}
        </div>
        <PasswordInput
          id="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading
          ? "Please wait…"
          : mode === "signin"
            ? "Sign in"
            : "Create account"}
      </Button>

      <button
        type="button"
        onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
        className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
      >
        {mode === "signin"
          ? "Need an account? Create one"
          : "Have an account? Sign in"}
      </button>
    </form>
  );
}
