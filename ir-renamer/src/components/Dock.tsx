import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export function Dock({
  show, verified, total, ready, busy, onZip, onCsv,
}: { show: boolean; verified: number; total: number; ready: boolean; busy: boolean; onZip: () => void; onCsv: () => void }) {
  return (
    <motion.div
      initial={false}
      animate={{ y: show ? 0 : "110%" }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className="fixed inset-x-0 bottom-0 z-[15] border-t border-line bg-panel/90 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-4 px-5 py-3">
        <div className="min-w-[180px] flex-1">
          <span className="mb-1.5 block text-[13px] text-mute">
            <b className="text-ink">{verified}</b> / {total} verified
          </span>
          <div className="h-2 overflow-hidden rounded-full bg-line2">
            <motion.div className="h-full rounded-full bg-ok" initial={false} animate={{ width: `${total ? (verified / total) * 100 : 0}%` }} transition={{ type: "spring", stiffness: 140, damping: 22 }} />
          </div>
        </div>
        <button type="button" onClick={onCsv} className="cursor-pointer rounded-lg border border-line bg-panel px-4 py-2 font-semibold transition hover:border-ink active:scale-[.98]">
          Mapping CSV
        </button>
        <button
          type="button"
          disabled={!ready || busy}
          onClick={onZip}
          title={ready ? "" : "Pehle saari rows verify karo"}
          className={cn(
            "cursor-pointer rounded-lg border border-hoard bg-hoard px-4 py-2 font-semibold text-[#13203a] shadow-[inset_0_-3px_0_rgba(0,0,0,.16)] transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none",
            ready && !busy && "animate-nudge hover:shadow-[inset_0_-3px_0_rgba(0,0,0,.16),0_8px_20px_-8px_var(--hoard)]",
          )}
        >
          Renamed ZIP download karo
        </button>
      </div>
    </motion.div>
  );
}
