import { cn } from "@/lib/utils";

export function ProgressPanel({ pct, text, busy }: { pct: number; text: string; busy: boolean }) {
  return (
    <section className="mt-3.5 flex items-center gap-4 rounded-xl border border-line bg-panel px-[18px] py-3.5 shadow-panel" aria-live="polite">
      <div
        className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full transition-[background] duration-200"
        style={{ background: `conic-gradient(var(--pen) ${pct}%, var(--line2) 0)` }}
      >
        <b className="grid h-[42px] w-[42px] place-items-center rounded-full bg-panel font-mono text-[13px] font-semibold">{pct}%</b>
      </div>
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate font-medium">{text}</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-md bg-line2">
          <div
            className={cn("h-full rounded-md bg-gradient-to-r from-pen to-hoard transition-[width] duration-300", busy && "animate-flow bg-[length:200%_100%]")}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </section>
  );
}
