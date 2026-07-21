import { BrandLogo } from "../../../BrandLogo";
import { ThemeSwitcher } from "../../../ThemeSwitcher";
import { UpdatePasswordForm } from "./UpdatePasswordForm";

export default function UpdatePasswordPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4">
      <div className="absolute right-4 top-4">
        <ThemeSwitcher />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo className="h-16 w-auto" priority />
          <h1 className="mt-4 text-lg font-semibold text-foreground">
            Set a new password
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a new password for your account.
          </p>
        </div>
        <UpdatePasswordForm />
      </div>
    </main>
  );
}
