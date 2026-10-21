import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export function Dock({
  show, verified, total, ready, busy, onZip,
}: { show: boolean; verified: number; total: number; ready: boolean; busy: boolean; onZip: () => void }) {
  return (
    <motion.div
      initial={false}
      animate={{ y: show ? 0 : "110%" }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className="fixed inset-x-0 bottom-0 z-[15] border-t bg-panel/90 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
        <div className="min-w-[180px] flex-1">
          <span className="mb-1.5 block text-[13px] text-mute">
            <b className="text-ink">{verified}</b> / {total} verified
          </span>
          <div className="h-2 overflow-hidden rounded-full bg-line2">
            <motion.div className="h-full rounded-full bg-ok" initial={false} animate={{ width: `${total ? (verified / total) * 100 : 0}%` }} transition={{ type: "spring", stiffness: 140, damping: 22 }} />
          </div>
        </div>
        <button
          type="button"
          disabled={!ready || busy}
          onClick={onZip}
          title={ready ? "" : "Verify every row first"}
          className={cn(
            "cursor-pointer rounded-xl border border-orange-400 bg-gradient-to-t from-orange-500 to-orange-600 px-5 py-2.5 font-medium text-white shadow-lg shadow-orange-500/30 transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none",
            ready && !busy && "animate-nudge",
          )}
        >
          Download ZIP
        </button>
      </div>
    </motion.div>
  );
}
