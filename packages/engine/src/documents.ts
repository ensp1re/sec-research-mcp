import { Parser } from "htmlparser2";

export function htmlToText(html: string): string {
  const chunks: string[] = [];
  const parser = new Parser({
    ontext(text) {
      const trimmed = text.replace(/\s+/g, " ").trim();
      if (trimmed) chunks.push(trimmed);
    },
  });
  parser.write(html);
  parser.end();
  return chunks.join("\n");
}

export function extractSection(text: string, heading: string): { text: string; start: number; confidence: "exact" | "low" } {
  const index = text.toLowerCase().indexOf(heading.toLowerCase());
  if (index < 0) return { text: "", start: -1, confidence: "low" };
  const next = text.indexOf("\n\n", index + heading.length);
  const slice = text.slice(index, next === -1 ? index + 4000 : next);
  return { text: slice, start: index, confidence: "exact" };
}
