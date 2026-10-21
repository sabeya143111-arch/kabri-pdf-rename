import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/** Shows the page being read, with a scan beam while busy. */
export const LiveSheet = forwardRef<HTMLCanvasElement, { busy: boolean; hasPage: boolean }>(function LiveSheet({ busy, hasPage }, ref) {
  return (
    <div className="mt-4 grid place-items-center rounded-lg bg-neutral-900 p-3" aria-hidden="true">
      <div
        className={cn(
          "relative h-[150px] w-[106px] overflow-hidden rounded-[3px] bg-white shadow-[0_10px_26px_-8px_rgba(0,0,0,.6)] transition-transform duration-500",
          busy ? "rotate-0" : "-rotate-2",
        )}
      >
        <canvas ref={ref} width={296} height={418} className="block h-full w-full" />
        {!hasPage && <div className="absolute inset-0 grid place-items-center p-2 text-center text-[11px] text-neutral-400">The page being read shows up here</div>}
        <div className={cn("absolute inset-x-0 -top-[34px] h-[34px] bg-gradient-to-b from-transparent to-orange-500 opacity-0", busy && "animate-scan opacity-100")} />
      </div>
    </div>
  );
});
