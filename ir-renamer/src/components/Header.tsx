import { FileCheck2, Moon } from "lucide-react";

export function Header({ onTheme }: { onTheme: () => void }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-panel/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
        <div className="grid h-9 w-9 place-items-center rounded-lg border border-orange-400 bg-gradient-to-t from-orange-500 to-orange-600 shadow-md shadow-orange-500/30">
          <FileCheck2 className="h-5 w-5 text-white" strokeWidth={2.2} />
        </div>
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
