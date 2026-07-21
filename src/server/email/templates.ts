// Minimal, self-contained HTML email templates. Inline styles only (email
// clients strip <style>/external CSS). Kept plain so they render everywhere.

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function shell(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="font-weight:700;font-size:18px;margin-bottom:16px">Jojan One</div>
    <div style="background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;padding:24px">
      <h1 style="font-size:18px;margin:0 0 12px">${title}</h1>
      ${bodyHtml}
    </div>
    <p style="color:#71717a;font-size:12px;margin-top:16px">Jojan One - your UK business operating system. This is an automated message.</p>
  </div></body></html>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px">${label}</a>`;
}

export function inviteEmail(opts: {
  workspaceName: string;
  inviterEmail: string | null;
  token: string;
}): { subject: string; html: string; text: string } {
  const link = `${appUrl()}/invite/accept?token=${encodeURIComponent(opts.token)}`;
  const by = opts.inviterEmail ? ` by ${opts.inviterEmail}` : "";
  const subject = `You've been invited to ${opts.workspaceName} on Jojan One`;
  const html = shell(
    `Join ${opts.workspaceName}`,
    `<p style="font-size:14px;line-height:1.5">You've been invited${by} to join the <strong>${opts.workspaceName}</strong> workspace on Jojan One.</p>
     <p style="font-size:14px;line-height:1.5">Sign in with this email address, then accept the invitation:</p>
     <p style="margin:20px 0">${button(link, "Accept invitation")}</p>
     <p style="color:#71717a;font-size:12px">This invitation expires in 7 days. If you weren't expecting it, you can ignore this email.</p>`,
  );
  const text = `You've been invited${by} to join ${opts.workspaceName} on Jojan One. Accept: ${link} (expires in 7 days).`;
  return { subject, html, text };
}

export function reminderDigestEmail(opts: {
  workspaceName: string;
  items: { title: string; description: string | null }[];
}): { subject: string; html: string; text: string } {
  const link = `${appUrl()}/dashboard`;
  const rows = opts.items
    .map(
      (i) =>
        `<li style="margin-bottom:8px"><strong>${i.title}</strong>${
          i.description
            ? `<br><span style="color:#71717a">${i.description}</span>`
            : ""
        }</li>`,
    )
    .join("");
  const subject = `${opts.items.length} thing${opts.items.length === 1 ? "" : "s"} need your attention - ${opts.workspaceName}`;
  const html = shell(
    `Your Jojan One reminders`,
    `<p style="font-size:14px;line-height:1.5">These items in <strong>${opts.workspaceName}</strong> are due or need action soon:</p>
     <ul style="font-size:14px;line-height:1.5;padding-left:18px">${rows}</ul>
     <p style="margin:20px 0">${button(link, "Open your dashboard")}</p>`,
  );
  const text =
    `${opts.items.length} items need attention in ${opts.workspaceName}:\n` +
    opts.items.map((i) => `- ${i.title}`).join("\n") +
    `\nOpen: ${link}`;
  return { subject, html, text };
}
