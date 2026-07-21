import Link from "next/link";
import { BrandLogo } from "../../BrandLogo";
import { ThemeSwitcher } from "../../ThemeSwitcher";
import { ResetRequestForm } from "./ResetRequestForm";

export default function ResetRequestPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4">
      <div className="absolute right-4 top-4">
        <ThemeSwitcher />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo className="h-16 w-auto" priority />
          <h1 className="mt-4 text-lg font-semibold text-foreground">
            Reset your password
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>
        <ResetRequestForm />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link href="/login" className="hover:text-foreground">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
