import { ChevronDown } from "lucide-react";
import type { Settings, Status } from "@/lib/types";

const LABELS: [Status, string][] = [
  [1, "1 - Approved"],
  [2, "2 - Approved as noted"],
  [3, "3 - Revise and resubmit"],
  [4, "4 - Not approved"],
];

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-[12.5px] text-mute">
      {label}
      {children}
    </label>
  );
}

export function SettingsPanel({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  return (
    <details className="group mt-3.5 rounded-xl border border-line bg-panel shadow-panel">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-[18px] py-3 font-semibold [&::-webkit-details-marker]:hidden">
        Naam ka format
        <span className="font-mono text-[12.5px] font-medium text-mute">{settings.tpl}</span>
        <ChevronDown className="ml-auto h-4 w-4 transition-transform duration-300 group-open:rotate-180" />
      </summary>
      <div className="border-t border-line2 px-[18px] pb-4">
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <F label="Format">
            <input type="text" className="min-w-[270px]" value={settings.tpl} onChange={(e) => onChange({ ...settings, tpl: e.target.value })} />
          </F>
          {LABELS.map(([k, l]) => (
            <F key={k} label={l}>
              <input
                type="text"
                value={settings.labels[k]}
                onChange={(e) => onChange({ ...settings, labels: { ...settings.labels, [k]: e.target.value } })}
              />
            </F>
          ))}
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              className="h-[17px] w-[17px] accent-[var(--pen)]"
              checked={settings.skipNamed}
              onChange={(e) => onChange({ ...settings, skipNamed: e.target.checked })}
            />
            Jo file pehle se "TVD-" se shuru hai usko chhod do
          </label>
        </div>
        <p className="mt-2 text-[12.5px] text-mute">
          Format me <code className="font-mono">{"{ref}"}</code>, <code className="font-mono">{"{rev}"}</code> (00 → 0) aur{" "}
          <code className="font-mono">{"{status}"}</code> chalta hai. Letters chahiye to labels me A / B / C / D likh do.
        </p>
      </div>
    </details>
  );
}
