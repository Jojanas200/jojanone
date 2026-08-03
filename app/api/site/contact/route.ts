import { NextResponse } from "next/server";
import { isEmailConfigured, sendEmail } from "@/server/email/provider";

/**
 * The marketing site's contact form.
 *
 * Public and unauthenticated, so it is deliberately narrow: it emails one
 * fixed address and does nothing else. When no email provider is configured it
 * says so rather than reporting a success that never happened - the visitor is
 * then told to write to the address directly.
 */

const TO = process.env.CONTACT_INBOX ?? "hello@jojanone.com";

// A single instance holds this; on serverless it is per-instance rather than
// global. That is enough to stop a naive script without a shared store.
const RECENT = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;

function tooMany(ip: string): boolean {
  const now = Date.now();
  const hits = (RECENT.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  RECENT.set(ip, hits);
  if (RECENT.size > 5000) RECENT.clear();
  return hits.length > MAX_PER_WINDOW;
}

const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const escape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (tooMany(ip)) {
    return NextResponse.json(
      { ok: false, error: "Too many messages. Please try again later." },
      { status: 429 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Bad request" },
      { status: 400 },
    );
  }

  const body = payload as Record<string, unknown>;

  // Honeypot: a field hidden from people, filled in by bots.
  if (clean(body.website, 200)) return NextResponse.json({ ok: true });

  const name = clean(body.name, 120);
  const email = clean(body.email, 200);
  const company = clean(body.company, 160);
  const subject = clean(body.subject, 200);
  const message = clean(body.message, 5000);

  if (!name || !email || !message) {
    return NextResponse.json(
      { ok: false, error: "Name, email and message are required." },
      { status: 400 },
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { ok: false, error: "That email address does not look right." },
      { status: 400 },
    );
  }

  if (!isEmailConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        unconfigured: true,
        error: `Our contact form is not connected yet. Please email ${TO} directly.`,
      },
      { status: 503 },
    );
  }

  const lines = [
    `Name: ${name}`,
    `Email: ${email}`,
    company ? `Company: ${company}` : null,
    subject ? `Subject: ${subject}` : null,
    "",
    message,
  ].filter(Boolean) as string[];

  const result = await sendEmail({
    to: TO,
    subject: subject
      ? `Website enquiry: ${subject}`
      : `Website enquiry from ${name}`,
    text: lines.join("\n"),
    html: lines.map((line) => `<p>${escape(line)}</p>`).join(""),
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: `We could not send that. Please email ${TO} directly.`,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
