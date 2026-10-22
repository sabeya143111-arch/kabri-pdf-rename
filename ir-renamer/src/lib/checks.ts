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

/* ---------- confidence + cross-checks ---------- */
import type { FinalName } from "./naming";
import { LEGENDS } from "./types";

export const REF_OK = /^TVD-\d{4}-[A-Z]{3}-[A-Z]{3}-[A-Z]{2,3}(-[A-Z0-9]{1,4}){0,3}-\d{6,7}$/;

export type Conf = "high" | "medium" | "low" | "manual";
const LOW_FLAG = /not found|disagree|unusual|between|could not|not detected|estimated|differs|only \d|not recognised|no tick|no status/i;

/** How much the auto-detect can be trusted for one row. */
export function confidence(it: Item): { level: Conf; why: string[] } {
  if (it.history?.length) return { level: "manual", why: ["You changed this row by hand"] };
  const why: string[] = [];
  let low = false;
  if (!it.ref) { low = true; why.push("No reference read"); }
  else if (!REF_OK.test(it.ref)) { low = true; why.push("Reference format looks unusual"); }
  if (it.rev == null || it.rev === "") { low = true; why.push("No revision read"); }
  if (it.status == null) { low = true; why.push("No decision read"); }
  for (const f of it.flags) {
    if (LOW_FLAG.test(f)) low = true;
    why.push(f);
  }
  if (low) return { level: "low", why };
  if (it.flags.length) return { level: "medium", why };
  return { level: "high", why: [] };
}

/** Extra safety checks that compare rows with each other and with the form type. */
export function crossChecks(items: Item[], names: FinalName[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const add = (id: string, msg: string) => (out[id] ||= []).push(msg);
  const byRef = new Map<string, Item[]>();
  items.forEach((it, i) => {
    if (it.skipped) return;
    void names[i];
    if (it.ref) {
      const k = it.ref.toUpperCase() + "|" + (parseInt(it.rev ?? "", 10) || 0);
      byRef.set(k, [...(byRef.get(k) ?? []), it]);
    }
    if (it.ref) {
      const m = it.ref.match(/^TVD-(\d{4})-/);
      if (m && (it.legend === "ir8775" || it.legend === "ir8797")) {
        const want = it.legend === "ir8775" ? "8775" : "8797";
        if (m[1] !== want) add(it.id, `Reference says project ${m[1]} but the form type is ${LEGENDS[it.legend].title}`);
      }
      if (it.legend !== "sub" && /-(MP|MAT)-\d{5,7}$/.test(it.ref)) add(it.id, "Reference looks like a Submittal but the form type is an Inspection Request");
      if (it.legend === "sub" && /-(IR|IRR)-\d{5,7}$/.test(it.ref)) add(it.id, "Reference looks like an Inspection Request but the form type is a Submittal");
      if (it.history?.length && !REF_OK.test(it.ref)) add(it.id, "Reference format looks unusual (edited by hand)");
    }
    if (it.rev && !/^\d{1,2}$/.test(it.rev.trim())) add(it.id, "Revision is not a number");
    else if (it.rev && parseInt(it.rev, 10) > 5) add(it.id, `Revision ${it.rev} is unusually high`);
  });
  for (const group of byRef.values()) {
    if (group.length < 2) continue;
    const decisions = new Set(group.map((g) => `${g.legend}:${g.status}`));
    if (decisions.size < 2) continue;
    for (const g of group) {
      const others = group
        .filter((o) => o !== g)
        .map((o) => `${o.name} (${o.status ? LEGENDS[o.legend].stamp[o.status] : "no decision"})`)
        .join(", ");
      add(g.id, `Same IR ref and revision with a different decision in ${others}`);
    }
  }
  return out;
}
