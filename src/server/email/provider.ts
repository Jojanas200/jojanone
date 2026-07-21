// Pluggable transactional email. Build-now-key-later: with no RESEND_API_KEY
// the provider is "not configured" and callers skip sending (features still
// work in-app). Set EMAIL_PROVIDER=console for local dev to log instead of send.

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  ok: boolean;
  id?: string;
  skipped?: boolean;
  error?: string;
}

export interface EmailProvider {
  readonly name: string;
  isConfigured(): boolean;
  send(msg: EmailMessage): Promise<EmailResult>;
}

const fromAddress = () =>
  process.env.EMAIL_FROM ?? "Jojan One <no-reply@jojan.one>";

// --- Resend (raw HTTP; provider-neutral) -------------------------------------
class ResendProvider implements EmailProvider {
  readonly name = "resend";
  isConfigured() {
    return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
  }
  async send(msg: EmailMessage): Promise<EmailResult> {
    if (!this.isConfigured()) return { ok: false, skipped: true };
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
    });
    if (!res.ok)
      return { ok: false, error: `Resend ${res.status}: ${await res.text()}` };
    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id };
  }
}

// --- Console (local dev) -----------------------------------------------------
class ConsoleProvider implements EmailProvider {
  readonly name = "console";
  isConfigured() {
    return true;
  }
  async send(msg: EmailMessage): Promise<EmailResult> {
    console.log(`[email:console] → ${msg.to} · ${msg.subject}`);
    return { ok: true, id: "console" };
  }
}

const PROVIDERS: Record<string, EmailProvider> = {
  resend: new ResendProvider(),
  console: new ConsoleProvider(),
};

export function getEmailProvider(): EmailProvider {
  const key = (process.env.EMAIL_PROVIDER ?? "resend").toLowerCase();
  return PROVIDERS[key] ?? PROVIDERS.resend;
}

export function isEmailConfigured(): boolean {
  return getEmailProvider().isConfigured();
}

/** Send via the active provider; never throws (returns an error result). */
export async function sendEmail(
  msg: EmailMessage,
  opts?: { provider?: EmailProvider },
): Promise<EmailResult> {
  const provider = opts?.provider ?? getEmailProvider();
  if (!provider.isConfigured()) return { ok: false, skipped: true };
  try {
    return await provider.send(msg);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
