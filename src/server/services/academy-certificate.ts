import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// Branded Jojan One Certificate of Completion, rendered as a real PDF so it
// can be downloaded and kept as training evidence. Pure function of the
// certificate data (plus optional logo bytes) so it is directly verifiable.

export interface CertificateData {
  reference: string;
  learnerName: string | null;
  courseTitle: string;
  quizScore: number;
  durationMinutes: number | null;
  completedAt: Date;
  businessName?: string | null;
}

const NAVY = rgb(0.09, 0.12, 0.2);
const GOLD = rgb(0.72, 0.55, 0.22);
const GREY = rgb(0.42, 0.45, 0.5);

export async function renderCertificatePdf(
  cert: CertificateData,
  logoPng?: Uint8Array | null,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Jojan One Certificate of Completion - ${cert.reference}`);
  doc.setAuthor("Jojan One Academy");

  // A4 landscape.
  const W = 841.89;
  const H = 595.28;
  const page = doc.addPage([W, H]);

  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const serifItalic = await doc.embedFont(StandardFonts.TimesRomanBoldItalic);

  const centerX = (text: string, font: typeof helv, size: number) =>
    (W - font.widthOfTextAtSize(text, size)) / 2;
  const drawCentered = (
    text: string,
    y: number,
    font: typeof helv,
    size: number,
    color = NAVY,
  ) =>
    page.drawText(text, { x: centerX(text, font, size), y, font, size, color });

  // Double frame: navy outer, gold inner.
  page.drawRectangle({
    x: 22,
    y: 22,
    width: W - 44,
    height: H - 44,
    borderColor: NAVY,
    borderWidth: 2.5,
  });
  page.drawRectangle({
    x: 32,
    y: 32,
    width: W - 64,
    height: H - 64,
    borderColor: GOLD,
    borderWidth: 0.9,
  });

  // Brand: logo when available, wordmark otherwise.
  let y = H - 108;
  if (logoPng && logoPng.length > 0) {
    try {
      const img = await doc.embedPng(logoPng);
      const targetH = 42;
      const targetW = (img.width / img.height) * targetH;
      page.drawImage(img, {
        x: (W - targetW) / 2,
        y: y - 6,
        width: targetW,
        height: targetH,
      });
    } catch {
      drawCentered("J O J A N   O N E", y + 8, helvBold, 22);
    }
  } else {
    drawCentered("J O J A N   O N E", y + 8, helvBold, 22);
  }

  y -= 46;
  drawCentered(
    "C E R T I F I C A T E   O F   C O M P L E T I O N",
    y,
    helvBold,
    15,
    GOLD,
  );

  y -= 40;
  drawCentered("This is to certify that", y, helv, 12, GREY);

  const learner = cert.learnerName?.trim() || "The workspace owner";
  y -= 44;
  drawCentered(learner, y, serifItalic, 32);
  const ruleW = Math.max(220, serifItalic.widthOfTextAtSize(learner, 32) + 40);
  page.drawLine({
    start: { x: (W - ruleW) / 2, y: y - 12 },
    end: { x: (W + ruleW) / 2, y: y - 12 },
    thickness: 0.9,
    color: GOLD,
  });

  y -= 44;
  drawCentered("has successfully completed the course", y, helv, 12, GREY);

  // Course title, wrapped if long.
  y -= 32;
  const titleSize = 21;
  const maxW = W - 200;
  const words = cert.courseTitle.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (helvBold.widthOfTextAtSize(next, titleSize) > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  for (const l of lines) {
    drawCentered(l, y, helvBold, titleSize);
    y -= 26;
  }

  y -= 8;
  const completed = cert.completedAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const meta = [
    `Final assessment ${cert.quizScore}%`,
    `Completed ${completed}`,
    cert.durationMinutes ? `${cert.durationMinutes} minutes of study` : null,
  ]
    .filter(Boolean)
    .join("      ·      ");
  drawCentered(meta, y, helv, 11, GREY);

  // Footer: reference (left), issuer (right), verification line (centre).
  const footY = 74;
  page.drawText("CERTIFICATE NO.", {
    x: 70,
    y: footY + 14,
    font: helvBold,
    size: 7.5,
    color: GREY,
  });
  page.drawText(cert.reference, {
    x: 70,
    y: footY,
    font: helvBold,
    size: 11,
    color: NAVY,
  });

  const issuer = "Jojan One Academy";
  const issuerLabel = "ISSUED BY";
  page.drawText(issuerLabel, {
    x: W - 70 - helvBold.widthOfTextAtSize(issuerLabel, 7.5),
    y: footY + 14,
    font: helvBold,
    size: 7.5,
    color: GREY,
  });
  page.drawText(issuer, {
    x: W - 70 - helvBold.widthOfTextAtSize(issuer, 11),
    y: footY,
    font: helvBold,
    size: 11,
    color: NAVY,
  });

  const verify = `This certificate records completion of a Jojan One Academy course${
    cert.businessName?.trim() ? ` for ${cert.businessName.trim()}` : ""
  } and can be verified against the Academy training record using the certificate number.`;
  drawCentered(verify, 44, helv, 7.5, GREY);

  return doc.save();
}
