import { cn } from "@/lib/utils";

export function ProgressPanel({ pct, text, busy }: { pct: number; text: string; busy: boolean }) {
  return (
    <div className="mt-4 flex items-center gap-3" aria-live="polite">
      <div
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full transition-[background] duration-200"
        style={{ background: `conic-gradient(var(--pen) ${pct}%, var(--line2) 0)` }}
      >
        <b className="grid h-[34px] w-[34px] place-items-center rounded-full bg-panel font-mono text-[11px] font-semibold">{pct}%</b>
      </div>
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-sm font-medium">{text}</p>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-md bg-line2">
          <div
            className={cn("h-full rounded-md bg-gradient-to-r from-orange-600 to-orange-300 transition-[width] duration-300", busy && "animate-flow bg-[length:200%_100%]")}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
