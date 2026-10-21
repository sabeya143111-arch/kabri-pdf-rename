import type { Item, Settings } from "./types";

const clean = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();

export function baseName(it: Item, st: Settings): string | null {
  if (it.skipped) return it.name.replace(/\.pdf$/i, "");
  if (!it.ref || it.status == null || it.rev == null || it.rev === "") return null;
  if (!st.labels[it.legend]?.[it.status]) return null;
  const n = parseInt(it.rev, 10);
  const rev = Number.isNaN(n) ? it.rev : String(n);
  return clean(
    st.tpl.replace("{ref}", it.ref).replace("{rev}", rev).replace("{status}", st.labels[it.legend]?.[it.status] ?? ""),
  );
}

export interface FinalName {
  name: string | null;
  dup: boolean;
}

export function finalNames(items: Item[], st: Settings): FinalName[] {
  const seen: Record<string, number> = {};
  const bases = items.map((it) => baseName(it, st));
  const count: Record<string, number> = {};
  bases.forEach((b) => {
    if (b) count[b] = (count[b] || 0) + 1;
  });
  return bases.map((b) => {
    if (b == null) return { name: null, dup: false };
    seen[b] = (seen[b] || 0) + 1;
    return { name: b + (seen[b] > 1 ? ` (${seen[b]})` : "") + ".pdf", dup: count[b] > 1 };
  });
}

export function hasFlag(it: Item, nm: FinalName): boolean {
  return !it.skipped && (it.flags.length > 0 || nm.name == null);
}
