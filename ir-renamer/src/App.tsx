import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import FileUpload from "@/components/ui/file-upload";
import { Sidebar, type View } from "@/components/Sidebar";
import { LiveSheet } from "@/components/LiveSheet";
import { ProgressPanel } from "@/components/ProgressPanel";
import { SettingsPanel } from "@/components/SettingsPanel";
import { ReviewRow } from "@/components/ReviewRow";
import { Dock } from "@/components/Dock";
import NumberFlow from "@number-flow/react";
import { CheckCheck, Keyboard, Search, TriangleAlert } from "lucide-react";
import { PageViewer, type ViewItem } from "@/components/PageViewer";
import { confidence, crossChecks, findMissing, type Conf } from "@/lib/checks";
import { FolderShelf } from "@/components/FolderShelf";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TimelineContent } from "@/components/ui/timeline-animation";
import { VerticalCutReveal } from "@/components/ui/vertical-cut-reveal";
import { LayoutGroup, motion } from "motion/react";
import { TextRotate } from "@/components/ui/text-rotate";
import { PillSwitch } from "@/components/PillSwitch";
import { cn } from "@/lib/utils";
import { analyse, getWorker } from "@/lib/analyze";
import { clearSession, loadSession, saveSession } from "@/lib/store";
import { baseName, finalNames, hasFlag } from "@/lib/naming";
import { LEGENDS, LETTER_LABELS, WORD_LABELS, sameLabels, type Change, type Item, type Settings, type UploadRow } from "@/lib/types";

interface Pending {
  id: string;
  name: string;
  get: () => Promise<ArrayBuffer>;
}

const DEFAULTS: Settings = {
  tpl: "{ref}-R{rev}-{status}",
  labels: WORD_LABELS,
  skipNamed: true,
  folders: true,
  zipLogs: true,
  verifier: "",
};

let uid = 0;
const nextId = () => `f${Date.now().toString(36)}-${uid++}`;

function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [pct, setPct] = useState(0);
  const [statusText, setStatusText] = useState("");
  type Filter = "all" | "1" | "2" | "rev" | "check" | "dup" | "low" | "multi";
  const [fil, setFil] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"file" | "risk">("file");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ heading: string; items: ViewItem[] } | null>(null);
  const closeViewer = useCallback(() => setViewer(null), []);
  const onlyFlag = fil === "check";
  const [hasPage, setHasPage] = useState(false);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState<View>("upload");
  const [menuOpen, setMenuOpen] = useState(false);
  const [pinned, setPinned] = useState(() => {
    try { return localStorage.getItem("irPin") === "1"; } catch { return false; }
  });
  const setPin = (p: boolean) => {
    setPinned(p);
    try { localStorage.setItem("irPin", p ? "1" : "0"); } catch { /* ignore */ }
  };
  const [restored, setRestored] = useState(false);
  const savedRef = useRef<Map<string, Item>>(new Map());

  /* ---------- keep the session across page refreshes ---------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("irSettings");
      if (raw) {
        const saved = JSON.parse(raw);
        if (!saved.labels?.ir8797) delete saved.labels; // older saved shape
        setSettings({ ...DEFAULTS, ...saved });
      }
    } catch { /* ignore */ }
    loadSession().then((saved) => {
      if (saved.length) {
        savedRef.current = new Map(saved.map((i) => [i.id, i]));
        setItems(saved.map((i) => ({ ...i, legend: i.legend ?? "ir8775" })));
        setUploads(saved.map((i) => ({ id: i.id, name: i.name, size: i.buf.byteLength, progress: 100 })));
        setDone(true);
        setPct(100);
        setStatusText(`Restored ${saved.length} files from your last session.`);
        setView("review");
      }
      setRestored(true);
    });
  }, []);
  useEffect(() => {
    if (!restored || busy) return;
    saveSession(items, savedRef.current).then((m) => (savedRef.current = m));
  }, [items, restored, busy]);
  useEffect(() => {
    try { localStorage.setItem("irSettings", JSON.stringify(settings)); } catch { /* ignore */ }
  }, [settings]);

  /* ---------- theme ---------- */
  useEffect(() => {
    try {
      const t = localStorage.getItem("irTheme");
      if (t) document.documentElement.dataset.theme = t;
    } catch { /* storage blocked */ }
  }, []);
  const toggleTheme = () => {
    const r = document.documentElement;
    const dark = r.dataset.theme ? r.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    r.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("irTheme", r.dataset.theme); } catch { /* ignore */ }
  };

  /* ---------- derived ---------- */
  const names = useMemo(() => finalNames(items, settings), [items, settings]);
  const xc = useMemo(() => crossChecks(items, names), [items, names]);
  const confs = useMemo(() => items.map((it) => confidence(it)), [items]);
  const isFlagged = (it: Item, i: number) => hasFlag(it, names[i]) || names[i].dup || (xc[it.id]?.length ?? 0) > 0;
  const verified = items.filter((i) => i.verified).length;
  const flaggedLeft = items.filter((it, i) => isFlagged(it, i) && !it.verified).length;
  const ready = items.length > 0 && verified === items.length && names.every((n) => n.name);
  const stats = {
    total: items.length,
    ok: items.filter((i) => !i.skipped && i.status === 1).length,
    note: items.filter((i) => !i.skipped && i.status === 2).length,
    rev: items.filter((i) => !i.skipped && (i.status ?? 0) >= 3).length,
    flagged: flaggedLeft,
  };
  const step = !items.length || busy ? 1 : !ready ? 2 : 3;
  const pageRef = useRef<HTMLDivElement>(null);
  const mode: "words" | "letters" | null = sameLabels(settings.labels, LETTER_LABELS) ? "letters" : sameLabels(settings.labels, WORD_LABELS) ? "words" : null;
  const setMode = (m: "words" | "letters") => setSettings((st) => ({ ...st, labels: m === "words" ? WORD_LABELS : LETTER_LABELS }));

  /* ---------- processing ---------- */
  const handleFiles = useCallback(
    async (files: File[]) => {
      if (busy) return;
      setBusy(true);
      setDone(false);
      setPct(0);
      try {
        setStatusText("Loading files…");
        const pending: Pending[] = [];
        for (const f of files) {
          if (/\.zip$/i.test(f.name)) {
            const z = await JSZip.loadAsync(await f.arrayBuffer());
            for (const [p, e] of Object.entries(z.files)) {
              if (e.dir || /__MACOSX|\/\./.test(p) || !/\.pdf$/i.test(p)) continue;
              pending.push({ id: nextId(), name: p.split("/").pop()!, get: () => e.async("arraybuffer") });
            }
          } else if (/\.pdf$/i.test(f.name)) {
            pending.push({ id: nextId(), name: f.name, get: () => f.arrayBuffer() });
          }
        }
        pending.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        if (!pending.length) {
          setStatusText("No PDFs found.");
          return;
        }
        setUploads((u) => [...u, ...pending.map((p) => ({ id: p.id, name: p.name, size: 0, progress: 0 }))]);
        const setRow = (id: string, progress: number, size?: number) =>
          setUploads((u) => u.map((r) => (r.id === id ? { ...r, progress, size: size ?? r.size } : r)));
        await getWorker();
        for (let i = 0; i < pending.length; i++) {
          const p = pending[i];
          setStatusText(`Reading ${i + 1} of ${pending.length}: ${p.name}`);
          setPct(Math.round((i / pending.length) * 100));
          setRow(p.id, 12);
          const buf = await p.get();
          setRow(p.id, 38, buf.byteLength);
          let item: Item;
          if (settings.skipNamed && /^TVD-/i.test(p.name)) {
            item = { id: p.id, name: p.name, buf, pages: 0, legend: "ir8775", ref: null, rev: null, status: null, flags: [], verified: true, skipped: true };
          } else {
            item = await analyse(p.id, buf, p.name, {
              onPage: (c) => {
                const cv = previewRef.current;
                if (!cv) return;
                const g = cv.getContext("2d");
                g?.drawImage(c, 0, 0, cv.width, cv.height);
                setHasPage(true);
              },
              onStep: (n) => setRow(p.id, n),
            });
          }
          setRow(p.id, 100);
          setItems((prev) => [...prev, item]);
        }
        setPct(100);
        setStatusText(`Done: ${pending.length} files. Check each row below, then download.`);
        setDone(true);
        setView("review");
      } catch (e) {
        setStatusText("Error: " + (e instanceof Error ? e.message : String(e)));
        console.error(e);
      } finally {
        setBusy(false);
      }
    },
    [busy, settings.skipNamed],
  );

  const clearAll = () => {
    if (busy) return;
    setItems([]);
    setUploads([]);
    setDone(false);
    setPct(0);
    setStatusText("");
    setHasPage(false);
    setFil("all");
    setQ("");
    savedRef.current = new Map();
    clearSession();
    previewRef.current?.getContext("2d")?.clearRect(0, 0, 296, 418);
  };
  const removeOne = (id: string) => {
    if (busy) return;
    setUploads((u) => u.filter((r) => r.id !== id));
    setItems((it) => it.filter((r) => r.id !== id));
  };

  /* ---------- editing / verifying ---------- */
  const who = settings.verifier.trim();
  const stamp = (v: boolean): Partial<Item> => (v ? { verified: true, verifiedAt: Date.now(), verifiedBy: who || undefined } : { verified: false, verifiedAt: undefined, verifiedBy: undefined });
  const autoOf = (it: Item) => it.auto ?? { ref: it.ref, rev: it.rev, status: it.status, legend: it.legend, flags: it.flags };
  const edit = (id: string, patch: Partial<Item>) =>
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const changes: Change[] = [];
        const now = Date.now();
        for (const f of ["ref", "rev", "status", "legend"] as const) {
          if (!(f in patch)) continue;
          const from = it[f] == null ? null : String(it[f]);
          const to = patch[f] == null ? null : String(patch[f]);
          if (from !== to) changes.push({ t: now, field: f, from, to });
        }
        if (!changes.length) return { ...it, ...stamp(true) };
        return { ...it, ...patch, auto: autoOf(it), history: [...(it.history ?? []), ...changes], flags: [], ...stamp(true) };
      }),
    );
  const setVerified = (id: string, v: boolean) => setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...stamp(v) } : it)));
  /** Put the last batch of changes back (they share one timestamp). */
  const undo = (id: string) =>
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id || !it.history?.length) return it;
        const last = it.history[it.history.length - 1].t;
        const undone = it.history.filter((c) => c.t === last);
        const rest = it.history.filter((c) => c.t !== last);
        const back: Partial<Item> = {};
        for (const c of undone) {
          if (c.field === "status") back.status = c.from == null ? null : (Number(c.from) as Item["status"]);
          else if (c.field === "legend") back.legend = c.from as Item["legend"];
          else back[c.field] = c.from;
        }
        const next: Item = { ...it, ...back, history: rest, ...stamp(false) };
        if (!rest.length) {
          next.flags = it.auto?.flags ?? [];
          next.auto = undefined;
          next.history = undefined;
        }
        return next;
      }),
    );
  const resetAuto = (id: string) =>
    setItems((prev) =>
      prev.map((it) => (it.id === id && it.auto ? { ...it, ref: it.auto.ref, rev: it.auto.rev, status: it.auto.status, legend: it.auto.legend, flags: it.auto.flags, history: undefined, auto: undefined, ...stamp(false) } : it)),
    );
  /** One click verifies only rows that are high confidence and free of cross-check warnings. */
  const verifyClean = () => {
    let k = 0;
    items.forEach((it, i) => {
      if (it.skipped || it.verified || it.flags.length || !names[i].name || names[i].dup) return;
      if (confs[i].level !== "high" || xc[it.id]?.length) return;
      setTimeout(() => setVerified(it.id, true), k * 28);
      k++;
    });
  };
  const cleanLeft = items.filter((it, i) => !it.skipped && !it.verified && !it.flags.length && names[i].name && !names[i].dup && confs[i].level === "high" && !xc[it.id]?.length).length;

  /* ---------- outputs ---------- */
  const folderOf = (it: Item) => {
    if (!settings.folders) return "";
    if (it.skipped) return "Already named/";
    return (it.status ? WORD_LABELS[it.legend]?.[it.status] ?? "Unsorted" : "Unsorted") + "/";
  };
  /* ---------- keyboard: J/K or arrows move, 1-5 decision, Enter verify, Z undo ---------- */
  const kbRef = useRef({ view, viewerOpen: false, focusId: null as string | null });
  const shownIds = useRef<string[]>([]);
  kbRef.current = { view, viewerOpen: !!viewer, focusId };
  const focusRow = useCallback((id: string) => {
    setFocusId(id);
    requestAnimationFrame(() => document.querySelector(`[data-row-id="${id}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
  }, []);
  const actRef = useRef({ edit, setVerified, undo, items, names });
  actRef.current = { edit, setVerified, undo, items, names };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = kbRef.current;
      if (k.view !== "review" || k.viewerOpen || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || t?.isContentEditable) return;
      if (tag === "BUTTON" && (e.key === "Enter" || e.key === " ")) return;
      const ids = shownIds.current;
      const at = k.focusId ? ids.indexOf(k.focusId) : -1;
      const key = e.key.toLowerCase();
      if (key === "arrowdown" || key === "j" || key === "arrowright") {
        e.preventDefault();
        const n = ids[Math.min(ids.length - 1, at + 1)];
        if (n) focusRow(n);
      } else if (key === "arrowup" || key === "k" || key === "arrowleft") {
        e.preventDefault();
        const n = ids[Math.max(0, at - 1)];
        if (n) focusRow(n);
      } else if (k.focusId) {
        const it = actRef.current.items.find((x) => x.id === k.focusId);
        if (!it || it.skipped) return;
        if (/^[1-5]$/.test(key)) {
          const st = Number(key) as Item["status"];
          if (!LEGENDS[it.legend].options.includes(st!)) return;
          e.preventDefault();
          actRef.current.edit(it.id, { status: st });
        } else if (key === "enter" || key === "v") {
          e.preventDefault();
          const now = !it.verified;
          const idx = actRef.current.items.indexOf(it);
          if (now && !actRef.current.names[idx]?.name) return; // cannot verify a row that has no name yet (same rule as the tick box)
          actRef.current.setVerified(it.id, now);
          if (now) {
            const n = ids[at + 1];
            if (n) focusRow(n);
          }
        } else if (key === "z") {
          e.preventDefault();
          actRef.current.undo(it.id);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusRow]);

  const csvQ = (v: unknown) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  const fmtT = (t?: number) => {
    if (!t) return "";
    const d = new Date(t);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  const decisionText = (legend: Item["legend"], st: Item["status"]) => (st ? LEGENDS[legend].text[st] : "");
  const mappingCsv = () => {
    const lines = ["old_name,new_name,folder,ref,rev,decision"];
    items.forEach((it, i) => lines.push([it.name, names[i].name ?? "", folderOf(it).replace(/\/$/, ""), it.ref ?? "", it.rev ?? "", decisionText(it.legend, it.status)].map(csvQ).join(",")));
    return "\ufeff" + lines.join("\n");
  };
  const auditCsv = () => {
    const head = ["no", "old_name", "new_name", "folder", "form", "ref", "rev", "decision", "auto_ref", "auto_rev", "auto_decision", "confidence", "checks", "edits", "pages", "verified", "verified_by", "verified_at"];
    const lines = [head.join(",")];
    items.forEach((it, i) => {
      const au = autoOf(it);
      const checks = [...(it.skipped ? [] : au.flags), ...(xc[it.id] ?? []), ...(names[i].dup ? ["Duplicate name, (n) added"] : [])].join(" | ");
      const edits = (it.history ?? []).map((c) => `${c.field}: ${c.from ?? ""} -> ${c.to ?? ""}`).join(" | ");
      lines.push(
        [
          i + 1, it.name, names[i].name ?? "", folderOf(it).replace(/\/$/, ""), it.skipped ? "already named" : LEGENDS[it.legend].title, it.ref ?? "", it.rev ?? "", decisionText(it.legend, it.status),
          au.ref ?? "", au.rev ?? "", decisionText(au.legend, au.status), it.skipped ? "" : confs[i].level, checks, edits, it.pages || "", it.verified ? "yes" : "no", it.verifiedBy ?? "", fmtT(it.verifiedAt),
        ].map(csvQ).join(","),
      );
    });
    if (missing.length) {
      lines.push("", csvQ("IR numbers not found between the uploaded ones:"));
      for (const g of missing) lines.push([g.kind, g.tooBig ? "big gaps, check every ref" : g.missing.join(", ")].map(csvQ).join(","));
    }
    lines.push("", csvQ("Exported " + fmtT(Date.now()) + (who ? " by " + who : "")));
    return "\ufeff" + lines.join("\n");
  };
  const downloadZip = async () => {
    if (!ready) return;
    const z = new JSZip();
    items.forEach((it, i) => z.file(folderOf(it) + names[i].name!, it.buf));
    if (settings.zipLogs) {
      z.file("rename_mapping.csv", mappingCsv());
      z.file("audit_log.csv", auditCsv());
    }
    const blob = await z.generateAsync({ type: "blob", compression: "STORE" });
    download(blob, "renamed_pdfs.zip");
    setStatusText(`ZIP downloaded: ${items.length} files${settings.zipLogs ? " + mapping and audit log" : ""}.`);
  };
  const downloadCsv = () => download(new Blob([mappingCsv()], { type: "text/csv" }), "rename_mapping.csv");
  const downloadAudit = () => download(new Blob([auditCsv()], { type: "text/csv" }), "audit_log.csv");

  const matches = (it: Item, nm: (typeof names)[number]) => {
    if (fil === "1" && !(!it.skipped && it.status === 1)) return false;
    if (fil === "2" && !(!it.skipped && it.status === 2)) return false;
    if (fil === "rev" && !(!it.skipped && (it.status ?? 0) >= 3)) return false;
    if (fil === "check" && !(hasFlag(it, nm) || nm.dup || xc[it.id]?.length)) return false;
    if (fil === "low" && !(!it.skipped && confidence(it).level === "low")) return false;
    if (fil === "multi" && !(!it.skipped && it.pages > 1)) return false;
    if (fil === "dup" && !nm.dup) return false;
    const t = q.trim().toLowerCase();
    if (!t) return true;
    const hay = [it.name, it.ref ?? "", nm.name ?? "", it.status ? LEGENDS[it.legend].stamp[it.status] : ""].join(" ").toLowerCase();
    return t.split(/\s+/).every((w) => hay.includes(w));
  };
  const RANK: Record<Conf, number> = { low: 0, medium: 1, manual: 2, high: 3 };
  const shown = items
    .map((it, i) => ({ it, nm: names[i], i }))
    .filter(({ it, nm }) => matches(it, nm))
    .sort((a, b) => {
      if (sort !== "risk") return 0;
      const ka = (a.it.verified ? 10 : 0) + (a.it.skipped ? 20 : 0) + RANK[confs[a.i].level] - (xc[a.it.id]?.length ? 5 : 0);
      const kb = (b.it.verified ? 10 : 0) + (b.it.skipped ? 20 : 0) + RANK[confs[b.i].level] - (xc[b.it.id]?.length ? 5 : 0);
      return ka - kb || a.i - b.i;
    });
  const missing = useMemo(() => findMissing(items), [items]);
  shownIds.current = shown.map((r) => r.it.id);
  const dupCount = names.filter((n) => n.dup).length;
  const chips: { k: Filter; label: string; n: number }[] = [
    { k: "all", label: "All", n: items.length },
    { k: "1", label: "Approved", n: stats.ok },
    { k: "2", label: "Approved as noted", n: stats.note },
    { k: "rev", label: "Revise / Not approved", n: stats.rev },
    { k: "check", label: "Need a check", n: items.filter((it, i) => isFlagged(it, i)).length },
    { k: "low", label: "Low confidence", n: confs.filter((c, i) => !items[i].skipped && c.level === "low").length },
    { k: "multi", label: "Multi-page", n: items.filter((it) => !it.skipped && it.pages > 1).length },
    { k: "dup", label: "Duplicates", n: dupCount },
  ];
  const openPage = (it: Item) => setViewer({ heading: it.pages > 1 ? `Full scan: all ${it.pages} pages` : "Full page of the scan", items: [{ id: it.id, title: it.name, buf: it.buf, pages: it.pages }] });
  const compare = (it: Item, i: number) => {
    const key = baseName(it, settings);
    const group = items.filter((o) => baseName(o, settings) === key);
    void i;
    setViewer({ heading: `Compare duplicates: ${group.length} scans with the same name`, items: group.map((o) => ({ id: o.id, title: o.name, buf: o.buf, pages: o.pages })) });
  };
  const sample = names.find((n) => n.name)?.name;

  const revealVariants = {
    visible: (i: number) => ({ y: 0, opacity: 1, filter: "blur(0px)", transition: { delay: i * 0.4, duration: 0.5 } }),
    hidden: { filter: "blur(10px)", y: -20, opacity: 0 },
  };

  const stepBadge = (n: number) =>
    step === n ? (
      <span className="rounded-full bg-orange-500 px-3 py-1 text-sm font-medium text-white">Current step</span>
    ) : step > n ? (
      <span className="rounded-full bg-okbg px-3 py-1 text-sm font-medium text-ok">Done</span>
    ) : null;
  const cardCls = (n: number) => cn("relative border bg-card", step === n && "bg-tint ring-2 ring-orange-500");
  const primaryBtn =
    "w-full cursor-pointer rounded-xl border border-orange-400 bg-gradient-to-t from-orange-500 to-orange-600 p-4 text-lg font-medium text-white shadow-lg shadow-orange-500/30 transition active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none";
  const ghostBtn =
    "w-full cursor-pointer rounded-xl border bg-panel p-4 text-lg font-medium text-ink shadow-lg shadow-black/5 transition active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-40";
  const Feature = ({ children }: { children: React.ReactNode }) => (
    <li className="flex items-center">
      <span className="mr-3 mt-0.5 grid h-6 w-6 shrink-0 place-content-center rounded-full border border-orange-500 bg-panel">
        <CheckCheck className="h-4 w-4 text-orange-500" />
      </span>
      <span className="text-sm text-mute">{children}</span>
    </li>
  );

  const empty = (what: string) => (
    <Card className="p-10 text-center">
      <p className="mb-4 text-lg font-medium">{what}</p>
      <button type="button" onClick={() => setView("upload")} className="cursor-pointer rounded-xl border border-orange-400 bg-gradient-to-t from-orange-500 to-orange-600 px-5 py-2.5 font-medium text-white shadow-lg shadow-orange-500/30">
        Go to Upload
      </button>
    </Card>
  );

  return (
    <>
      <Sidebar view={view} onView={setView} total={items.length} verified={verified} flagged={flaggedLeft} ready={ready} busy={busy} open={menuOpen} onOpen={setMenuOpen} pinned={pinned} onPin={setPin} onZip={downloadZip} onTheme={toggleTheme} />
      <main ref={pageRef} className={cn("relative min-h-screen px-4 pb-28 pt-6 transition-[padding] duration-300 lg:pb-12 lg:pr-8 lg:pt-10", pinned ? "lg:pl-[304px]" : "lg:pl-[84px]")}>
        <div className="mx-auto max-w-6xl">
          {view === "upload" && (
            <div key="upload">
              <article className="mb-6 max-w-2xl space-y-4 text-left">
          <h2 className="mb-4 text-4xl font-medium capitalize md:text-6xl">
            <VerticalCutReveal
              splitBy="words"
              staggerDuration={0.15}
              staggerFrom="first"
              reverse={true}
              containerClassName="justify-start"
              transition={{ type: "spring", stiffness: 250, damping: 40, delay: 0 }}
            >
              Rename every inspection PDF the right way
            </VerticalCutReveal>
          </h2>
          <TimelineContent as="div" animationNum={0} timelineRef={pageRef} customVariants={revealVariants}>
            <LayoutGroup>
              <motion.p className="flex items-center gap-2 whitespace-pre text-xl font-light text-ink sm:text-2xl md:text-3xl" layout>
                <motion.span layout transition={{ type: "spring", damping: 30, stiffness: 400 }}>
                  Every scan,{" "}
                </motion.span>
                <TextRotate
                  texts={["read automatically", "named correctly", "sorted by decision", "ready to ZIP"]}
                  mainClassName="overflow-hidden rounded-lg bg-orange-500 px-2.5 py-0.5 font-medium text-white sm:px-3 sm:py-1"
                  staggerFrom="last"
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "-120%" }}
                  staggerDuration={0.02}
                  splitLevelClassName="overflow-hidden pb-0.5"
                  transition={{ type: "spring", damping: 30, stiffness: 400 }}
                  rotationInterval={2600}
                />
              </motion.p>
            </LayoutGroup>
          </TimelineContent>
          <TimelineContent as="p" animationNum={1} timelineRef={pageRef} customVariants={revealVariants} className="w-[85%] text-sm text-mute md:text-base">
            Drop your Inspection Request scans. The app reads the IR reference, the revision and the engineer's decision from each one, so all you do is confirm and
            download.
          </TimelineContent>
          <TimelineContent as="div" animationNum={2} timelineRef={pageRef} customVariants={revealVariants}>
            <PillSwitch
              className="w-fit"
              layoutId="status-style"
              value={mode}
              onChange={setMode}
              options={[
                { value: "words", label: "Status as words" },
                { value: "letters", label: "Status as letters", badge: "A to D" },
              ]}
            />
          </TimelineContent>
        </article>
              <div className="grid gap-4 py-4">
{/* 1. Upload */}
          <TimelineContent as="div" animationNum={3} timelineRef={pageRef} customVariants={revealVariants}>
            <Card className={cardCls(1)}>
              <CardHeader className="text-left">
                <div className="flex justify-between">
                  <h3 className="mb-2 text-2xl font-semibold">1. Upload</h3>
                  {stepBadge(1)}
                </div>
                <p className="text-sm text-mute">Add the scanned Inspection Requests as PDFs, or as one ZIP.</p>
              </CardHeader>
              <CardContent className="pt-0">
                <FileUpload files={uploads} busy={busy} onFiles={handleFiles} onRemove={removeOne} onClear={clearAll} />
                {(busy || hasPage) && <LiveSheet ref={previewRef} busy={busy} hasPage={hasPage} />}
                {(busy || done) && <ProgressPanel pct={pct} text={statusText} busy={busy} />}
              </CardContent>
            </Card>
          </TimelineContent>
              </div>
            </div>
          )}

          {view === "review" && (
            <div key="review" className="space-y-4">
              <h2 className="text-3xl font-semibold md:text-4xl">Review files</h2>
              {items.length ? (
                <>
{/* 2. Check */}
          <TimelineContent as="div" animationNum={4} timelineRef={pageRef} customVariants={revealVariants}>
            <Card className={cardCls(2)}>
              <CardHeader className="text-left">
                <div className="flex justify-between">
                  <h3 className="mb-2 text-2xl font-semibold">2. Check</h3>
                  {stepBadge(2)}
                </div>
                <p className="mb-2 text-sm text-mute">Every file is read automatically. Confirm each row before you download.</p>
                <div className="flex items-baseline">
                  <span className="text-4xl font-semibold">
                    <NumberFlow value={stats.total} className="text-4xl font-semibold" />
                  </span>
                  <span className="ml-1 text-mute">files read</span>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {[
                    { k: "ok", label: "Approved", bar: "bg-ok", v: stats.ok },
                    { k: "note", label: "Approved as noted", bar: "bg-note", v: stats.note },
                    { k: "rev", label: "Revise / Not approved", bar: "bg-revise", v: stats.rev },
                    { k: "flag", label: "Need a check", bar: "bg-bad", v: stats.flagged },
                  ].map((t) => (
                    <div key={t.k} className="relative overflow-hidden rounded-lg border bg-panel px-3.5 py-2.5">
                      <span className={cn("absolute inset-y-0 left-0 w-1", t.bar)} />
                      <div className="text-2xl font-semibold leading-none">
                        <NumberFlow value={t.v} />
                      </div>
                      <div className="mt-1 text-xs text-mute">{t.label}</div>
                    </div>
                  ))}
                </div>
                <div className="mb-6 grid gap-3 sm:grid-cols-2">
                  <button type="button" className={primaryBtn} onClick={verifyClean} disabled={!cleanLeft || busy}>
                  Verify {cleanLeft} high-confidence rows
                </button>
                <button type="button" className={ghostBtn} onClick={() => setFil((f) => (f === "check" ? "all" : "check"))} disabled={!items.length}>
                  {onlyFlag ? "Show all rows" : "Show only rows to check"}
                </button>
                </div>
                <div className="space-y-3 border-t pt-4">
                  <h4 className="text-base font-semibold">What to look at</h4>
                  <ul className="grid gap-2 sm:grid-cols-3">
                    <Feature>The red box marks the option the app detected</Feature>
                    <Feature>Fix any wrong value right inside its row; every change is saved in its history and can be undone</Feature>
                    <Feature>Bulk verify only touches high-confidence rows with no warnings. Everything else needs your own tick</Feature>
                  </ul>
                  <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-mute">
                    <span className="inline-flex items-center gap-1.5 font-medium text-ink"><Keyboard className="h-4 w-4" /> Shortcuts</span>
                    <span><kbd>J</kbd>/<kbd>K</kbd> or arrows: next/previous row</span>
                    <span><kbd>1</kbd> to <kbd>5</kbd>: set the decision</span>
                    <span><kbd>Enter</kbd>: verify and go to next</span>
                    <span><kbd>Z</kbd>: undo</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </TimelineContent>
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2.5 border-b px-4 py-3">
              <h2 className="mr-auto text-lg font-semibold">Review every file</h2>
              <label className="flex items-center gap-1.5 text-[12.5px] text-mute">
                Order
                <select value={sort} onChange={(e) => setSort(e.target.value as "file" | "risk")} className="!py-1 text-[12.5px]">
                  <option value="file">File order</option>
                  <option value="risk">Riskiest first</option>
                </select>
              </label>
              <span className="text-[12.5px] text-mute">
                {items.length} files · {flaggedLeft} still to check
              </span>
            </div>
            {missing.length > 0 && (
              <div className="border-b bg-flagbg px-4 py-3 text-[13px]" data-testid="missing">
                <div className="mb-1 flex items-center gap-2 font-semibold text-revise">
                  <TriangleAlert className="h-4 w-4" /> IR numbers not found in this batch
                </div>
                <ul className="space-y-0.5 text-ink">
                  {missing.map((g) => (
                    <li key={g.prefix}>
                      <span className="font-mono font-medium">{g.kind}</span>:{" "}
                      {g.tooBig ? (
                        <span>big gaps between numbers, so check that every IR ref was read correctly</span>
                      ) : (
                        <span className="font-mono">{g.missing.join(", ")}</span>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-mute">These numbers sit between IRs you uploaded. If those IRs exist, a scan may be missing, or one ref was read wrong.</p>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
              <div className="relative min-w-[240px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
                <input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by IR number, file name or decision"
                  aria-label="Search rows"
                  className="w-full !pl-9"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {chips.map((c) => (
                  <button
                    key={c.k}
                    type="button"
                    onClick={() => setFil(c.k)}
                    className={cn(
                      "cursor-pointer rounded-full border px-3 py-1 text-[12.5px] font-medium transition",
                      fil === c.k ? "border-orange-500 bg-orange-500 text-white" : "bg-panel text-ink hover:border-orange-500",
                    )}
                  >
                    {c.label} <span className={fil === c.k ? "opacity-90" : "text-mute"}>{c.n}</span>
                  </button>
                ))}
              </div>
            </div>
            <div data-testid="rows">
              {shown.map(({ it, nm, i }) => (
                <ReviewRow key={it.id} it={it} nm={nm} index={i} flagged={isFlagged(it, i)} conf={confs[i].level} confWhy={confs[i].why} xc={xc[it.id] ?? []} focused={focusId === it.id} onFocus={() => setFocusId(it.id)} onUndo={() => undo(it.id)} onReset={() => resetAuto(it.id)} onEdit={(p) => edit(it.id, p)} onVerify={(v) => setVerified(it.id, v)} onDownload={() => nm.name && download(new Blob([it.buf], { type: "application/pdf" }), nm.name)} onZoom={() => openPage(it)} onCompare={nm.dup ? () => compare(it, i) : undefined} />
              ))}
              {!shown.length && <div className="p-8 text-center text-mute">No rows match. Clear the search or pick "All".</div>}
            </div>
          </Card>
                </>
              ) : (
                empty("No files yet. Upload your scans first.")
              )}
            </div>
          )}

          {view === "download" && (
            <div key="download" className="space-y-4">
              <h2 className="text-3xl font-semibold md:text-4xl">Download</h2>
              {items.length ? (
                <>
{/* 3. Download */}
          <TimelineContent as="div" animationNum={5} timelineRef={pageRef} customVariants={revealVariants}>
            <Card className={cardCls(3)}>
              <CardHeader className="text-left">
                <div className="flex justify-between">
                  <h3 className="mb-2 text-2xl font-semibold">3. Download</h3>
                  {stepBadge(3)}
                </div>
                <p className="mb-2 text-sm text-mute">The download unlocks once every row is verified.</p>
                <div className="flex items-baseline">
                  <span className="text-4xl font-semibold">
                    <NumberFlow value={verified} className="text-4xl font-semibold" />
                  </span>
                  <span className="ml-1 text-mute">/ {items.length} verified</span>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="mb-5 h-2 overflow-hidden rounded-full bg-line2">
                  <div className="h-full rounded-full bg-ok transition-[width] duration-500" style={{ width: `${items.length ? (verified / items.length) * 100 : 0}%` }} />
                </div>
                <div className="mb-6 grid gap-3 sm:grid-cols-2">
                  <button type="button" className={primaryBtn} onClick={downloadZip} disabled={!ready || busy}>
                  Download renamed ZIP
                </button>
                <button type="button" className={ghostBtn} onClick={downloadCsv} disabled={!items.length}>
                  Download mapping CSV
                </button>
                <button type="button" className={ghostBtn} onClick={downloadAudit} disabled={!items.length}>
                  Download audit log (Excel / CSV)
                </button>
                </div>
                <div className="space-y-3 border-t pt-4">
                  <h4 className="text-base font-semibold">Name example</h4>
                  <p className="break-all font-mono text-[12.5px] text-mute">{sample ?? "TVD-8775-KIC-PAR-WIR-ES-IRR-000049-R0-Approved as noted.pdf"}</p>
                  <ul className="space-y-2">
                    <Feature>Need just one file? Use "Download this PDF" on its row in Review files</Feature>
                    <Feature>Your PDFs are only renamed, never changed</Feature>
                    <Feature>The ZIP also holds rename_mapping.csv (old name to new name) and audit_log.csv (confidence, edits, who verified and when)</Feature>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TimelineContent>
                  <FolderShelf
                    entries={items.map((it, i) => ({ it, nm: names[i] }))}
                    folders={settings.folders}
                    onDownload={({ it, nm }) => nm.name && download(new Blob([it.buf], { type: "application/pdf" }), nm.name)}
                  />
                </>
              ) : (
                empty("Nothing to download yet. Upload your scans first.")
              )}
            </div>
          )}

          {view === "settings" && (
            <div key="settings" className="space-y-4">
              <h2 className="text-3xl font-semibold md:text-4xl">Settings</h2>
              <SettingsPanel settings={settings} onChange={setSettings} open />
            </div>
          )}
        </div>
        <div className="sr-only" id="status" aria-live="polite">
          {statusText}
        </div>
      </main>
      <div className="lg:hidden">
        <Dock show={items.length > 0} verified={verified} total={items.length} ready={ready} busy={busy} onZip={downloadZip} />
      </div>
      <PageViewer items={viewer?.items ?? null} heading={viewer?.heading ?? ""} onClose={closeViewer} allPages />
    </>
  );
}
