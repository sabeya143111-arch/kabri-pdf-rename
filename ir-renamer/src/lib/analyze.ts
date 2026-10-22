import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.js?url";
import { createWorker, type Worker } from "tesseract.js";
import type { Item, Legend, Status } from "./types";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const TESS_WORKER = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/dist/worker.min.js";
const TESS_CORE = "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.0/";
const TESS_LANG = "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int";

const SCALE = 200 / 72; // render page 1 at 200 dpi
type Region = [number, number, number, number];
const HEADER_REGION: Region = [0, 0.03, 1, 0.45];
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

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

/* ---------- OCR helpers ---------- */
interface Wd {
  t: string;
  cy: number;
  x0: number;
  x1: number;
}
async function ocrWords(canvas: HTMLCanvasElement, reg: Region, up: number) {
  const w = await getWorker();
  const cr = cropCanvas(canvas, reg, up, "gray");
  const { data } = await w.recognize(cr.canvas);
  const words: Wd[] = (data.words || []).map((x) => ({
    t: x.text,
    cy: cr.sy + (x.bbox.y0 + x.bbox.y1) / 2 / up,
    x0: cr.sx + x.bbox.x0 / up,
    x1: cr.sx + x.bbox.x1 / up,
  }));
  return { words, text: data.text };
}

/* ---------- reference / revision parsing ---------- */
interface Parsed {
  ref: string | null;
  rev: string | null;
}
const REF_OK = /^TVD-\d{4}-[A-Z]{3}-[A-Z]{3}-[A-Z]{2,3}(-[A-Z0-9]{1,4}){0,3}-\d{6,7}$/;
const IR_PREFIX = /^(1R|IR|LR|IIR|R)$/;

function parseRef(text: string, kind: "ir" | "sub"): Parsed {
  const up = text.toUpperCase().replace(/\r/g, "");
  const i = up.search(/T[VWY]D/);
  if (i < 0) return { ref: null, rev: null };
  let rest = "TVD" + up.slice(i + 3);
  let rev: string | null = null;
  if (kind === "ir") {
    const rm = rest.match(/REV[\s.,:;]*([0-9OIL]{1,3})/);
    if (rm) rev = rm[1].replace(/O/g, "0").replace(/[IL]/g, "1");
  }
  const cut = rest.search(/REV|ISSUE|DATE|\n/);
  if (cut > 0) rest = rest.slice(0, cut);
  rest = rest.replace(/[\s.,:;|_]+/g, "").replace(/[^A-Z0-9-]/g, "").replace(/-+$/, "");
  if (kind === "sub") {
    const m = rest.match(/-R(\d)$/);
    if (m) {
      rev = m[1];
      rest = rest.slice(0, -m[0].length);
    }
  }
  const seg = rest.split("-").filter((s) => s.length);
  if (seg.length < 5) return { ref: rest, rev };
  if (seg.length >= 6 && IR_PREFIX.test(seg[seg.length - 2]) && /^[0-9OIL]{6,7}$/.test(seg[seg.length - 1])) seg[seg.length - 2] = "IR";
  const last = seg[seg.length - 1];
  const m = last.match(/^(.*?)([0-9OIL]{6,7})$/);
  if (m) {
    const digits = m[2].replace(/O/g, "0").replace(/[IL]/g, "1");
    const pre = IR_PREFIX.test(m[1]) ? "IR" : m[1];
    seg.splice(seg.length - 1, 1, ...(pre ? [pre] : []), digits);
  }
  return { ref: seg.join("-"), rev };
}

interface HeaderInfo {
  kind: "ir" | "sub";
  tvd: Wd | null;
  flags: string[];
}
async function readHeader(canvas: HTMLCanvasElement): Promise<HeaderInfo> {
  const { words, text } = await ocrWords(canvas, HEADER_REGION, 1.5);
  const flags: string[] = [];
  let kind: "ir" | "sub" = "ir";
  if (/INSPECTION\s*REQUEST/i.test(text)) kind = "ir";
  else if (/SUBMITTAL|MATERIAL/i.test(text)) kind = "sub";
  else flags.push("Form type not recognised (treated as an Inspection Request)");
  let tvds = words.filter((x) => /T[VWY]D-?\d{3}/i.test(x.t)).sort((a, b) => a.cy - b.cy);
  if (kind === "sub") {
    // the "Submittal Nr" value sits in the top table; the lower "Material Submittal Number" (…-MAT-…) is not the reference
    const loose = words.filter((x) => /T[VWY]D/i.test(x.t) && !/-MAT-/i.test(x.t)).sort((a, b) => a.cy - b.cy);
    const good = tvds.filter((x) => !/-MAT-/i.test(x.t));
    tvds = good.length ? good : loose;
  } else if (!tvds.length) tvds = words.filter((x) => /T[VWY]D/i.test(x.t)).sort((a, b) => a.cy - b.cy);
  return { kind, tvd: tvds[0] ?? null, flags };
}

function refStrip(canvas: HTMLCanvasElement, tvd: Wd): Region {
  const W = canvas.width, H = canvas.height;
  return [clamp01((tvd.x0 - 25) / W), clamp01((tvd.cy - 34) / H), 0.99, clamp01((tvd.cy + 34) / H)];
}

async function readRefRev(canvas: HTMLCanvasElement, hd: HeaderInfo) {
  const w = await getWorker();
  const flags: string[] = [];
  if (!hd.tvd) return { ref: null, rev: null, flags: ["Reference not found"], strip: null as Region | null };
  const strip = refStrip(canvas, hd.tvd);
  const outs: Parsed[] = [];
  for (const [up, mode] of [[2, "gray"], [3, "bin"]] as const) {
    const cc = cropCanvas(canvas, strip, up, mode).canvas;
    const { data } = await w.recognize(cc);
    outs.push(parseRef(data.text, hd.kind));
  }
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
  return { ref: pick.ref, rev, flags, strip };
}

/* ---------- decision detection ---------- */
interface Geom {
  cy: number[];
  pitch: number;
  sx0: number;
  sx1: number;
}
interface Decision {
  status: Status | null;
  legend: Legend;
  flags: string[];
  geom: Geom | null;
  region: Region;
  dbg?: unknown;
}

/** Linear fit of row centres: rows[i] -> y. */
function fitRows(rows: Record<number, number>) {
  const idx = Object.keys(rows).map(Number).sort((a, b) => a - b);
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
  return { idx, pitch, cy: (i: number) => y0 + pitch * i };
}

async function readDecisionIR(canvas: HTMLCanvasElement): Promise<Decision> {
  const W = canvas.width, H = canvas.height;
  const up = 1.5;
  const { words: all } = await ocrWords(canvas, [0.02, 0.5, 0.8, 1], up);
  const title = all.find((x) => /decision/i.test(x.t));
  const minY = title ? title.cy - 4 : H * 0.7;
  const words = all.filter((x) => x.cy > minY && x.x0 < W * 0.5);
  const isB = words.some((x) => /^accepted|^rejected/i.test(x.t) || /^[-—]?review$/i.test(x.t));
  const legend: Legend = isB ? "ir8797" : "ir8775";
  const near = (a: number, b: number) => Math.abs(a - b) < 14;
  const rows: Record<number, number> = {};
  if (isB) {
    const acc = words.find((x) => /accepted/i.test(x.t));
    const rej = words.find((x) => /rejected/i.test(x.t));
    const rev = words.find((x) => /^[-—]?review$/i.test(x.t));
    if (acc) rows[2] = acc.cy;
    if (rej) rows[3] = rej.cy;
    if (rev) rows[4] = rev.cy;
    const ap = words.filter((x) => /appro/i.test(x.t) && !(acc && x.cy > acc.cy - 8)).sort((a, b) => a.cy - b.cy);
    if (ap.length) rows[1] = ap[0].cy;
  } else {
    const noted = words.find((x) => /^-?noted/i.test(x.t) || /noted$/i.test(x.t));
    const reb = words.find((x) => /resubmit|resubm|revise/i.test(x.t));
    const not = words.find((x) => /^not$/i.test(x.t));
    if (noted) rows[2] = noted.cy;
    if (reb) rows[3] = reb.cy;
    if (not) rows[4] = not.cy;
    const appr = words.filter((x) => /^[-—]?\s*appro/i.test(x.t) || /pproved$/i.test(x.t));
    const r1 = appr.filter((x) => !(rows[2] != null && near(x.cy, rows[2])) && !(rows[4] != null && near(x.cy, rows[4])));
    if (r1.length) {
      const ref2 = rows[2] ?? (rows[3] != null ? rows[3] - 30 : null);
      r1.sort((a, b) => (ref2 == null ? a.cy - b.cy : Math.abs(a.cy - (ref2 - 30)) - Math.abs(b.cy - (ref2 - 30))));
      rows[1] = r1[0].cy;
    }
  }
  const fallback: Region = [0.02, 0.72, 0.62, 0.95];
  if (Object.keys(rows).length < 2) return { status: null, legend, flags: ["Could not find the decision lines"], geom: null, region: fallback };
  const { idx, pitch, cy } = fitRows(rows);
  if (!Number.isFinite(pitch) || pitch < 10 || pitch > 90) return { status: null, legend, flags: ["Could not find the decision lines"], geom: null, region: fallback };

  // where the printed option text starts (the digit), not the box edge that OCR sometimes reads as "|" or "J"
  const xs: number[] = [];
  for (const i of idx) {
    const rw = words.filter((x) => near(x.cy, rows[i]) && x.x0 < W * 0.5);
    const dg = rw.filter((x) => /^[1-4][-—.]?$/.test(x.t));
    if (dg.length) xs.push(Math.min(...dg.map((x) => x.x0)));
    else {
      const al = rw.filter((x) => /^[-—]?[A-Za-z]{3,}/.test(x.t));
      if (al.length) xs.push(Math.min(...al.map((x) => x.x0)) - 28);
    }
  }
  xs.sort((a, b) => a - b);
  const anchor = xs.length ? xs[Math.floor(xs.length / 2)] : W * 0.2;

  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const top = Math.max(0, Math.round(cy(1) - pitch * 0.95));
  const bot = Math.min(H, Math.round(cy(4) + pitch * 0.95));
  const bh = bot - top;
  const zx0 = Math.max(0, Math.round(anchor - 190));
  const zx1 = Math.min(W, Math.round(anchor + 12));
  const ZW = zx1 - zx0;
  if (bh < 20 || ZW < 60) return { status: null, legend, flags: ["Could not find the decision lines"], geom: null, region: fallback };
  const zim = ctx.getImageData(zx0, top, ZW, bh).data;
  const cols: number[] = new Array(ZW).fill(0);
  for (let y = 0; y < bh; y++)
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
  // columns hugging a full-height table border are not checkbox edges either
  const nearBorder: boolean[] = new Array(ZW).fill(false);
  const isBorder: boolean[] = new Array(ZW).fill(false);
  // the table border is a wide (>= 8 px after smoothing) tall line; checkbox edges are thinner
  for (let x = 0; x < ZW; ) {
    if (sm[x] > bh * 0.45) {
      let e = x;
      while (e < ZW && sm[e] > bh * 0.45) e++;
      if (e - x >= 8 || sm.slice(x, e).some((v) => v > bh * 0.75)) for (let k = x; k < e; k++) isBorder[k] = true;
      x = e;
    } else x++;
  }
  for (let x = 0; x < ZW; x++)
    if (isBorder[x]) for (let k = -3; k <= 12; k++) if (x + k >= 0 && x + k < ZW) nearBorder[x + k] = true;
  let bx: [number, number] | null = null;
  let bestScore = -1e9;
  for (let x = 0; x < ZW; x++)
    for (let wd = 28; wd <= 62; wd++) {
      if (x + wd >= ZW) break;
      const L = zx0 + x;
      if (L + wd > anchor + 12) break;
      // the table border is a (nearly) full-height line: never a checkbox edge
      if (isBorder[x] || isBorder[x + wd] || nearBorder[x] || nearBorder[x + wd]) continue;
      if (sm[x] >= bh * 0.22 && sm[x + wd] >= bh * 0.22 && sm[x] + sm[x + wd] >= bh * 0.6) {
        const sc = sm[x] + sm[x + wd] - Math.abs(wd - 40) * 0.8;
        if (sc > bestScore) {
          bestScore = sc;
          bx = [L, L + wd];
        }
      }
    }
  const flags: string[] = [];
  if (!(pitch > 16 && pitch < 56)) flags.push("Unusual row spacing (" + pitch.toFixed(1) + ")");
  if (!bx) {
    flags.push("Checkbox column not detected (estimated)");
    bx = [anchor - 70, anchor - 28];
  }
  const sx0 = Math.max(0, Math.round(bx[0] - 8));
  const sx1 = Math.min(W, Math.round(bx[1] + 8));
  const sw = sx1 - sx0;
  const d = ctx.getImageData(sx0, top, sw, bh).data;
  const rowBlue: number[] = new Array(bh).fill(0);
  for (let y = 0; y < bh; y++) {
    let c = 0;
    for (let x = 0; x < sw; x++) {
      const p = (y * sw + x) * 4;
      if (isBlue(d[p], d[p + 1], d[p + 2])) c++;
    }
    rowBlue[y] = c;
  }
  const band = [0, 0, 0, 0, 0];
  for (let i = 1; i <= 4; i++) {
    const a = Math.round(cy(i) - pitch / 2) - top;
    const b = Math.round(cy(i) + pitch / 2) - top;
    for (let y = Math.max(0, a); y < Math.min(bh, b); y++) band[i] += rowBlue[y];
  }
  const total = band.reduce((s, v) => s + v, 0);
  let dens = 1;
  for (let i = 2; i <= 4; i++) if (band[i] > band[dens]) dens = i;
  let low = -1;
  for (let y = bh - 1; y >= 0; y--) {
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
  let status: number | null = lowIdx || dens;
  if (total < 25) {
    status = null;
    flags.push("No tick mark found");
  } else {
    const sorted = band.slice(1).sort((a, b) => b - a);
    if (sorted[1] > 0 && sorted[0] / sorted[1] < 1.6) flags.push("Tick sits between two options (" + band.slice(1).join("/") + ")");
    if (lowIdx !== dens) flags.push("The two detection methods disagree (density=" + dens + ", lowest point=" + lowIdx + ")");
    if (idx.length < 3) flags.push("Only " + idx.length + " option lines read by OCR (rest estimated)");
  }
  const region: Region = [0.02, clamp01((Math.min(top, title ? title.cy - 6 : top) - pitch * 0.6) / H), 0.62, clamp01((bot + pitch * 0.6) / H)];
  return { status: status as Status | null, legend, flags, geom: { cy: [0, cy(1), cy(2), cy(3), cy(4)], pitch, sx0, sx1 }, region, dbg: { peaks: sm.map((v, x) => (v >= bh * 0.22 ? [zx0 + x, v] : null)).filter(Boolean), bh, rows, pitch, anchor, bx, top, bot, band, total, lowIdx, dens, words: words.slice(0, 60).map((x) => [x.t, Math.round(x.x0), Math.round(x.cy)]) } };
}

async function readDecisionSub(canvas: HTMLCanvasElement): Promise<Decision> {
  const W = canvas.width, H = canvas.height;
  const up = 1.6;
  const { words } = await ocrWords(canvas, [0.5, 0.6, 1, 0.97], up);
  const fallback: Region = [0.55, 0.74, 0.98, 0.9];
  const st = words.find((x) => /^status/i.test(x.t));
  if (!st) return { status: null, legend: "sub", flags: ["Could not find the Status list"], geom: null, region: fallback };
  // option lines: words below "Status:" and in the same column
  const col = words.filter((x) => x.cy > st.cy + 6 && x.x0 > st.x0 - 40 && x.x0 < st.x0 + 140);
  const lines: { cy: number; n: number }[] = [];
  for (const x of col.sort((a, b) => a.cy - b.cy)) {
    const l = lines.find((q) => Math.abs(q.cy - x.cy) < 10);
    if (l) {
      l.cy = (l.cy * l.n + x.cy) / (l.n + 1);
      l.n++;
    } else lines.push({ cy: x.cy, n: 1 });
  }
  const opt = lines.slice(0, 5).map((l) => l.cy);
  let pitch = (26.5 * H) / 2339;
  let cy1 = st.cy + pitch;
  if (opt.length >= 4) {
    const rows: Record<number, number> = {};
    opt.forEach((c, i) => (rows[i + 1] = c));
    const f = fitRows(rows);
    if (f.pitch > 14 && f.pitch < 60) {
      pitch = f.pitch;
      cy1 = f.cy(1);
    }
  }
  const cy = (i: number) => cy1 + pitch * (i - 1);
  const flags: string[] = [];
  if (opt.length < 5) flags.push("Only " + opt.length + " of 5 option lines read by OCR (rest estimated)");
  const sx0 = Math.max(0, Math.round(st.x0 - 25));
  const sx1 = Math.min(W, Math.round(st.x0 + W * 0.14));
  const top = Math.max(0, Math.round(cy(1) - pitch * 0.7));
  const bot = Math.min(H, Math.round(cy(5) + pitch * 0.7));
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const sw = sx1 - sx0, bh = bot - top;
  const d = ctx.getImageData(sx0, top, sw, bh).data;
  const band = [0, 0, 0, 0, 0, 0];
  let yMin = -1, yMax = -1;
  for (let y = 0; y < bh; y++) {
    const yy = top + y;
    let c = 0;
    for (let x = 0; x < sw; x++) {
      const p = (y * sw + x) * 4;
      if (isBlue(d[p], d[p + 1], d[p + 2])) c++;
    }
    if (c >= 2) {
      if (yMin < 0) yMin = yy;
      yMax = yy;
    }
    for (let i = 1; i <= 5; i++) if (Math.abs(yy - cy(i)) <= pitch * 0.36) band[i] += c;
  }
  const ranked = [1, 2, 3, 4, 5].sort((a, b) => band[b] - band[a]);
  let status: number | null = ranked[0];
  if (band[ranked[0]] < 30) {
    status = null;
    flags.push("No status mark found");
  } else {
    // a box drawn round one option: its middle is the chosen line (more reliable than ink density)
    const ext = yMax - yMin;
    if (ext > pitch * 0.6 && ext < pitch * 1.9) {
      const mid = (yMin + yMax) / 2;
      let best = 1;
      for (let i = 2; i <= 5; i++) if (Math.abs(mid - cy(i)) < Math.abs(mid - cy(best))) best = i;
      status = best;
    } else if (band[ranked[1]] > 0 && band[ranked[0]] / band[ranked[1]] < 1.8) {
      flags.push("Mark sits between two options (" + band.slice(1).join("/") + ")");
    }
  }
  const region: Region = [clamp01((st.x0 - 60) / W), clamp01((st.cy - pitch * 1.2) / H), 0.98, clamp01((cy(5) + pitch * 1.2) / H)];
  return { status: status as Status | null, legend: "sub", flags, geom: { cy: [0, cy(1), cy(2), cy(3), cy(4), cy(5)], pitch, sx0, sx1 }, region, dbg: { st: [st.x0, st.cy], opt, pitch, band, sx0, sx1, top, bot } };
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
  c.width = Math.max(1, Math.round(cr.sw * s));
  c.height = Math.max(1, Math.round(cr.sh * s));
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
  const it: Item = { id, name, buf, pages: 0, legend: "ir8775", ref: null, rev: null, status: null, flags: [], verified: false, skipped: false };
  try {
    const { canvas, pages } = await renderFirstPage(buf);
    it.pages = pages;
    hooks?.onPage?.(canvas);
    hooks?.onStep?.(40);
    const hd = await readHeader(canvas);
    it.flags.push(...hd.flags);
    const rr = await readRefRev(canvas, hd);
    it.ref = rr.ref;
    it.rev = rr.rev;
    it.flags.push(...rr.flags);
    hooks?.onStep?.(75);
    const dr = hd.kind === "sub" ? await readDecisionSub(canvas) : await readDecisionIR(canvas);
    it.legend = dr.legend;
    it.status = dr.status;
    it.flags.push(...dr.flags);
    const mark =
      dr.geom && dr.status
        ? { x0: dr.geom.sx0 - 10, x1: hd.kind === "sub" ? Math.min(canvas.width, dr.geom.sx1 + 20) : canvas.width * 0.62, cy: dr.geom.cy[dr.status], h: dr.geom.pitch * 0.95 }
        : null;
    it.refImg = rr.strip
      ? thumb(canvas, [0.03, clamp01(rr.strip[1] - 0.012), 0.97, clamp01(rr.strip[3] + 0.012)], 430)
      : thumb(canvas, [0.03, 0.1, 0.97, 0.3], 430);
    it.decImg = thumb(canvas, dr.region, 430, mark);
  } catch (e) {
    it.flags.push("Could not read the PDF: " + (e instanceof Error ? e.message : String(e)));
  }
  return it;
}

export const __debug = { ocrWords, readHeader, readDecisionIR, readDecisionSub, parseRef, renderFirstPage };

/** Every page of a PDF as image URLs (used by the full-scan viewer, so pages 2+ can be checked too). */
export async function renderAllPages(buf: ArrayBuffer, scale = 1.3): Promise<string[]> {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
  const urls: string[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const vp = page.getViewport({ scale: scale * (200 / 72) / 1.5 });
    const c = document.createElement("canvas");
    c.width = Math.round(vp.width);
    c.height = Math.round(vp.height);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    urls.push(c.toDataURL("image/jpeg", 0.85));
  }
  void pdf.destroy();
  return urls;
}
