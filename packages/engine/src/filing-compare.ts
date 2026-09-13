export interface ChangeRecord {
  kind: "added" | "removed" | "moved" | "unchanged";
  text: string;
}

export function compareParagraphs(left: string, right: string): ChangeRecord[] {
  const a = paras(left);
  const b = paras(right);
  const aSet = new Set(a);
  const bSet = new Set(b);
  const out: ChangeRecord[] = [];
  for (const text of a) {
    if (bSet.has(text)) out.push({ kind: "unchanged", text });
    else if (b.some((other) => other.includes(text) || text.includes(other))) out.push({ kind: "moved", text });
    else out.push({ kind: "removed", text });
  }
  for (const text of b) {
    if (!aSet.has(text) && !a.some((other) => other.includes(text) || text.includes(other))) {
      out.push({ kind: "added", text });
    }
  }
  return out;
}

function paras(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0);
}
