import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import FileUpload from "@/components/ui/file-upload";
import { Header } from "@/components/Header";
import { LiveSheet } from "@/components/LiveSheet";
import { ProgressPanel } from "@/components/ProgressPanel";
import { SettingsPanel } from "@/components/SettingsPanel";
import { ReviewRow } from "@/components/ReviewRow";
import { Dock } from "@/components/Dock";
import NumberFlow from "@number-flow/react";
import { CheckCheck, Search, TriangleAlert } from "lucide-react";
import { PageViewer, type ViewItem } from "@/components/PageViewer";
import { findMissing } from "@/lib/checks";
import { FolderShelf } from "@/components/FolderShelf";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TimelineContent } from "@/components/ui/timeline-animation";
import { VerticalCutReveal } from "@/components/ui/vertical-cut-reveal";
import { PillSwitch } from "@/components/PillSwitch";
import { cn } from "@/lib/utils";
import { analyse, getWorker } from "@/lib/analyze";
import { clearSession, loadSession, saveSession } from "@/lib/store";
import { baseName, finalNames, hasFlag } from "@/lib/naming";
import { STAMP_TXT, STATUS_TXT, type Item, type Settings, type UploadRow } from "@/lib/types";

interface Pending {
  id: string;
  name: string;
  get: () => Promise<ArrayBuffer>;
}

const DEFAULTS: Settings = {
  tpl: "{ref}-R{rev}-{status}",
  labels: { 1: "Approved", 2: "Approved as noted", 3: "Revise and resubmit", 4: "Not approved" },
  skipNamed: true,
  folders: true,
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
  type Filter = "all" | "1" | "2" | "rev" | "check" | "dup";
  const [fil, setFil] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [viewer, setViewer] = useState<{ heading: string; items: ViewItem[] } | null>(null);
  const closeViewer = useCallback(() => setViewer(null), []);
  const onlyFlag = fil === "check";
  const [hasPage, setHasPage] = useState(false);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [restored, setRestored] = useState(false);
  const savedRef = useRef<Map<string, Item>>(new Map());

  /* ---------- keep the session across page refreshes ---------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("irSettings");
      if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch { /* ignore */ }
    loadSession().then((saved) => {
      if (saved.length) {
        savedRef.current = new Map(saved.map((i) => [i.id, i]));
        setItems(saved);
        setUploads(saved.map((i) => ({ id: i.id, name: i.name, size: i.buf.byteLength, progress: 100 })));
        setDone(true);
        setPct(100);
        setStatusText(`Restored ${saved.length} files from your last session.`);
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
  const verified = items.filter((i) => i.verified).length;
  const flaggedLeft = items.filter((it, i) => (hasFlag(it, names[i]) || names[i].dup) && !it.verified).length;
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
  const letters = settings.labels[1] === "A" && settings.labels[2] === "B" && settings.labels[3] === "C" && settings.labels[4] === "D";
  const words = settings.labels[1] === DEFAULTS.labels[1] && settings.labels[2] === DEFAULTS.labels[2] && settings.labels[3] === DEFAULTS.labels[3] && settings.labels[4] === DEFAULTS.labels[4];
  const mode: "words" | "letters" | null = letters ? "letters" : words ? "words" : null;
  const setMode = (m: "words" | "letters") => setSettings((st) => ({ ...st, labels: m === "words" ? DEFAULTS.labels : { 1: "A", 2: "B", 3: "C", 4: "D" } }));

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
            item = { id: p.id, name: p.name, buf, pages: 0, ref: null, rev: null, status: null, flags: [], verified: true, skipped: true };
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
  const edit = (id: string, patch: Partial<Item>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch, flags: [], verified: true } : it)));
  const setVerified = (id: string, v: boolean) => setItems((prev) => prev.map((it) => (it.id === id ? { ...it, verified: v } : it)));
  const verifyClean = () => {
    let k = 0;
    items.forEach((it, i) => {
      if (it.skipped || it.verified || it.flags.length || !names[i].name || names[i].dup) return;
      setTimeout(() => setVerified(it.id, true), k * 28);
      k++;
    });
  };

  /* ---------- outputs ---------- */
  const folderOf = (it: Item) => {
    if (!settings.folders) return "";
    if (it.skipped) return "Already named/";
    return (it.status ? DEFAULTS.labels[it.status] : "Unsorted") + "/";
  };
  const downloadZip = async () => {
    if (!ready) return;
    const z = new JSZip();
    items.forEach((it, i) => z.file(folderOf(it) + names[i].name!, it.buf));
    const blob = await z.generateAsync({ type: "blob", compression: "STORE" });
    download(blob, "renamed_pdfs.zip");
    setStatusText(`ZIP downloaded: ${items.length} files.`);
  };
  const downloadCsv = () => {
    const q = (v: unknown) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
    const lines = ["old_name,new_name,folder,ref,rev,decision"];
    items.forEach((it, i) => lines.push([it.name, names[i].name ?? "", folderOf(it).replace(/\/$/, ""), it.ref ?? "", it.rev ?? "", it.status ? STATUS_TXT[it.status] : ""].map(q).join(",")));
    download(new Blob(["﻿" + lines.join("\n")], { type: "text/csv" }), "rename_mapping.csv");
  };

  const matches = (it: Item, nm: (typeof names)[number]) => {
    if (fil === "1" && !(!it.skipped && it.status === 1)) return false;
    if (fil === "2" && !(!it.skipped && it.status === 2)) return false;
    if (fil === "rev" && !(!it.skipped && (it.status ?? 0) >= 3)) return false;
    if (fil === "check" && !(hasFlag(it, nm) || nm.dup)) return false;
    if (fil === "dup" && !nm.dup) return false;
    const t = q.trim().toLowerCase();
    if (!t) return true;
    const hay = [it.name, it.ref ?? "", nm.name ?? "", it.status ? STAMP_TXT[it.status] : ""].join(" ").toLowerCase();
    return t.split(/\s+/).every((w) => hay.includes(w));
  };
  const shown = items.map((it, i) => ({ it, nm: names[i], i })).filter(({ it, nm }) => matches(it, nm));
  const missing = useMemo(() => findMissing(items), [items]);
  const dupCount = names.filter((n) => n.dup).length;
  const chips: { k: Filter; label: string; n: number }[] = [
    { k: "all", label: "All", n: items.length },
    { k: "1", label: "Approved", n: stats.ok },
    { k: "2", label: "Approved as noted", n: stats.note },
    { k: "rev", label: "Revise / Not approved", n: stats.rev },
    { k: "check", label: "Need a check", n: items.filter((it, i) => hasFlag(it, names[i]) || names[i].dup).length },
    { k: "dup", label: "Duplicates", n: dupCount },
  ];
  const openPage = (it: Item) => setViewer({ heading: "Full page 1 of the scan", items: [{ id: it.id, title: it.name, buf: it.buf }] });
  const compare = (it: Item, i: number) => {
    const key = baseName(it, settings);
    const group = items.filter((o) => baseName(o, settings) === key);
    void i;
    setViewer({ heading: `Compare duplicates: ${group.length} scans with the same name`, items: group.map((o) => ({ id: o.id, title: o.name, buf: o.buf })) });
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

  return (
    <>
      <Header onTheme={toggleTheme} />
      <div ref={pageRef} className="relative mx-auto min-h-screen max-w-7xl px-4 pb-32 pt-14">
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
          <TimelineContent as="p" animationNum={0} timelineRef={pageRef} customVariants={revealVariants} className="w-[85%] text-sm text-mute md:text-base">
            Drop your Inspection Request scans. The app reads the IR reference, the revision and the engineer's decision from each one, so all you do is confirm and
            download.
          </TimelineContent>
          <TimelineContent as="div" animationNum={1} timelineRef={pageRef} customVariants={revealVariants}>
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

        <div className="grid gap-4 py-4 md:grid-cols-3">
          {/* 1. Upload */}
          <TimelineContent as="div" animationNum={2} timelineRef={pageRef} customVariants={revealVariants}>
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

          {/* 2. Check */}
          <TimelineContent as="div" animationNum={3} timelineRef={pageRef} customVariants={revealVariants}>
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
                <div className="mb-5 grid grid-cols-2 gap-2.5">
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
                <button type="button" className={cn(primaryBtn, "mb-3")} onClick={verifyClean} disabled={!items.length || busy}>
                  Verify all clean rows
                </button>
                <button type="button" className={cn(ghostBtn, "mb-6")} onClick={() => setFil((f) => (f === "check" ? "all" : "check"))} disabled={!items.length}>
                  {onlyFlag ? "Show all rows" : "Show only rows to check"}
                </button>
                <div className="space-y-3 border-t pt-4">
                  <h4 className="text-base font-semibold">What to look at</h4>
                  <ul className="space-y-2">
                    <Feature>The red box marks the option the app detected</Feature>
                    <Feature>Fix any wrong value right inside its row</Feature>
                    <Feature>Duplicate names get (2) added automatically</Feature>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TimelineContent>

          {/* 3. Download */}
          <TimelineContent as="div" animationNum={4} timelineRef={pageRef} customVariants={revealVariants}>
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
                <button type="button" className={cn(primaryBtn, "mb-3")} onClick={downloadZip} disabled={!ready || busy}>
                  Download renamed ZIP
                </button>
                <button type="button" className={cn(ghostBtn, "mb-6")} onClick={downloadCsv} disabled={!items.length}>
                  Download mapping CSV
                </button>
                <div className="space-y-3 border-t pt-4">
                  <h4 className="text-base font-semibold">Name example</h4>
                  <p className="break-all font-mono text-[12.5px] text-mute">{sample ?? "TVD-8775-KIC-PAR-WIR-ES-IRR-000049-R0-Approved as noted.pdf"}</p>
                  <ul className="space-y-2">
                    <Feature>Need just one file? Use "Download this PDF" on its row below</Feature>
                    <Feature>Your PDFs are only renamed, never changed</Feature>
                    <Feature>The CSV lists every old and new name</Feature>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TimelineContent>
        </div>

        <SettingsPanel settings={settings} onChange={setSettings} />

        <FolderShelf
          entries={items.map((it, i) => ({ it, nm: names[i] }))}
          folders={settings.folders}
          onDownload={({ it, nm }) => nm.name && download(new Blob([it.buf], { type: "application/pdf" }), nm.name)}
        />

        {items.length > 0 && (
          <Card className="mt-4 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2.5 border-b px-4 py-3">
              <h2 className="mr-auto text-lg font-semibold">Review every file</h2>
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
                <ReviewRow key={it.id} it={it} nm={nm} index={i} flagged={hasFlag(it, nm)} onEdit={(p) => edit(it.id, p)} onVerify={(v) => setVerified(it.id, v)} onDownload={() => nm.name && download(new Blob([it.buf], { type: "application/pdf" }), nm.name)} onZoom={() => openPage(it)} onCompare={nm.dup ? () => compare(it, i) : undefined} />
              ))}
              {!shown.length && <div className="p-8 text-center text-mute">No rows match. Clear the search or pick "All".</div>}
            </div>
          </Card>
        )}
        <div className="sr-only" id="status" aria-live="polite">
          {statusText}
        </div>
      </div>
      <PageViewer items={viewer?.items ?? null} heading={viewer?.heading ?? ""} onClose={closeViewer} />
      <Dock show={items.length > 0} verified={verified} total={items.length} ready={ready} busy={busy} onZip={downloadZip} />
    </>
  );
}
