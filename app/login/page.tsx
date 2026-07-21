import { BrandLogo } from "../BrandLogo";
import { LoginForm } from "./LoginForm";
import { ThemeSwitcher } from "../ThemeSwitcher";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4">
      <div className="absolute right-4 top-4">
        <ThemeSwitcher />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo className="h-16 w-auto" priority />
          <p className="mt-4 text-sm text-muted-foreground">
            Your business, protected - sign in to continue.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
