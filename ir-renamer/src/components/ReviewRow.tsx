import { Download, Maximize2, Columns2, Undo2, RotateCcw, Files } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { LEGENDS, type Item, type Legend, type Status } from "@/lib/types";
import type { FinalName } from "@/lib/naming";
import type { Conf } from "@/lib/checks";

const STAMP_CLS: Record<number, string> = {
  0: "text-mute",
  1: "text-ok",
  2: "text-note",
  3: "text-revise",
  4: "text-bad",
};

const CONF_LABEL: Record<Conf, string> = { high: "High confidence", medium: "Medium confidence", low: "Low confidence: check closely", manual: "Edited by you" };
const fmtTime = (t: number) => {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

function Tag({ children, tone = "warn" }: { children: React.ReactNode; tone?: "warn" | "bad" | "good" | "info" }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-medium",
        tone === "warn" && "bg-revisebg text-revise",
        tone === "bad" && "bg-badbg text-bad",
        tone === "good" && "bg-okbg text-ok",
        tone === "info" && "border bg-panel text-mute",
      )}
    >
      {children}
    </span>
  );
}

export interface RowProps {
  it: Item;
  nm: FinalName;
  index: number;
  flagged: boolean;
  onEdit: (patch: Partial<Item>) => void;
  onVerify: (v: boolean) => void;
  onDownload: () => void;
  onZoom: () => void;
  onCompare?: () => void;
  conf: Conf;
  confWhy: string[];
  xc: string[];
  focused: boolean;
  onFocus: () => void;
  onUndo: () => void;
  onReset: () => void;
}

export function ReviewRow({ it, nm, index, flagged, onEdit, onVerify, onDownload, onZoom, onCompare, conf, confWhy, xc, focused, onFocus, onUndo, onReset }: RowProps) {
  const base = cn("grid items-start gap-3.5 border-b border-line2 px-4 py-3.5 transition-colors duration-300 last:border-b-0", focused && "outline outline-2 -outline-offset-2 outline-orange-500");
  const tone = it.verified ? "bg-okbg/60" : flagged || nm.dup ? "bg-flagbg" : "";

  if (it.skipped) {
    return (
      <div data-row-id={it.id} onMouseDown={onFocus} className={cn(base, "grid-cols-[34px_1fr]", tone)}>
        <div className="pt-0.5 font-mono text-[13px] text-mute">{index + 1}</div>
        <div>
          <div className="mb-2 break-all text-xs text-mute">{it.name}</div>
          <Tag tone="good">Already named, kept as-is</Tag>
          <div><button
          type="button"
          onClick={onDownload}
          disabled={!nm.name}
          className="mt-2.5 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-orange-500 bg-panel px-3 py-1.5 text-[13px] font-medium text-pen transition hover:bg-orange-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download className="h-4 w-4" /> Download this PDF
        </button></div>
        </div>
      </div>
    );
  }

  return (
    <div data-row-id={it.id} onMouseDown={onFocus} className={cn(base, "grid-cols-[28px_1fr] lg:grid-cols-[34px_330px_minmax(240px,1fr)_minmax(220px,300px)_92px]", tone)}>
      <div className="pt-0.5 font-mono text-[13px] text-mute">{index + 1}</div>

      <div className="col-start-2 lg:col-start-auto">
        <button type="button" onClick={onZoom} title="Click to see the full page" className="block w-full cursor-zoom-in rounded-md outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-pen">
          <img src={it.refImg} alt="IR reference area of the scan" className="block h-auto w-full rounded-md border border-line bg-white transition hover:border-orange-500" />
        </button>
        <button type="button" onClick={onZoom} title="Click to see the full page" className="mt-1.5 block w-full cursor-zoom-in rounded-md outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-pen">
          <img src={it.decImg} alt="Engineer decision area of the scan" className="block h-auto w-full rounded-md border border-line bg-white transition hover:border-orange-500" />
        </button>
        <button type="button" onClick={onZoom} className="mt-1.5 inline-flex cursor-zoom-in items-center gap-1 text-[12.5px] font-medium text-pen hover:underline">
          <Maximize2 className="h-3.5 w-3.5" /> View full page
        </button>
      </div>

      <div className="col-start-2 lg:col-start-auto">
        <div data-testid="fname" className="mb-2 break-all text-xs text-mute">
          {it.name} · {it.pages || "?"} {it.pages === 1 ? "page" : "pages"}
        </div>
        <label className="flex flex-col gap-1 text-[12.5px] text-mute">
          IR Ref No
          <input
            type="text"
            className="w-full font-mono text-[13px]"
            defaultValue={it.ref ?? ""}
            key={"r" + (it.ref ?? "")}
            onBlur={(e) => e.target.value.trim() !== (it.ref ?? "") && onEdit({ ref: e.target.value.trim() })}
          />
        </label>
        <div className="mt-2 flex gap-2.5">
          <label className="flex flex-col gap-1 text-[12.5px] text-mute">
            Rev
            <input
              type="text"
              className="w-[70px] min-w-0 font-mono text-[13px]"
              defaultValue={it.rev ?? ""}
              key={"v" + (it.rev ?? "")}
              onBlur={(e) => e.target.value.trim() !== (it.rev ?? "") && onEdit({ rev: e.target.value.trim() })}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-[12.5px] text-mute">
            Decision
            <select value={it.status ?? ""} onChange={(e) => onEdit({ status: e.target.value ? (Number(e.target.value) as Status) : null })}>
              <option value="">Choose</option>
              {LEGENDS[it.legend].options.map((k) => (
                <option key={k} value={k}>
                  {LEGENDS[it.legend].text[k]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="mt-2 flex flex-col gap-1 text-[12.5px] text-mute">
          Form type
          <select
            value={it.legend}
            onChange={(e) => {
              const legend = e.target.value as Legend;
              onEdit({ legend, status: it.status && LEGENDS[legend].options.includes(it.status) ? it.status : null });
            }}
          >
            {(Object.keys(LEGENDS) as Legend[]).map((k) => (
              <option key={k} value={k}>
                {LEGENDS[k].title}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span title={confWhy.join("; ")}>
            <Tag tone={conf === "high" ? "good" : conf === "medium" ? "warn" : conf === "low" ? "bad" : "info"}>{CONF_LABEL[conf]}</Tag>
          </span>
          {it.pages > 1 && (
            <button type="button" onClick={onZoom} className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-orange-500 bg-panel px-2.5 py-0.5 text-xs font-medium text-pen hover:bg-orange-500 hover:text-white">
              <Files className="h-3.5 w-3.5" /> {it.pages} pages · view all
            </button>
          )}
          {it.flags.map((f) => (
            <Tag key={f}>{f}</Tag>
          ))}
          {xc.map((f) => (
            <Tag key={f} tone="bad">{f}</Tag>
          ))}
          {nm.dup && <Tag tone="bad">Duplicate name, (2) added</Tag>}
          {nm.dup && onCompare && (
            <button type="button" onClick={onCompare} className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-orange-500 bg-panel px-2.5 py-0.5 text-xs font-medium text-pen hover:bg-orange-500 hover:text-white">
              <Columns2 className="h-3.5 w-3.5" /> Compare duplicates
            </button>
          )}
          {!it.flags.length && !xc.length && nm.name && !nm.dup && <Tag tone="good">Auto-detect clean</Tag>}
        </div>
        {!!it.history?.length && (
          <details className="mt-2 rounded-md border bg-panel px-2.5 py-1.5 text-[12.5px]">
            <summary className="cursor-pointer font-medium text-ink">Change history ({it.history.length})</summary>
            <ul className="mt-1.5 space-y-0.5 text-mute">
              {it.history.map((c, k) => (
                <li key={k} className="font-mono text-[11.5px]">
                  {fmtTime(c.t)} · {c.field}: {c.from ?? "(empty)"} → {c.to ?? "(empty)"}
                </li>
              ))}
            </ul>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={onUndo} className="inline-flex cursor-pointer items-center gap-1 rounded-md border bg-panel px-2.5 py-1 text-xs font-medium hover:border-orange-500">
                <Undo2 className="h-3.5 w-3.5" /> Undo last change
              </button>
              <button type="button" onClick={onReset} className="inline-flex cursor-pointer items-center gap-1 rounded-md border bg-panel px-2.5 py-1 text-xs font-medium hover:border-orange-500">
                <RotateCcw className="h-3.5 w-3.5" /> Back to auto-detected
              </button>
            </div>
          </details>
        )}
      </div>

      <div className="col-start-2 lg:col-start-auto">
        <span
          className={cn(
            "relative inline-block -rotate-[2.5deg] rounded-md border-2 border-current px-2.5 py-0.5 font-display text-[13px] font-extrabold tracking-wide",
            "bg-[color-mix(in_srgb,currentColor_8%,transparent)] after:absolute after:inset-0.5 after:rounded-[3px] after:border after:border-current after:opacity-55 after:content-['']",
            STAMP_CLS[it.status ?? 0],
          )}
        >
          {it.status ? LEGENDS[it.legend].stamp[it.status] : "Decision?"}
        </span>
        {nm.name ? (
          <div data-testid="newname" className="mt-2.5 break-words font-mono text-[12.5px] font-medium leading-snug [overflow-wrap:anywhere]">{nm.name}</div>
        ) : (
          <div className="mt-2.5 font-medium text-bad">Cannot build a name: fill in ref, rev and decision</div>
        )}
        <button
          type="button"
          onClick={onDownload}
          disabled={!nm.name}
          className="mt-2.5 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-orange-500 bg-panel px-3 py-1.5 text-[13px] font-medium text-pen transition hover:bg-orange-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download className="h-4 w-4" /> Download this PDF
        </button>
      </div>

      <label className="col-start-2 text-center lg:col-start-auto">
        <input type="checkbox" className="peer sr-only" checked={it.verified} disabled={!nm.name} onChange={(e) => onVerify(e.target.checked)} />
        <span
          className={cn(
            "inline-grid h-[34px] w-[34px] cursor-pointer place-items-center rounded-[9px] border-2 transition-all duration-300 peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-pen peer-disabled:cursor-not-allowed peer-disabled:opacity-35",
            it.verified ? "border-ok bg-ok" : "border-line bg-panel",
          )}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={false} animate={{ pathLength: it.verified ? 1 : 0, opacity: it.verified ? 1 : 0 }} transition={{ duration: 0.3, delay: 0.04 }} />
          </svg>
        </span>
        <small className="mt-1 block text-[11.5px] text-mute">Verified</small>
        {it.verified && it.verifiedAt && (
          <small className="block text-[10.5px] leading-tight text-mute">
            {it.verifiedBy ? it.verifiedBy + ", " : ""}
            {fmtTime(it.verifiedAt).slice(5)}
          </small>
        )}
      </label>
    </div>
  );
}
