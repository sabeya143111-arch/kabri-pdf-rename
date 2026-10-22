import { useState } from "react";
import { Download, ListChecks, Menu, Moon, PackageCheck, Pin, PinOff, Settings2, UploadCloud, X } from "lucide-react";
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
  /** phone drawer */
  open: boolean;
  onOpen: (o: boolean) => void;
  /** desktop: keep the sidebar expanded instead of expanding on hover */
  pinned: boolean;
  onPin: (p: boolean) => void;
  onZip: () => void;
  onTheme: () => void;
}

const NAV: { id: View; label: string; icon: typeof UploadCloud }[] = [
  { id: "upload", label: "Upload", icon: UploadCloud },
  { id: "review", label: "Review files", icon: ListChecks },
  { id: "download", label: "Download", icon: PackageCheck },
  { id: "settings", label: "Settings", icon: Settings2 },
];

export const SIDEBAR_COLLAPSED = 60;
export const SIDEBAR_EXPANDED = 280;

/** Label that fades in when the sidebar is expanded. */
function Label({ show, children, className }: { show: boolean; children: React.ReactNode; className?: string }) {
  return (
    <motion.span
      initial={false}
      animate={{ opacity: show ? 1 : 0, display: show ? "inline-block" : "none" }}
      transition={{ duration: 0.15 }}
      className={cn("whitespace-pre", className)}
    >
      {children}
    </motion.span>
  );
}

function Brand({ expanded }: { expanded: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {expanded ? (
        <img src="/kabri-logo.png" alt="KABRI International Co. L.L.C" className="h-9 w-auto shrink-0 rounded-md bg-white object-contain ring-1 ring-line" />
      ) : (
        <img src="/favicon.png" alt="KABRI" className="h-9 w-9 shrink-0 rounded-md bg-white object-contain ring-1 ring-line" />
      )}
      <Label show={expanded} className="text-[17px] font-semibold leading-none">
        IR Renamer
      </Label>
    </div>
  );
}

export function Sidebar({ view, onView, total, verified, flagged, ready, busy, open, onOpen, pinned, onPin, onZip, onTheme }: Props) {
  const [hover, setHover] = useState(false);
  const expandedDesktop = pinned || hover;

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

  /** The same menu is used on desktop (collapsible) and in the phone drawer (always expanded). */
  const body = (expanded: boolean, mobile: boolean) => (
    <>
      <div className="flex items-center gap-2 px-3 pb-4 pt-4">
        <div className="min-w-0 flex-1 overflow-hidden">
          <Brand expanded={expanded} />
        </div>
        {mobile ? (
          <button type="button" onClick={() => onOpen(false)} aria-label="Close menu" className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full border text-ink">
            <X className="h-4 w-4" />
          </button>
        ) : (
          expanded && (
            <button
              type="button"
              onClick={() => onPin(!pinned)}
              aria-pressed={pinned}
              title={pinned ? "Unpin: the sidebar will collapse again" : "Pin: keep the sidebar open"}
              className={cn(
                "grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg border transition-colors",
                pinned ? "border-orange-500 bg-orange-500 text-white" : "bg-panel text-mute hover:border-orange-500 hover:text-ink",
              )}
            >
              {pinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
              <span className="sr-only">{pinned ? "Unpin sidebar" : "Pin sidebar"}</span>
            </button>
          )
        )}
      </div>

      <nav className="flex-1 space-y-1 px-2" aria-label="Sections">
        {NAV.map(({ id, label, icon: Icon }) => {
          const b = badge(id);
          const on = view === id;
          const dot = !expanded && id === "review" && flagged > 0;
          return (
            <button
              key={id}
              type="button"
              onClick={() => go(id)}
              aria-current={on ? "page" : undefined}
              title={expanded ? undefined : label}
              className={cn(
                "relative flex w-full cursor-pointer items-center gap-3 overflow-hidden rounded-lg px-[11px] py-2.5 text-left text-[15px] font-medium transition-colors",
                on ? "text-white" : "text-ink hover:bg-line2",
              )}
            >
              {on && <motion.span layoutId={mobile ? "nav-pill-m" : "nav-pill"} className="absolute inset-0 rounded-lg bg-gradient-to-t from-orange-500 to-orange-600 shadow-md shadow-orange-500/30" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
              <span className="relative shrink-0">
                <Icon className="h-[18px] w-[18px]" />
                {dot && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-bad ring-2 ring-panel" />}
              </span>
              <Label show={expanded} className="relative">
                {label}
              </Label>
              {b && expanded && (
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

      <div className="space-y-3 border-t p-3">
        {expanded ? (
          <div className="px-1">
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
        ) : (
          total > 0 && (
            <div className="text-center text-[10.5px] font-semibold leading-tight text-mute" title="Verified rows">
              <span className="text-ink">{verified}</span>/{total}
            </div>
          )
        )}
        <button
          type="button"
          disabled={!ready || busy}
          onClick={onZip}
          title={ready ? "Download ZIP" : "Verify every row first"}
          className={cn(
            "flex w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl border border-orange-400 bg-gradient-to-t from-orange-500 to-orange-600 py-2.5 font-medium text-white shadow-lg shadow-orange-500/30 transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none",
            ready && !busy && "animate-nudge",
          )}
        >
          <Download className="h-4 w-4 shrink-0" />
          <Label show={expanded}>Download ZIP</Label>
        </button>
        <button type="button" onClick={onTheme} title="Switch light / dark" className="flex w-full cursor-pointer items-center gap-2 overflow-hidden rounded-lg px-[11px] py-1.5 text-sm text-mute hover:bg-line2 hover:text-ink">
          <Moon className="h-4 w-4 shrink-0" />
          <Label show={expanded}>Switch light / dark</Label>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* phone and tablet: top bar + full-height drawer */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b bg-panel/90 px-4 py-2.5 backdrop-blur-md lg:hidden">
        <button type="button" onClick={() => onOpen(true)} aria-label="Open menu" className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg border bg-panel text-ink">
          <Menu className="h-5 w-5" />
        </button>
        <Brand expanded />
        <span className="ml-auto text-xs text-mute">{total ? `${verified}/${total} verified` : ""}</span>
      </div>
      {open && <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => onOpen(false)} aria-hidden="true" />}
      <aside
        aria-label="Main menu"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r bg-panel transition-transform duration-300 ease-out lg:hidden",
          open ? "translate-x-0 shadow-2xl" : "-translate-x-full",
        )}
      >
        {body(true, true)}
      </aside>

      {/* desktop: 60px rail that opens on hover; the pin keeps it open */}
      <motion.aside
        aria-label="Main menu"
        initial={false}
        animate={{ width: expandedDesktop ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED }}
        transition={{ type: "spring", stiffness: 420, damping: 38 }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHover(false);
        }}
        className={cn("fixed inset-y-0 left-0 z-30 hidden flex-col overflow-hidden border-r bg-panel lg:flex", expandedDesktop && !pinned && "shadow-2xl")}
      >
        {body(expandedDesktop, false)}
      </motion.aside>
    </>
  );
}
