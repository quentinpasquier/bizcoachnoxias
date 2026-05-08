import mammoth from "mammoth";
// pdf-parse n'est pas typé sur tous les chemins, on importe via require dynamique côté serveur.
import pdfParse from "pdf-parse";

export type FileKind = "pdf" | "docx" | "csv" | "txt" | "md" | "other";

const PDF_EXT = new Set([".pdf"]);
const DOCX_EXT = new Set([".docx"]);
const TEXT_EXT = new Set([".txt", ".csv", ".md", ".tsv"]);
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB par fichier

export function detectKind(filename: string): FileKind {
  const lower = filename.toLowerCase();
  const ext = lower.slice(lower.lastIndexOf("."));
  if (PDF_EXT.has(ext)) return "pdf";
  if (DOCX_EXT.has(ext)) return "docx";
  if (ext === ".csv") return "csv";
  if (ext === ".md") return "md";
  if (ext === ".txt" || ext === ".tsv") return "txt";
  return "other";
}

export interface ParseResult {
  filename: string;
  kind: FileKind;
  size: number;
  content: string;
  error?: string;
}

export async function parseFile(file: File): Promise<ParseResult> {
  const filename = file.name;
  const kind = detectKind(filename);
  const size = file.size;

  if (size > MAX_BYTES) {
    return {
      filename,
      kind,
      size,
      content: "",
      error: `Fichier trop volumineux (${Math.round(size / 1024 / 1024)} MB, max 15 MB)`,
    };
  }

  try {
    if (kind === "pdf") {
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await pdfParse(buffer);
      return { filename, kind, size, content: result.text };
    }

    if (kind === "docx") {
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await mammoth.extractRawText({ buffer });
      return { filename, kind, size, content: result.value };
    }

    if (kind === "txt" || kind === "csv" || kind === "md") {
      const text = await file.text();
      return { filename, kind, size, content: text };
    }

    if (TEXT_EXT.has(filename.slice(filename.lastIndexOf(".")).toLowerCase())) {
      const text = await file.text();
      return { filename, kind, size, content: text };
    }

    return {
      filename,
      kind,
      size,
      content: "",
      error: "Format non supporté. Utilisez PDF, DOCX, CSV, TXT ou MD.",
    };
  } catch (err) {
    return {
      filename,
      kind,
      size,
      content: "",
      error: `Erreur de parsing : ${(err as Error).message}`,
    };
  }
}
