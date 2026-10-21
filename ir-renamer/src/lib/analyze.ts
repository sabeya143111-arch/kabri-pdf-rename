import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.js?url";
import { createWorker, type Worker } from "tesseract.js";
import type { Item, Status } from "./types";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const TESS_WORKER = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/dist/worker.min.js";
const TESS_CORE = "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.0/";
const TESS_LANG = "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int";

const SCALE = 200 / 72; // render page 1 at 200 dpi
type Region = [number, number, number, number];
const REF_REGION: Region = [0.06, 0.15, 0.7, 0.245];
const DEC_REGION: Region = [0.03, 0.735, 0.64, 0.93];

let workerP: Promise<Worker> | null = null;
export function getWorker(): Promise<Worker> {
  if (!workerP) {
    workerP = (async () => {
      const w = await createWorker("eng", 1, {
        workerPath: TESS_WORKER,
        corePath: TESS_CORE,
        langPath: TESS_LANG,
        logger: () => {},
      });
      await w.setParameters({ tessedit_pageseg_mode: "6" as never, preserve_interword_spaces: "1" });
      return w;
    })();
    workerP.catch(() => {
      workerP = null;
    });
  }
  return workerP;
}

/* ---------- canvas helpers ---------- */
interface Crop {
  canvas: HTMLCanvasElement;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}
function cropCanvas(src: HTMLCanvasElement, reg: Region, up = 1, mode: "gray" | "bin" | "color" = "gray"): Crop {
  const sx = Math.round(reg[0] * src.width);
  const sy = Math.round(reg[1] * src.height);
  const sw = Math.round((reg[2] - reg[0]) * src.width);
  const sh = Math.round((reg[3] - reg[1]) * src.height);
  const c = document.createElement("canvas");
  c.width = Math.round(sw * up);
  c.height = Math.round(sh * up);
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.imageSmoothingQuality = "high";
  g.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height);
  if (mode !== "color") {
    const im = g.getImageData(0, 0, c.width, c.height);
    const d = im.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      let v = r * 0.3 + gg * 0.59 + b * 0.11;
      if (b - r > 35) v = 255; // ink-blue -> white so it does not disturb printed text OCR
      if (mode === "bin") v = v < 165 ? 0 : 255;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    g.putImageData(im, 0, 0);
  }
  return { canvas: c, sx, sy, sw, sh };
}
const isBlue = (r: number, g: number, b: number) => b - r > 40 && b > g + 5;

export async function renderFirstPage(buf: ArrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
  const page = await pdf.getPage(1);
  const vp = page.getViewport({ scale: SCALE });
  const c = document.createElement("canvas");
  c.width = Math.round(vp.width);
  c.height = Math.round(vp.height);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  const pages = pdf.numPages;
  void pdf.destroy();
  return { canvas: c, pages };
}

/* ---------- IR ref / rev parsing ---------- */
interface Parsed {
  ref: string | null;
  rev: string | null;
}
function parseRef(text: string): Parsed {
  const up = text.toUpperCase().replace(/\r/g, "");
  const i = up.indexOf("TVD");
  if (i < 0) return { ref: null, rev: null };
  let rest = up.slice(i);
  let rev: string | null = null;
  const rm = rest.match(/REV[\s.,:;]*([0-9OIL]{1,3})/);
  if (rm) rev = rm[1].replace(/O/g, "0").replace(/[IL]/g, "1");
  const cut = rest.search(/REV|\n/);
  if (cut > 0) rest = rest.slice(0, cut);
  rest = rest.replace(/[\s.,:;|_]+/g, "").replace(/[^A-Z0-9-]/g, "").replace(/-+$/, "");
  const seg = rest.split("-").filter((s) => s.length);
  let ref = rest;
  if (seg.length >= 8) {
    const head = seg.slice(0, 7).join("-");
    const tail = seg.slice(7).join("").replace(/O/g, "0").replace(/[IL]/g, "1");
    ref = head + "-" + tail;
  }
  return { ref, rev };
}
const REF_OK = /^TVD-\d{4}-[A-Z]{3}-[A-Z]{3}-[A-Z]{3}-[A-Z]{2}-[A-Z]{2,4}-\d{6}$/;

async function readRefRev(canvas: HTMLCanvasElement) {
  const w = await getWorker();
  const outs: Parsed[] = [];
  for (const [up, mode] of [[2, "gray"], [3, "bin"]] as const) {
    const cc = cropCanvas(canvas, REF_REGION, up, mode).canvas;
    const { data } = await w.recognize(cc);
    outs.push(parseRef(data.text));
  }
  const flags: string[] = [];
  const [a, b] = outs;
  let pick = a;
  if (!(a.ref && REF_OK.test(a.ref)) && b.ref && REF_OK.test(b.ref)) pick = b;
  if (!pick.ref) flags.push("Reference not found");
  else {
    if (!REF_OK.test(pick.ref)) flags.push("Reference format looks unusual");
    if (a.ref !== b.ref) flags.push("The two OCR passes disagree (" + a.ref + " / " + b.ref + ")");
  }
  const rev = pick.rev ?? (pick === a ? b.rev : a.rev);
  if (rev == null) flags.push("Revision not found");
  else if (a.rev != null && b.rev != null && a.rev !== b.rev) flags.push("Revision differs between OCR passes");
  return { ref: pick.ref, rev, flags };
}

/* ---------- decision (checkbox) detection ---------- */
interface Geom {
  cy: number[];
  pitch: number;
  sx0: number;
  sx1: number;
}
interface Decision {
  status: Status | null;
  flags: string[];
  geom: Geom | null;
}
interface Wd {
  t: string;
  cy: number;
  x0: number;
}

async function readDecision(canvas: HTMLCanvasElement): Promise<Decision> {
  const w = await getWorker();
  const up = 1.6;
  const cr = cropCanvas(canvas, DEC_REGION, up, "gray");
  const { data } = await w.recognize(cr.canvas);
  const words: Wd[] = (data.words || []).map((x) => ({
    t: x.text,
    cy: cr.sy + (x.bbox.y0 + x.bbox.y1) / 2 / up,
    x0: cr.sx + x.bbox.x0 / up,
  }));
  const rows: Record<number, number> = {};
  const near = (a: number, b: number) => Math.abs(a - b) < 14;
  const noted = words.find((x) => /^-?noted/i.test(x.t) || /noted$/i.test(x.t));
  const reb = words.find((x) => /resubmit|resubm|revise/i.test(x.t));
  const not = words.find((x) => /^not$/i.test(x.t));
  if (noted) rows[2] = noted.cy;
  if (reb) rows[3] = reb.cy;
  if (not) rows[4] = not.cy;
  const appr = words.filter((x) => /^[-—]?\s*appro/i.test(x.t) || /pproved$/i.test(x.t));
  const r1 = appr.filter(
    (x) => !(rows[2] != null && near(x.cy, rows[2])) && !(rows[4] != null && near(x.cy, rows[4])),
  );
  if (r1.length) {
    const ref2 = rows[2] ?? (rows[3] != null ? rows[3] - 30 : null);
    r1.sort((a, b) =>
      ref2 == null ? a.cy - b.cy : Math.abs(a.cy - (ref2 - 30)) - Math.abs(b.cy - (ref2 - 30)),
    );
    rows[1] = r1[0].cy;
  }
  const idx = Object.keys(rows).map(Number).sort((a, b) => a - b);
  if (idx.length < 2) return { status: null, flags: ["Could not find the decision lines"], geom: null };
  const n = idx.length;
  const mx = idx.reduce((s, i) => s + i, 0) / n;
  const my = idx.reduce((s, i) => s + rows[i], 0) / n;
  let num = 0, den = 0;
  for (const i of idx) {
    num += (i - mx) * (rows[i] - my);
    den += (i - mx) ** 2;
  }
  const pitch = num / den;
  const y0 = my - pitch * mx;
  const cy = (i: number) => y0 + pitch * i;
  const xs: number[] = [];
  for (const i of idx) {
    const rw = words.filter((x) => near(x.cy, rows[i]) && x.x0 < canvas.width * 0.4);
    if (rw.length) xs.push(Math.min(...rw.map((x) => x.x0)));
  }
  xs.sort((a, b) => a - b);
  const anchor = xs[Math.floor(xs.length / 2)];

  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const top = Math.round(cy(1) - pitch * 0.95);
  const bot = Math.round(cy(4) + pitch * 0.95);
  const H = bot - top;
  const zx0 = Math.round(canvas.width * 0.03);
  const zx1 = Math.round(canvas.width * 0.34);
  const ZW = zx1 - zx0;
  const zim = ctx.getImageData(zx0, top, ZW, H).data;
  const cols: number[] = new Array(ZW).fill(0);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < ZW; x++) {
      const p = (y * ZW + x) * 4;
      const r = zim[p], g = zim[p + 1], b = zim[p + 2];
      if (!isBlue(r, g, b) && r * 0.3 + g * 0.59 + b * 0.11 < 170) cols[x]++;
    }
  const sm = cols.map((_, x) => {
    let m = 0;
    for (let k = -2; k <= 2; k++) {
      const v = cols[x + k];
      if (v > m) m = v;
    }
    return m;
  });
  let bx: [number, number] | null = null;
  let bestScore = -1e9;
  for (let x = 0; x < ZW; x++)
    for (let wd = 34; wd <= 52; wd++) {
      if (x + wd >= ZW) break;
      const L = zx0 + x;
      if (L < anchor - 80 || L > anchor + 10) continue;
      if (sm[x] >= H * 0.22 && sm[x + wd] >= H * 0.22 && sm[x] + sm[x + wd] >= H * 0.6) {
        const sc = sm[x] + sm[x + wd] - Math.abs(wd - 40) * 0.8;
        if (sc > bestScore) {
          bestScore = sc;
          bx = [L, L + wd];
        }
      }
    }
  const flags: string[] = [];
  if (!(pitch > 18 && pitch < 48)) flags.push("Unusual row spacing (" + pitch.toFixed(1) + ")");
  if (!bx) {
    flags.push("Checkbox column not detected (estimated)");
    bx = [anchor - 2, anchor + 42];
  }
  const sx0 = Math.max(0, Math.round(bx[0] - 8));
  const sx1 = Math.round(bx[1] + 8);
  const d = ctx.getImageData(sx0, top, sx1 - sx0, bot - top).data;
  const W = sx1 - sx0;
  const rowBlue: number[] = new Array(H).fill(0);
  for (let y = 0; y < H; y++) {
    let c = 0;
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 4;
      if (isBlue(d[p], d[p + 1], d[p + 2])) c++;
    }
    rowBlue[y] = c;
  }
  const band = [0, 0, 0, 0, 0];
  for (let i = 1; i <= 4; i++) {
    const a = Math.round(cy(i) - pitch / 2) - top;
    const b = Math.round(cy(i) + pitch / 2) - top;
    for (let y = Math.max(0, a); y < Math.min(H, b); y++) band[i] += rowBlue[y];
  }
  const total = band.reduce((s, v) => s + v, 0);
  let dens = 1;
  for (let i = 2; i <= 4; i++) if (band[i] > band[dens]) dens = i;
  let low = -1;
  for (let y = H - 1; y >= 0; y--) {
    if (rowBlue[y] >= 3) {
      low = y;
      break;
    }
  }
  let lowIdx: number | null = null;
  if (low >= 0) {
    const yy = top + low;
    let best = 1, bd = 1e9;
    for (let i = 1; i <= 4; i++) {
      const dd = Math.abs(yy - (cy(i) + pitch * 0.22));
      if (dd < bd) {
        bd = dd;
        best = i;
      }
    }
    lowIdx = best;
  }
  let status: number | null = lowIdx || dens; // tick bottom is the most reliable (the slash can cross the box above)
  if (total < 25) {
    status = null;
    flags.push("No tick mark found");
  } else {
    const sorted = band.slice(1).sort((a, b) => b - a);
    if (sorted[1] > 0 && sorted[0] / sorted[1] < 1.6) flags.push("Tick sits between two options (" + band.slice(1).join("/") + ")");
    if (lowIdx !== dens) flags.push("The two detection methods disagree (density=" + dens + ", lowest point=" + lowIdx + ")");
    if (idx.length < 3) flags.push("Only " + idx.length + " option lines read by OCR (rest estimated)");
  }
  return {
    status: status as Status | null,
    flags,
    geom: { cy: [0, cy(1), cy(2), cy(3), cy(4)], pitch, sx0, sx1 },
  };
}

/* ---------- thumbnails ---------- */
function thumb(
  canvas: HTMLCanvasElement,
  reg: Region,
  maxW: number,
  mark?: { x0: number; x1: number; cy: number; h: number } | null,
): string {
  const cr = cropCanvas(canvas, reg, 1, "color");
  const s = Math.min(1, maxW / cr.sw);
  const c = document.createElement("canvas");
  c.width = Math.round(cr.sw * s);
  c.height = Math.round(cr.sh * s);
  const g = c.getContext("2d")!;
  g.drawImage(cr.canvas, 0, 0, c.width, c.height);
  if (mark) {
    g.strokeStyle = "#e11";
    g.lineWidth = 2;
    g.strokeRect((mark.x0 - cr.sx) * s, (mark.cy - mark.h / 2 - cr.sy) * s, (mark.x1 - mark.x0) * s, mark.h * s);
  }
  return c.toDataURL("image/jpeg", 0.8);
}

/* ---------- one PDF -> Item ---------- */
export async function analyse(
  id: string,
  buf: ArrayBuffer,
  name: string,
  hooks?: { onPage?: (c: HTMLCanvasElement) => void; onStep?: (pct: number) => void },
): Promise<Item> {
  const it: Item = { id, name, buf, pages: 0, ref: null, rev: null, status: null, flags: [], verified: false, skipped: false };
  try {
    const { canvas, pages } = await renderFirstPage(buf);
    it.pages = pages;
    hooks?.onPage?.(canvas);
    hooks?.onStep?.(55);
    const rr = await readRefRev(canvas);
    it.ref = rr.ref;
    it.rev = rr.rev;
    it.flags.push(...rr.flags);
    hooks?.onStep?.(80);
    const dr = await readDecision(canvas);
    it.status = dr.status;
    it.flags.push(...dr.flags);
    const mark =
      dr.geom && dr.status
        ? { x0: dr.geom.sx0 - 10, x1: canvas.width * 0.62, cy: dr.geom.cy[dr.status], h: dr.geom.pitch * 0.95 }
        : null;
    it.refImg = thumb(canvas, REF_REGION, 430);
    it.decImg = thumb(canvas, DEC_REGION, 430, mark);
  } catch (e) {
    it.flags.push("Could not read the PDF: " + (e instanceof Error ? e.message : String(e)));
  }
  return it;
}
