import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/** Shows the page being read, with a scan beam while busy. */
export const LiveSheet = forwardRef<HTMLCanvasElement, { busy: boolean; hasPage: boolean }>(function LiveSheet(
  { busy, hasPage },
  ref,
) {
  return (
    <div className="relative hidden place-items-center bg-ink p-4 md:grid" aria-hidden="true">
      <div
        className={cn(
          "relative h-[209px] w-[148px] overflow-hidden rounded-[3px] bg-white shadow-[0_10px_26px_-8px_rgba(0,0,0,.55)] transition-transform duration-500",
          busy ? "rotate-0" : "-rotate-[2.2deg]",
        )}
      >
        <canvas ref={ref} width={296} height={418} className="block h-full w-full" />
        {!hasPage && (
          <div className="absolute inset-0 grid place-items-center p-3.5 text-center text-xs text-[#9aa4b8]">
            Padhi ja rahi page yahan dikhegi
          </div>
        )}
        <div
          className={cn(
            "absolute inset-x-0 -top-[34px] h-[34px] bg-gradient-to-b from-transparent to-hoard opacity-0",
            busy && "animate-scan opacity-100",
          )}
        />
      </div>
    </div>
  );
});
