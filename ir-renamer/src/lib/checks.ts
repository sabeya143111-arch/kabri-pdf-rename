import type { Item } from "./types";

export interface MissingGroup {
  kind: string; // e.g. "IRR"
  prefix: string; // full ref up to the number
  have: number;
  missing: string[]; // condensed ranges, e.g. "000045" or "000050 to 000052"
  tooBig: boolean;
}

/** Look for gaps in the IR numbers inside each series (same prefix, e.g. ...-IRR-). */
export function findMissing(items: Item[]): MissingGroup[] {
  const groups = new Map<string, Set<number>>();
  for (const it of items) {
    if (it.skipped || !it.ref) continue;
    const m = it.ref.match(/^(.*-)(\d{6})$/);
    if (!m) continue;
    if (!groups.has(m[1])) groups.set(m[1], new Set());
    groups.get(m[1])!.add(parseInt(m[2], 10));
  }
  const out: MissingGroup[] = [];
  for (const [prefix, set] of groups) {
    const nums = [...set].sort((a, b) => a - b);
    if (nums.length < 2) continue;
    const gaps: number[] = [];
    for (let i = 1; i < nums.length; i++) for (let n = nums[i - 1] + 1; n < nums[i]; n++) gaps.push(n);
    if (!gaps.length) continue;
    const kind = prefix.split("-").filter(Boolean).pop() ?? prefix;
    const pad = (n: number) => String(n).padStart(6, "0");
    if (gaps.length > 60) {
      out.push({ kind, prefix, have: nums.length, missing: [], tooBig: true });
      continue;
    }
    const ranges: string[] = [];
    let s = gaps[0];
    let p = gaps[0];
    for (let i = 1; i <= gaps.length; i++) {
      if (gaps[i] === p + 1) {
        p = gaps[i];
        continue;
      }
      ranges.push(s === p ? pad(s) : `${pad(s)} to ${pad(p)}`);
      s = p = gaps[i];
    }
    out.push({ kind, prefix, have: nums.length, missing: ranges, tooBig: false });
  }
  return out.sort((a, b) => a.kind.localeCompare(b.kind));
}
