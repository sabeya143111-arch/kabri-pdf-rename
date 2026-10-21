import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X, ZoomIn, ZoomOut } from "lucide-react";
import { renderFirstPage } from "@/lib/analyze";
import { cn } from "@/lib/utils";

export interface ViewItem {
  id: string;
  title: string;
  buf: ArrayBuffer;
}

const cache = new Map<string, string>();

async function pageUrl(v: ViewItem): Promise<string> {
  const hit = cache.get(v.id);
  if (hit) return hit;
  const { canvas } = await renderFirstPage(v.buf);
  const url = canvas.toDataURL("image/jpeg", 0.88);
  cache.set(v.id, url);
  return url;
}

export function PageViewer({ items, heading, onClose }: { items: ViewItem[] | null; heading: string; onClose: () => void }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    if (!items) return;
    setZoom(false);
    let alive = true;
    items.forEach((v) =>
      pageUrl(v).then((u) => alive && setUrls((x) => ({ ...x, [v.id]: u }))),
    );
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => {
      alive = false;
      window.removeEventListener("keydown", key);
      document.body.style.overflow = "";
    };
  }, [items, onClose]);

  return (
    <AnimatePresence>
      {items && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={heading}
        >
          <motion.div
            initial={{ scale: 0.96, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.97, opacity: 0 }}
            className="flex w-full max-w-[1500px] flex-col overflow-hidden rounded-xl border bg-panel shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b px-4 py-3">
              <h3 className="mr-auto text-base font-semibold">{heading}</h3>
              <button
                type="button"
                onClick={() => setZoom((z) => !z)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border bg-panel px-3 py-1.5 text-sm font-medium text-ink hover:border-orange-500"
              >
                {zoom ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
                {zoom ? "Fit to window" : "Zoom in"}
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="grid h-9 w-9 cursor-pointer place-items-center rounded-full border bg-panel text-ink hover:border-orange-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-ground p-4">
              <div className={cn("mx-auto grid gap-4", items.length > 1 ? "md:grid-cols-2" : "max-w-[900px]", zoom && "w-max max-w-none")}>
                {items.map((v) => (
                  <figure key={v.id} className="m-0">
                    <figcaption className="mb-1.5 break-all font-mono text-xs text-mute">{v.title}</figcaption>
                    {urls[v.id] ? (
                      <img
                        src={urls[v.id]}
                        alt={`Page 1 of ${v.title}`}
                        className={cn("block h-auto rounded-md border bg-white", zoom ? "w-[1654px] max-w-none" : "w-full")}
                      />
                    ) : (
                      <div className="grid aspect-[1/1.414] w-full place-items-center rounded-md border bg-panel text-sm text-mute">Loading page…</div>
                    )}
                  </figure>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
