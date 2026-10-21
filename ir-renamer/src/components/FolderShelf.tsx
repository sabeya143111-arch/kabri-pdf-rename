import { useEffect, useState } from "react";
import GlassFolder, { type ArtPreset, type FolderFile } from "@/components/ui/glass-folder-cards";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Item } from "@/lib/types";
import type { FinalName } from "@/lib/naming";

export interface Entry {
  it: Item;
  nm: FinalName;
}

const GROUPS: { key: string; label: string; art: ArtPreset | "none"; seed: number }[] = [
  { key: "1", label: "Approved", art: "verdant", seed: 4 },
  { key: "2", label: "Approved as noted", art: "glacier", seed: 7 },
  { key: "3", label: "Revise and resubmit", art: "dusk", seed: 2 },
  { key: "4", label: "Not approved", art: "ember", seed: 9 },
  { key: "skip", label: "Already named", art: "none", seed: 1 },
];

function useDark() {
  const read = () => {
    const t = document.documentElement.dataset.theme;
    return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  };
  const [dark, setDark] = useState(read);
  useEffect(() => {
    const mo = new MutationObserver(() => setDark(read()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = () => setDark(read());
    mq.addEventListener("change", on);
    return () => {
      mo.disconnect();
      mq.removeEventListener("change", on);
    };
  }, []);
  return dark;
}

const kb = (n: number) => (n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");

/** The ZIP as a shelf of glass folders, one per decision. Click a file to download that PDF. */
export function FolderShelf({ entries, folders, onDownload }: { entries: Entry[]; folders: boolean; onDownload: (e: Entry) => void }) {
  const dark = useDark();
  if (!folders || !entries.length) return null;

  const groups = GROUPS.map((g) => ({
    ...g,
    list: entries.filter(({ it }) => (it.skipped ? g.key === "skip" : String(it.status ?? "") === g.key)),
  })).filter((g) => g.list.length);

  return (
    <Card className="mt-4 overflow-hidden" data-testid="shelf">
      <CardHeader className="pb-2 text-left">
        <h3 className="text-2xl font-semibold">Your ZIP, by folder</h3>
        <p className="text-sm text-mute">This is how the files will sit inside the ZIP. Hover a folder to lean it, click to open it, click a file to download that PDF.</p>
      </CardHeader>
      <CardContent className="pt-28">
        <div className="grid grid-cols-1 items-end justify-items-center gap-x-10 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((g, gi) => {
            const files: FolderFile[] = g.list.map(({ it, nm }) => ({
              name: (nm.name ?? it.name).replace(/^TVD-\d{4}-[A-Z]{3}-[A-Z]{3}-[A-Z]{3}-[A-Z]{2}-/, "").replace(/\.pdf$/i, ""),
              meta: `${kb(it.buf.byteLength)}`,
            }));
            const key = g.key + ":" + g.list.map((e) => e.it.id + (e.nm.name ?? "")).join("|");
            return (
              <GlassFolder
                key={key + dark}
                label={g.label}
                meta={`${g.list.length} ${g.list.length === 1 ? "file" : "files"}`}
                tone={dark ? "dark" : "light"}
                art={g.art}
                seed={g.seed}
                action="none"
                files={files}
                appearDelay={gi * 120}
                width={300}
                onFileSelect={(_, i) => {
                  const e = g.list[i];
                  if (e?.nm.name) onDownload(e);
                }}
              />
            );
          })}
        </div>
        <p className="mt-3 text-center text-xs text-mute">
          Folders appear only for decisions that have files. Turn folders off in the settings below to get a flat ZIP.
        </p>
      </CardContent>
    </Card>
  );
}
