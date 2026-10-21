import { ChevronDown } from "lucide-react";
import { LEGENDS, type Legend, type Settings, type Status } from "@/lib/types";

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-[12.5px] text-mute">
      {label}
      {children}
    </label>
  );
}

export function SettingsPanel({ settings, onChange, open }: { settings: Settings; onChange: (s: Settings) => void; open?: boolean }) {
  return (
    <details open={open} className="group rounded-lg border bg-card shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-5 py-3.5 font-semibold [&::-webkit-details-marker]:hidden">
        File name format
        <span className="font-mono text-[12.5px] font-medium text-mute">{settings.tpl}</span>
        <ChevronDown className="ml-auto h-4 w-4 transition-transform duration-300 group-open:rotate-180" />
      </summary>
      <div className="border-t px-5 pb-4">
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <F label="Format">
            <input type="text" className="min-w-[270px]" value={settings.tpl} onChange={(e) => onChange({ ...settings, tpl: e.target.value })} />
          </F>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" className="h-[17px] w-[17px] accent-[var(--pen)]" checked={settings.skipNamed} onChange={(e) => onChange({ ...settings, skipNamed: e.target.checked })} />
            Skip files that already start with "TVD-"
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" className="h-[17px] w-[17px] accent-[var(--pen)]" checked={settings.folders} onChange={(e) => onChange({ ...settings, folders: e.target.checked })} />
            Put files in folders by decision (in the ZIP)
          </label>
        </div>
        <div className="mt-4 space-y-4">
          {(Object.keys(LEGENDS) as Legend[]).map((g) => (
            <div key={g}>
              <h4 className="mb-1.5 text-sm font-semibold">{LEGENDS[g].title}</h4>
              <div className="flex flex-wrap gap-3">
                {LEGENDS[g].options.map((k: Status) => (
                  <F key={k} label={LEGENDS[g].text[k]}>
                    <input
                      type="text"
                      className="min-w-[220px]"
                      value={settings.labels[g][k]}
                      onChange={(e) => onChange({ ...settings, labels: { ...settings.labels, [g]: { ...settings.labels[g], [k]: e.target.value } } })}
                    />
                  </F>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[12.5px] text-mute">
          Use <code className="font-mono">{"{ref}"}</code>, <code className="font-mono">{"{rev}"}</code> (00 becomes 0) and <code className="font-mono">{"{status}"}</code> in the format. Use the
          switch at the top for letter codes, or type your own labels above.
        </p>
      </div>
    </details>
  );
}
