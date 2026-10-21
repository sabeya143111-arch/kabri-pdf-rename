import { Moon } from "lucide-react";

export function Header({ onTheme }: { onTheme: () => void }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-panel/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
        <img
          src="/kabri-logo.png"
          alt="KABRI International Co. L.L.C"
          className="h-9 w-auto rounded-md bg-white object-contain ring-1 ring-line"
        />
        <div className="hidden h-6 w-px bg-line sm:block" />
        <div>
          <h1 className="text-[17px] font-semibold leading-none">IR Renamer</h1>
          <small className="mt-0.5 block text-xs text-mute">Inspection Request PDFs, renamed by reference and decision</small>
        </div>
        <button
          type="button"
          onClick={onTheme}
          title="Switch light / dark"
          aria-label="Switch light or dark theme"
          className="ml-auto grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-line bg-panel text-ink"
        >
          <Moon className="h-[18px] w-[18px]" />
        </button>
      </div>
    </header>
  );
}
