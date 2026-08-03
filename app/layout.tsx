import "./globals.css";
import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Jojan One",
  description:
    "Your business, protected. Compliance, risk and readiness in one workspace.",
};

// Applies the persisted theme to <html> before first paint (no flash). Prefers
// the jj-theme cookie (set from the user's DB pref, so it carries across
// devices) and falls back to localStorage. Toggled by ThemeSwitcher.
const THEME_INIT = `(function(){try{var m=document.cookie.match(/(?:^|;\\s*)jj-theme=(default|dark|neumorph)/);var t=m?m[1]:localStorage.getItem('jj-theme');if(t==='neumorph'||t==='dark'||t==='default')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Serif+Display&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
