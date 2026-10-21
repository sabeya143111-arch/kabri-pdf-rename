import { Download, ListChecks, Menu, Moon, PackageCheck, Settings2, UploadCloud, X } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export type View = "upload" | "review" | "download" | "settings";

interface Props {
  view: View;
  onView: (v: View) => void;
  total: number;
  verified: number;
  flagged: number;
  ready: boolean;
  busy: boolean;
  open: boolean;
  onOpen: (o: boolean) => void;
  onZip: () => void;
  onTheme: () => void;
}

const NAV: { id: View; label: string; icon: typeof UploadCloud }[] = [
  { id: "upload", label: "Upload", icon: UploadCloud },
  { id: "review", label: "Review files", icon: ListChecks },
  { id: "download", label: "Download", icon: PackageCheck },
  { id: "settings", label: "Settings", icon: Settings2 },
];

function Brand({ stacked = false }: { stacked?: boolean }) {
  return (
    <div className={cn("flex min-w-0 gap-3", stacked ? "flex-col items-start" : "items-center")}>
      <img src="/kabri-logo.png" alt="KABRI International Co. L.L.C" className={cn("w-auto rounded-md bg-white object-contain ring-1 ring-line", stacked ? "h-11" : "h-8")} />
      <div className="min-w-0">
        <h1 className="whitespace-nowrap text-[17px] font-semibold leading-none">IR Renamer</h1>
        {stacked && <small className="mt-1.5 block text-xs text-mute">Inspection Request PDFs</small>}
      </div>
    </div>
  );
}

export function Sidebar({ view, onView, total, verified, flagged, ready, busy, open, onOpen, onZip, onTheme }: Props) {
  const badge = (id: View) => {
    if (!total) return null;
    if (id === "review") return flagged > 0 ? { text: `${flagged} to check`, tone: "warn" } : { text: String(total), tone: "plain" };
    if (id === "download") return { text: `${verified}/${total}`, tone: ready ? "good" : "plain" };
    return null;
  };
  const go = (v: View) => {
    onView(v);
    onOpen(false);
  };

  return (
    <>
      {/* phone and tablet: top bar */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b bg-panel/90 px-4 py-2.5 backdrop-blur-md lg:hidden">
        <button type="button" onClick={() => onOpen(true)} aria-label="Open menu" className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg border bg-panel text-ink">
          <Menu className="h-5 w-5" />
        </button>
        <Brand />
        <span className="ml-auto text-xs text-mute">{total ? `${verified}/${total} verified` : ""}</span>
      </div>

      {open && <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => onOpen(false)} aria-hidden="true" />}

      <aside
        aria-label="Main menu"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col border-r bg-panel transition-transform duration-300 ease-out lg:z-20 lg:translate-x-0",
          open ? "translate-x-0 shadow-2xl" : "-translate-x-full",
        )}
      >
        <div className="flex items-start justify-between px-5 pb-5 pt-5">
          <Brand stacked />
          <button type="button" onClick={() => onOpen(false)} aria-label="Close menu" className="grid h-8 w-8 cursor-pointer place-items-center rounded-full border text-ink lg:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3" aria-label="Sections">
          {NAV.map(({ id, label, icon: Icon }) => {
            const b = badge(id);
            const on = view === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => go(id)}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "relative flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[15px] font-medium transition-colors",
                  on ? "text-white" : "text-ink hover:bg-line2",
                )}
              >
                {on && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-lg bg-gradient-to-t from-orange-500 to-orange-600 shadow-md shadow-orange-500/30" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                <Icon className="relative h-[18px] w-[18px] shrink-0" />
                <span className="relative">{label}</span>
                {b && (
                  <span
                    className={cn(
                      "relative ml-auto rounded-full px-2 py-0.5 text-xs font-semibold",
                      on ? "bg-white/25 text-white" : b.tone === "warn" ? "bg-revisebg text-revise" : b.tone === "good" ? "bg-okbg text-ok" : "bg-line2 text-mute",
                    )}
                  >
                    {b.text}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="space-y-3 border-t p-4">
          <div>
            <div className="mb-1.5 flex justify-between text-[13px] text-mute">
              <span>Verified</span>
              <span>
                <b className="text-ink">{verified}</b> / {total}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-line2">
              <motion.div className="h-full rounded-full bg-ok" initial={false} animate={{ width: `${total ? (verified / total) * 100 : 0}%` }} transition={{ type: "spring", stiffness: 140, damping: 22 }} />
            </div>
          </div>
          <button
            type="button"
            disabled={!ready || busy}
            onClick={onZip}
            title={ready ? "" : "Verify every row first"}
            className={cn(
              "flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-orange-400 bg-gradient-to-t from-orange-500 to-orange-600 px-4 py-2.5 font-medium text-white shadow-lg shadow-orange-500/30 transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none",
              ready && !busy && "animate-nudge",
            )}
          >
            <Download className="h-4 w-4" /> Download ZIP
          </button>
          <button type="button" onClick={onTheme} className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-mute hover:bg-line2 hover:text-ink">
            <Moon className="h-4 w-4" /> Switch light / dark
          </button>
        </div>
      </aside>
    </>
  );
}
