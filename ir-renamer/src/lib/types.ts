export type Status = 1 | 2 | 3 | 4 | 5;

/** Which printed form (and which list of decisions) a scan uses. */
export type Legend = "ir8775" | "ir8797" | "sub";

/** One manual change made in Review (kept so it can be undone and audited). */
export interface Change {
  t: number;
  field: "ref" | "rev" | "status" | "legend";
  from: string | null;
  to: string | null;
}

/** What the auto-detect read, before any manual change. */
export interface AutoRead {
  ref: string | null;
  rev: string | null;
  status: Status | null;
  legend: Legend;
  flags: string[];
}

export interface Item {
  id: string;
  name: string;
  buf: ArrayBuffer;
  pages: number;
  legend: Legend;
  ref: string | null;
  rev: string | null;
  status: Status | null;
  flags: string[];
  verified: boolean;
  skipped: boolean;
  refImg?: string;
  decImg?: string;
  history?: Change[];
  auto?: AutoRead;
  verifiedAt?: number;
  verifiedBy?: string;
}

export type Labels = Record<Legend, Record<Status, string>>;

export interface Settings {
  tpl: string;
  labels: Labels;
  skipNamed: boolean;
  folders: boolean;
  /** put rename_mapping.csv and audit_log.csv inside the ZIP */
  zipLogs: boolean;
  /** name written in the audit log next to every verified row */
  verifier: string;
}

export interface UploadRow {
  id: string;
  name: string;
  size: number;
  progress: number;
}

export interface LegendInfo {
  title: string;
  /** decisions printed on this form, in order */
  options: Status[];
  /** full text shown in the decision menu */
  text: Record<number, string>;
  /** short word on the stamp chip */
  stamp: Record<number, string>;
}

export const LEGENDS: Record<Legend, LegendInfo> = {
  ir8775: {
    title: "Inspection Request (project 8775)",
    options: [1, 2, 3, 4],
    text: { 1: "1 - Approved", 2: "2 - Approved as noted", 3: "3 - Revise and resubmit", 4: "4 - Not approved" },
    stamp: { 1: "Approved", 2: "As noted", 3: "Revise", 4: "Not approved" },
  },
  ir8797: {
    title: "Inspection Request (project 8797)",
    options: [1, 2, 3, 4],
    text: {
      1: "1 - Approved or Approved as noted",
      2: "2 - Accepted with comments (resubmission required, work may proceed)",
      3: "3 - Rejected, revise and resubmit (work may not proceed)",
      4: "4 - Review not required",
    },
    stamp: { 1: "Approved", 2: "Accepted", 3: "Revise", 4: "Not required" },
  },
  sub: {
    title: "Sample Material Submittal",
    options: [1, 2, 3, 4, 5],
    text: { 1: "1) Approved", 2: "2) Approved as noted", 3: "3) Revise & re-submit", 4: "4) Not approved", 5: "5) Sample is required" },
    stamp: { 1: "Approved", 2: "As noted", 3: "Revise", 4: "Not approved", 5: "Sample" },
  },
};

export const WORD_LABELS: Labels = {
  ir8775: { 1: "Approved", 2: "Approved as noted", 3: "Revise and resubmit", 4: "Not approved", 5: "" },
  ir8797: { 1: "Approved or Approved as noted", 2: "Accepted with comments", 3: "Revise and resubmit", 4: "Review not required", 5: "" },
  sub: { 1: "Approved", 2: "Approved as noted", 3: "Revise and resubmit", 4: "Not approved", 5: "Sample is required" },
};
const L = { 1: "A", 2: "B", 3: "C", 4: "D", 5: "E" } as const;
export const LETTER_LABELS: Labels = { ir8775: { ...L }, ir8797: { ...L }, sub: { ...L } };

export const sameLabels = (a: Labels, b: Labels) =>
  (Object.keys(LEGENDS) as Legend[]).every((g) => LEGENDS[g].options.every((k) => a[g]?.[k] === b[g][k]));
