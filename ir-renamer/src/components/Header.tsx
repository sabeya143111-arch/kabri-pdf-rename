import { FileCheck2, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

export type Step = 1 | 2 | 3;

function StepPill({ n, label, state }: { n: number; label: string; state: "idle" | "on" | "done" }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 font-medium transition-colors duration-300",
        state === "on" ? "bg-ink text-panel" : state === "done" ? "text-ink" : "text-mute",
      )}
    >
      <i
        className={cn(
          "grid h-[22px] w-[22px] place-items-center rounded-full border-[1.5px] text-xs font-semibold not-italic transition-all duration-300",
          state === "on" && "border-hoard bg-hoard text-[#13203a]",
          state === "done" && "border-ok bg-ok text-white",
          state === "idle" && "border-line",
        )}
      >
        {n}
      </i>
      {label}
    </div>
  );
}

export function Header({ step, onTheme }: { step: Step; onTheme: () => void }) {
  const st = (n: number) => (step === n ? "on" : step > n ? "done" : "idle");
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-panel/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-5 px-5 py-2.5">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-[9px] bg-hoard shadow-[inset_0_-3px_0_rgba(0,0,0,.14)]">
            <FileCheck2 className="h-[22px] w-[22px] text-[#13203a]" strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="font-display text-[19px] font-extrabold leading-none">IR Renamer</h1>
            <small className="mt-0.5 block text-xs text-mute">Inspection Request PDFs ko ref + decision ke saath rename karo</small>
          </div>
        </div>
        <nav className="ml-auto hidden items-center gap-1.5 lg:flex" aria-label="Steps">
          <StepPill n={1} label="PDFs load" state={st(1)} />
          <StepPill n={2} label="Check" state={st(2)} />
          <StepPill n={3} label="Download" state={st(3)} />
        </nav>
        <button
          type="button"
          onClick={onTheme}
          title="Light / dark"
          aria-label="Theme badlo"
          className="ml-auto grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-line bg-panel text-ink lg:ml-0"
        >
          <Moon className="h-[18px] w-[18px]" />
        </button>
      </div>
    </header>
  );
}
