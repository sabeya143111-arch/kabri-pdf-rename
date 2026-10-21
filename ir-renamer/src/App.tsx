import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import FileUpload from "@/components/ui/file-upload";
import { Header, type Step } from "@/components/Header";
import { LiveSheet } from "@/components/LiveSheet";
import { ProgressPanel } from "@/components/ProgressPanel";
import { StatsStrip, type Stats } from "@/components/StatsStrip";
import { SettingsPanel } from "@/components/SettingsPanel";
import { ReviewRow } from "@/components/ReviewRow";
import { Dock } from "@/components/Dock";
import { analyse, getWorker } from "@/lib/analyze";
import { finalNames, hasFlag } from "@/lib/naming";
import { STATUS_TXT, type Item, type Settings, type UploadRow } from "@/lib/types";

interface Pending {
  id: string;
  name: string;
  get: () => Promise<ArrayBuffer>;
}

const DEFAULTS: Settings = {
  tpl: "{ref}-R{rev}-{status}",
  labels: { 1: "Approved", 2: "Approved as noted", 3: "Revise and resubmit", 4: "Not approved" },
  skipNamed: true,
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
  const [onlyFlag, setOnlyFlag] = useState(false);
  const [hasPage, setHasPage] = useState(false);
  const previewRef = useRef<HTMLCanvasElement>(null);

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
  const stats: Stats = {
    total: items.length,
    ok: items.filter((i) => !i.skipped && i.status === 1).length,
    note: items.filter((i) => !i.skipped && i.status === 2).length,
    rev: items.filter((i) => !i.skipped && (i.status ?? 0) >= 3).length,
    flagged: flaggedLeft,
  };
  const step: Step = !items.length ? 1 : !ready ? 2 : 3;

  /* ---------- processing ---------- */
  const handleFiles = useCallback(
    async (files: File[]) => {
      if (busy) return;
      setBusy(true);
      setDone(false);
      setPct(0);
      try {
        setStatusText("Files load ho rahi hain…");
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
          setStatusText("Koi PDF nahi mili.");
          return;
        }
        setUploads((u) => [...u, ...pending.map((p) => ({ id: p.id, name: p.name, size: 0, progress: 0 }))]);
        const setRow = (id: string, progress: number, size?: number) =>
          setUploads((u) => u.map((r) => (r.id === id ? { ...r, progress, size: size ?? r.size } : r)));
        await getWorker();
        for (let i = 0; i < pending.length; i++) {
          const p = pending[i];
          setStatusText(`Padh raha hoon: ${i + 1} / ${pending.length}  —  ${p.name}`);
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
        setStatusText(`Ho gaya: ${pending.length} files. Neeche har row check karo, phir download.`);
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
    setOnlyFlag(false);
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
  const downloadZip = async () => {
    if (!ready) return;
    const z = new JSZip();
    items.forEach((it, i) => z.file(names[i].name!, it.buf));
    const blob = await z.generateAsync({ type: "blob", compression: "STORE" });
    download(blob, "renamed_pdfs.zip");
    setStatusText(`ZIP download ho gayi: ${items.length} files.`);
  };
  const downloadCsv = () => {
    const q = (v: unknown) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
    const lines = ["old_name,new_name,ref,rev,decision"];
    items.forEach((it, i) => lines.push([it.name, names[i].name ?? "", it.ref ?? "", it.rev ?? "", it.status ? STATUS_TXT[it.status] : ""].map(q).join(",")));
    download(new Blob(["﻿" + lines.join("\n")], { type: "text/csv" }), "rename_mapping.csv");
  };

  const shown = items.map((it, i) => ({ it, nm: names[i], i })).filter(({ it, nm }) => !onlyFlag || hasFlag(it, nm) || nm.dup);

  return (
    <>
      <Header step={step} onTheme={toggleTheme} />
      <main className="mx-auto max-w-[1240px] px-5 pb-32 pt-5">
        <section className="grid overflow-hidden rounded-xl border border-line bg-panel shadow-panel md:grid-cols-[1fr_250px]">
          <FileUpload files={uploads} busy={busy} onFiles={handleFiles} onRemove={removeOne} onClear={clearAll} />
          <LiveSheet ref={previewRef} busy={busy} hasPage={hasPage} />
        </section>

        {(busy || done) && <ProgressPanel pct={pct} text={statusText} busy={busy} />}
        {done && <StatsStrip stats={stats} />}
        <div className="sr-only" id="status">{statusText}</div>

        <SettingsPanel settings={settings} onChange={setSettings} />

        {items.length > 0 && (
          <section className="mt-3.5 overflow-hidden rounded-xl border border-line bg-panel shadow-panel">
            <div className="flex flex-wrap items-center gap-2.5 border-b border-line px-4 py-3">
              <h2 className="mr-auto font-display text-lg font-bold">Har file check karo</h2>
              <span className="text-[12.5px] text-mute">{items.length} files · {flaggedLeft} check karni baaki</span>
              <button type="button" onClick={() => setOnlyFlag((v) => !v)} className="cursor-pointer rounded-lg border border-transparent px-3.5 py-2 font-semibold transition hover:border-ink">
                {onlyFlag ? "Sab dikhao" : "Sirf check-wali dikhao"}
              </button>
              <button type="button" onClick={verifyClean} className="cursor-pointer rounded-lg border border-line bg-panel px-3.5 py-2 font-semibold transition hover:border-ink active:scale-[.98]">
                Clean wali sab verify karo
              </button>
            </div>
            <div data-testid="rows">
              {shown.map(({ it, nm, i }) => (
                <ReviewRow key={it.id} it={it} nm={nm} index={i} flagged={hasFlag(it, nm)} onEdit={(p) => edit(it.id, p)} onVerify={(v) => setVerified(it.id, v)} />
              ))}
              {!shown.length && <div className="p-8 text-center text-mute">Koi row check karne ko nahi bachi.</div>}
            </div>
          </section>
        )}
      </main>
      <Dock show={items.length > 0} verified={verified} total={items.length} ready={ready} busy={busy} onZip={downloadZip} onCsv={downloadCsv} />
    </>
  );
}
