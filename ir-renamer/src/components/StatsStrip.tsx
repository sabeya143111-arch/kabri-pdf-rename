import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

function CountUp({ value, play }: { value: number; play: boolean }) {
  const [shown, setShown] = useState(0);
  const first = useRef(true);
  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!play || reduce || !first.current) {
      setShown(value);
      if (play) first.current = false;
      return;
    }
    first.current = false;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 650);
      setShown(Math.round(value * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, play]);
  return <>{shown}</>;
}

export interface Stats {
  total: number;
  ok: number;
  note: number;
  rev: number;
  flagged: number;
}

const TILES: { key: keyof Stats; label: string; bar: string }[] = [
  { key: "total", label: "Total files", bar: "bg-ink" },
  { key: "ok", label: "Approved", bar: "bg-ok" },
  { key: "note", label: "Approved as noted", bar: "bg-note" },
  { key: "rev", label: "Revise / Not approved", bar: "bg-revise" },
  { key: "flagged", label: "Check karne wali", bar: "bg-bad" },
];

/** The one orchestrated moment: tiles drop in like rubber stamps when reading finishes. */
export function StatsStrip({ stats }: { stats: Stats }) {
  return (
    <section className="mt-3.5 grid grid-cols-2 gap-3 md:grid-cols-5" aria-label="Summary">
      {TILES.map((t, i) => (
        <motion.div
          key={t.key}
          initial={{ opacity: 0, scale: 1.5, rotate: -4 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 17, delay: i * 0.09 }}
          className="relative overflow-hidden rounded-xl border border-line bg-panel px-4 py-3.5"
        >
          <span className={cn("absolute inset-y-0 left-0 w-[5px]", t.bar)} />
          <div className="font-display text-[34px] font-extrabold leading-none tracking-tight">
            <CountUp value={stats[t.key]} play />
          </div>
          <div className="mt-1.5 text-[13px] text-mute">{t.label}</div>
        </motion.div>
      ))}
    </section>
  );
}
