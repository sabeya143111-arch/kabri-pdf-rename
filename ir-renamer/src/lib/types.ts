export type Status = 1 | 2 | 3 | 4;

export interface Item {
  id: string;
  name: string;
  buf: ArrayBuffer;
  pages: number;
  ref: string | null;
  rev: string | null;
  status: Status | null;
  flags: string[];
  verified: boolean;
  skipped: boolean;
  refImg?: string;
  decImg?: string;
}

export interface Settings {
  tpl: string;
  labels: Record<Status, string>;
  skipNamed: boolean;
  folders: boolean;
}

export interface UploadRow {
  id: string;
  name: string;
  size: number;
  progress: number;
}

export const STATUS_TXT: Record<Status, string> = {
  1: "1 - Approved",
  2: "2 - Approved as noted",
  3: "3 - Revise and resubmit",
  4: "4 - Not approved",
};
export const STAMP_TXT: Record<Status, string> = {
  1: "Approved",
  2: "As noted",
  3: "Revise",
  4: "Not approved",
};
