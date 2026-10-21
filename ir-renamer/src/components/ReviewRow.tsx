import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { STAMP_TXT, STATUS_TXT, type Item, type Status } from "@/lib/types";
import type { FinalName } from "@/lib/naming";

const STAMP_CLS: Record<number, string> = {
  0: "text-mute",
  1: "text-ok",
  2: "text-note",
  3: "text-revise",
  4: "text-bad",
};

function Tag({ children, tone = "warn" }: { children: React.ReactNode; tone?: "warn" | "bad" | "good" }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-medium",
        tone === "warn" && "bg-revisebg text-revise",
        tone === "bad" && "bg-badbg text-bad",
        tone === "good" && "bg-okbg text-ok",
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
}

export function ReviewRow({ it, nm, index, flagged, onEdit, onVerify }: RowProps) {
  const base = "grid items-start gap-3.5 border-b border-line2 px-4 py-3.5 transition-colors duration-300 last:border-b-0";
  const tone = it.verified ? "bg-okbg/60" : flagged || nm.dup ? "bg-flagbg" : "";

  if (it.skipped) {
    return (
      <div className={cn(base, "grid-cols-[34px_1fr]", tone)}>
        <div className="pt-0.5 font-mono text-[13px] text-mute">{index + 1}</div>
        <div>
          <div className="mb-2 break-all text-xs text-mute">{it.name}</div>
          <Tag tone="good">Pehle se naam laga hai, as-is rakha</Tag>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(base, "grid-cols-[28px_1fr] lg:grid-cols-[34px_330px_minmax(240px,1fr)_minmax(220px,300px)_74px]", tone)}>
      <div className="pt-0.5 font-mono text-[13px] text-mute">{index + 1}</div>

      <div className="col-start-2 lg:col-start-auto">
        <img src={it.refImg} alt="IR ref ka hissa" className="block h-auto w-full rounded-md border border-line bg-white" />
        <img src={it.decImg} alt="Decision ka hissa" className="mt-1.5 block h-auto w-full rounded-md border border-line bg-white" />
      </div>

      <div className="col-start-2 lg:col-start-auto">
        <div data-testid="fname" className="mb-2 break-all text-xs text-mute">
          {it.name} · {it.pages || "?"} pages
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
              <option value="">Chuno</option>
              {([1, 2, 3, 4] as Status[]).map((k) => (
                <option key={k} value={k}>
                  {STATUS_TXT[k]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {it.flags.map((f) => (
            <Tag key={f}>{f}</Tag>
          ))}
          {nm.dup && <Tag tone="bad">Duplicate naam, (2) laga diya</Tag>}
          {!it.flags.length && nm.name && !nm.dup && <Tag tone="good">Auto-detect clean</Tag>}
        </div>
      </div>

      <div className="col-start-2 lg:col-start-auto">
        <span
          className={cn(
            "relative inline-block -rotate-[2.5deg] rounded-md border-2 border-current px-2.5 py-0.5 font-display text-[13px] font-extrabold tracking-wide",
            "bg-[color-mix(in_srgb,currentColor_8%,transparent)] after:absolute after:inset-0.5 after:rounded-[3px] after:border after:border-current after:opacity-55 after:content-['']",
            STAMP_CLS[it.status ?? 0],
          )}
        >
          {it.status ? STAMP_TXT[it.status] : "Decision?"}
        </span>
        {nm.name ? (
          <div data-testid="newname" className="mt-2.5 break-words font-mono text-[12.5px] font-medium leading-snug [overflow-wrap:anywhere]">{nm.name}</div>
        ) : (
          <div className="mt-2.5 font-medium text-bad">Naam nahi ban sakta, upar ref / rev / decision bharo</div>
        )}
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
      </label>
    </div>
  );
}
