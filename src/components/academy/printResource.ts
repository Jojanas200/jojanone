import { RESOURCE_DISCLAIMER, type Course } from "@/data/academy-catalog";

export function printCourseResource(
  course: Course,
  businessName: string,
  opts?: { logoDataUrl?: string | null; displayName?: string },
) {
  const r = course.resource;
  if (!r) return;
  const logo = opts?.logoDataUrl ?? null;
  const displayName = opts?.displayName || businessName;
  const sections = r.sections
    .map(
      (s) => `
      <h3 style="font-size:14px;margin:16px 0 6px 0;color:#111827;">${escape(s.heading)}</h3>
      <ul style="margin:0 0 8px 20px;padding:0;">
        ${s.items.map((i) => `<li style="margin:4px 0;font-size:13px;color:#1F2937;">${escape(i)}</li>`).join("")}
      </ul>`,
    )
    .join("");
  const html = `
    <div style="font-family:Inter,system-ui,sans-serif;padding:32px;max-width:720px;margin:0 auto;color:#1B2A4A;">
      ${logo ? `<div style="margin-bottom:10px;"><img src="${escape(logo)}" alt="${escape(displayName)} logo" style="max-height:48px;max-width:180px;object-fit:contain;" onerror="this.style.display='none'"/></div>` : ""}
      <p style="font-size:11px;letter-spacing:.2em;color:#2563EB;text-transform:uppercase;font-weight:600;">Jojan One Academy</p>
      <p style="color:#6B7280;font-size:12px;margin-top:2px;">Learning resource for ${escape(businessName)}</p>
      <h1 style="font-size:22px;margin:14px 0 4px 0;">${escape(r.title)}</h1>
      <p style="color:#6B7280;font-size:13px;margin:0 0 6px 0;">From course: ${escape(course.title)}</p>
      ${r.intro ? `<p style="font-size:13px;color:#374151;margin-top:8px;">${escape(r.intro)}</p>` : ""}
      ${sections}
      <p style="margin-top:32px;padding-top:12px;border-top:1px solid #E5E7EB;font-size:11px;color:#6B7280;">${escape(RESOURCE_DISCLAIMER)}</p>
    </div>`;
  const win = window.open("", "_blank", "width=800,height=900");
  if (!win) {
    window.print();
    return;
  }
  win.document.write(
    `<!doctype html><html><head><title>${escape(course.title)} - Resource</title></head><body>${html}</body></html>`,
  );
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 200);
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
