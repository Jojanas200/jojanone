// The parsers are imported lazily inside their own branches: they are heavy,
// and a bundling/runtime problem with one format must never break the route
// for the others (plain-text extraction has no dependencies at all).

// Text extraction for files attached to Jova questions. The extracted text is
// placed into the grounded CONTEXT block, so Jova reasons over the document
// alongside the workspace registers. Bounded so one file cannot blow the
// context window.

export const ATTACHMENT_MAX_CHARS = 20_000;
export const ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024;

const TEXT_EXTENSIONS = [".txt", ".md", ".csv", ".json", ".log"];

export interface ExtractedAttachment {
  name: string;
  text: string;
  truncated: boolean;
}

export type ExtractResult =
  { ok: true; attachment: ExtractedAttachment } | { ok: false; error: string };

export async function extractAttachmentText(
  name: string,
  mime: string,
  buf: Buffer,
): Promise<ExtractResult> {
  const lower = name.toLowerCase();
  let raw = "";
  try {
    if (mime === "application/pdf" || lower.endsWith(".pdf")) {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buf) });
      try {
        raw = (await parser.getText()).text ?? "";
      } finally {
        await parser.destroy().catch(() => undefined);
      }
    } else if (
      mime ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      lower.endsWith(".docx")
    ) {
      const mammoth = (await import("mammoth")).default;
      raw = (await mammoth.extractRawText({ buffer: buf })).value ?? "";
    } else if (
      mime.startsWith("text/") ||
      mime === "application/json" ||
      TEXT_EXTENSIONS.some((e) => lower.endsWith(e))
    ) {
      raw = buf.toString("utf8");
    } else {
      return {
        ok: false,
        error:
          "Unsupported file type. Attach a PDF, DOCX, TXT, MD, CSV or JSON file.",
      };
    }
  } catch {
    return {
      ok: false,
      error:
        "Could not read that file. It may be corrupt or password-protected.",
    };
  }

  const text = raw
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text)
    return {
      ok: false,
      error:
        "No readable text found in that file (scanned images are not supported yet).",
    };
  const truncated = text.length > ATTACHMENT_MAX_CHARS;
  return {
    ok: true,
    attachment: {
      name,
      text: truncated ? text.slice(0, ATTACHMENT_MAX_CHARS) : text,
      truncated,
    },
  };
}
