import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Header,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { finalisedContent } from "../../shared/policies/check";

// Policy document exports. Drafts are clearly watermarked "DRAFT - REVIEW
// BEFORE USE" and include Jova's recommendations as a labelled appendix.
// Final (adopted) exports are clean: document-control block plus the policy
// wording only - recommendations, draft disclaimers and advice stripped.

export interface ExportPolicy {
  policyName: string;
  policyCategory: string | null;
  version: string;
  owner: string | null;
  status: string;
  approvalDate: string | null;
  reviewDate: string | null;
  adoptedAt: Date | null;
  content: string | null;
  jovaRecommendations: string[];
}

const DRAFT_LABEL = "DRAFT - REVIEW BEFORE USE";

const fmt = (d: string | Date | null) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "-";

function controlRows(p: ExportPolicy, businessName: string | null) {
  const rows: [string, string][] = [
    ["Document title", p.policyName],
    ["Business", businessName ?? "-"],
    ["Category", p.policyCategory ?? "-"],
    ["Version", `v${p.version}`],
    ["Status", p.status === "active" ? "Active (adopted)" : "Draft"],
    ["Owner", p.owner ?? "-"],
    ["Effective date", fmt(p.approvalDate)],
    ["Next review date", fmt(p.reviewDate)],
  ];
  if (p.status === "active" && p.adoptedAt)
    rows.splice(7, 0, ["Adopted", fmt(p.adoptedAt)]);
  return rows;
}

function bodyText(p: ExportPolicy, draft: boolean): string {
  const raw = p.content ?? "";
  return draft ? raw : finalisedContent(raw);
}

const isHeading = (line: string) => /^\d+\.\s/.test(line.trim());

// --- PDF ---------------------------------------------------------------------

export async function renderPolicyPdf(
  policy: ExportPolicy,
  businessName: string | null,
): Promise<Uint8Array> {
  const draft = policy.status !== "active";
  const doc = await PDFDocument.create();
  doc.setTitle(`${policy.policyName} (v${policy.version})`);
  doc.setAuthor("Jojan One");

  const W = 595.28;
  const H = 841.89;
  const M = 64;
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const NAVY = rgb(0.09, 0.12, 0.2);
  const GREY = rgb(0.42, 0.45, 0.5);
  const LIGHT = rgb(0.85, 0.86, 0.88);
  const RED = rgb(0.75, 0.15, 0.15);

  let pageNo = 0;
  let page = doc.addPage([W, H]);
  let y = H - M;

  const decorate = () => {
    pageNo += 1;
    if (draft) {
      page.drawText("DRAFT", {
        x: 120,
        y: 240,
        size: 110,
        font: bold,
        color: rgb(0.94, 0.94, 0.95),
        rotate: degrees(45),
      });
      page.drawText(DRAFT_LABEL, {
        x: M,
        y: H - 34,
        size: 10,
        font: bold,
        color: RED,
      });
    }
    page.drawText(`Jojan One - ${policy.policyName} v${policy.version}`, {
      x: M,
      y: 30,
      size: 7.5,
      font: helv,
      color: GREY,
    });
    const pn = `Page ${pageNo}`;
    page.drawText(pn, {
      x: W - M - helv.widthOfTextAtSize(pn, 7.5),
      y: 30,
      size: 7.5,
      font: helv,
      color: GREY,
    });
  };
  const newPage = () => {
    page = doc.addPage([W, H]);
    y = H - M;
    decorate();
  };
  decorate();

  const ensure = (needed: number) => {
    if (y - needed < 56) newPage();
  };
  const wrap = (
    text: string,
    font: typeof helv,
    size: number,
    width: number,
  ) => {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line);
        line = w;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  };
  const para = (
    text: string,
    font: typeof helv,
    size: number,
    color = NAVY,
    leading = size * 1.45,
  ) => {
    for (const l of wrap(text, font, size, W - 2 * M)) {
      ensure(leading);
      page.drawText(l, { x: M, y, size, font, color });
      y -= leading;
    }
  };

  // Header block.
  page.drawText("J O J A N   O N E", {
    x: M,
    y,
    size: 9,
    font: bold,
    color: GREY,
  });
  y -= 26;
  para(policy.policyName, bold, 20, NAVY, 25);
  para(
    `${policy.policyCategory ?? "Policy"} · v${policy.version} · ${
      policy.status === "active" ? "Active (adopted)" : "Draft"
    }`,
    helv,
    10,
    GREY,
  );
  y -= 10;

  // Document control table.
  ensure(20);
  page.drawText("Document control", {
    x: M,
    y,
    size: 12,
    font: bold,
    color: NAVY,
  });
  y -= 18;
  for (const [k, v] of controlRows(policy, businessName)) {
    ensure(18);
    page.drawLine({
      start: { x: M, y: y + 12 },
      end: { x: W - M, y: y + 12 },
      thickness: 0.5,
      color: LIGHT,
    });
    page.drawText(k, { x: M, y, size: 9.5, font: helv, color: GREY });
    for (const l of wrap(v, helv, 9.5, W - 2 * M - 170)) {
      page.drawText(l, { x: M + 170, y, size: 9.5, font: helv, color: NAVY });
      y -= 14;
    }
    y -= 2;
  }
  y -= 14;

  // Body.
  const lines = bodyText(policy, draft).split("\n");
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      y -= 6;
      continue;
    }
    if (isHeading(t)) {
      ensure(30);
      y -= 8;
      para(t, bold, 12, NAVY, 16);
    } else {
      para(t, helv, 10, NAVY, 14.5);
    }
  }

  // Draft appendix: Jova's recommendations, clearly not part of the policy.
  if (draft && policy.jovaRecommendations.length > 0) {
    y -= 12;
    ensure(40);
    para("JOVA RECOMMENDATIONS (not part of this policy)", bold, 11, RED, 15);
    para(
      "Points Jova believes the business should confirm or resolve before adopting. These are removed from the final adopted document.",
      helv,
      9,
      GREY,
      13,
    );
    y -= 4;
    for (const r of policy.jovaRecommendations)
      para(`- ${r}`, helv, 10, NAVY, 14.5);
  }

  return doc.save();
}

// --- DOCX --------------------------------------------------------------------

export async function renderPolicyDocx(
  policy: ExportPolicy,
  businessName: string | null,
): Promise<Buffer> {
  const draft = policy.status !== "active";

  const children: Paragraph[] = [];
  if (draft)
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [
          new TextRun({
            text: DRAFT_LABEL,
            bold: true,
            color: "B91C1C",
            size: 26,
          }),
        ],
      }),
    );
  children.push(
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: "JOJAN ONE",
          bold: true,
          color: "6B7280",
          size: 18,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: policy.policyName, bold: true, size: 40 }),
      ],
    }),
    new Paragraph({
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: `${policy.policyCategory ?? "Policy"} · v${policy.version} · ${
            policy.status === "active" ? "Active (adopted)" : "Draft"
          }`,
          color: "6B7280",
          size: 20,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({ text: "Document control", bold: true, size: 24 }),
      ],
    }),
  );

  const border = { style: BorderStyle.SINGLE, size: 2, color: "D1D5DB" };
  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: controlRows(policy, businessName).map(
      ([k, v]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 32, type: WidthType.PERCENTAGE },
              borders: {
                top: border,
                bottom: border,
                left: border,
                right: border,
              },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: k, color: "6B7280", size: 19 }),
                  ],
                }),
              ],
            }),
            new TableCell({
              borders: {
                top: border,
                bottom: border,
                left: border,
                right: border,
              },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: v, size: 19 })],
                }),
              ],
            }),
          ],
        }),
    ),
  });

  const body: (Paragraph | Table)[] = [
    ...children,
    table,
    new Paragraph({ text: "" }),
  ];
  for (const line of bodyText(policy, draft).split("\n")) {
    const t = line.trim();
    if (!t) continue;
    body.push(
      new Paragraph({
        spacing: isHeading(t) ? { before: 240, after: 100 } : { after: 100 },
        children: [
          new TextRun({
            text: t,
            bold: isHeading(t),
            size: isHeading(t) ? 24 : 20,
          }),
        ],
      }),
    );
  }
  if (draft && policy.jovaRecommendations.length > 0) {
    body.push(
      new Paragraph({
        spacing: { before: 360, after: 100 },
        children: [
          new TextRun({
            text: "JOVA RECOMMENDATIONS (not part of this policy)",
            bold: true,
            color: "B91C1C",
            size: 22,
          }),
        ],
      }),
    );
    for (const r of policy.jovaRecommendations)
      body.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun({ text: r, size: 20 })],
        }),
      );
  }

  const docx = new Document({
    sections: [
      {
        headers: draft
          ? {
              default: new Header({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: DRAFT_LABEL,
                        bold: true,
                        color: "B91C1C",
                        size: 18,
                      }),
                    ],
                  }),
                ],
              }),
            }
          : undefined,
        children: body,
      },
    ],
  });
  return Packer.toBuffer(docx);
}
