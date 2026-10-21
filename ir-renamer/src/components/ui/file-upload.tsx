"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { UploadCloud, File as FileIcon, Trash2, Loader, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UploadRow } from "@/lib/types";

/**
 * Drop zone + animated file list (adapted from the shadcn "file-upload" component).
 * Progress here is real: it follows the PDF being read, not a fake timer.
 */
export interface FileUploadProps {
  files: UploadRow[];
  busy: boolean;
  onFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

const formatFileSize = (bytes: number): string => {
  if (!bytes) return "0 KB";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.min(3, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${(bytes / Math.pow(k, i)).toFixed(i ? 1 : 0)} ${sizes[i]}`;
};

export default function FileUpload({ files, busy, onFiles, onRemove, onClear }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer?.files?.length) onFiles(Array.from(e.dataTransfer.files));
  };
  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  };
  const onDragLeave = (e: DragEvent) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) setIsDragging(false);
  };
  const onSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) onFiles(Array.from(e.target.files));
    e.target.value = "";
  };

  return (
    <div className="w-full">
      {/* Drop zone */}
      <motion.div
        role="button"
        tabIndex={0}
        aria-label="PDFs ya ZIP select karo"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        initial={false}
        animate={{ scale: isDragging ? 1.015 : 1 }}
        whileHover={{ scale: isDragging ? 1.015 : 1.005 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "group relative cursor-pointer overflow-hidden px-8 py-9 md:px-10",
          "bg-[repeating-linear-gradient(-45deg,transparent_0_14px,color-mix(in_srgb,var(--hoard)_14%,transparent)_14px_28px)]",
          isDragging && "bg-[color-mix(in_srgb,var(--pen)_8%,transparent)] ring-4 ring-pen/30",
        )}
      >
        <span
          className={cn(
            "pointer-events-none absolute inset-2.5 rounded-lg border-2 border-dashed transition-all duration-200",
            isDragging ? "inset-[7px] border-pen" : "border-line group-hover:border-pen",
          )}
        />
        <div className="relative z-10 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <div className="relative shrink-0">
            {isDragging && (
              <span className="absolute -inset-4 animate-glow-slow rounded-full bg-pen/20 blur-md" />
            )}
            <UploadCloud
              strokeWidth={1.5}
              className={cn(
                "relative h-16 w-16 transition-colors duration-300 md:h-[72px] md:w-[72px]",
                isDragging ? "animate-bounce-drop text-pen" : "text-ink group-hover:text-pen",
              )}
            />
          </div>
          <div className="space-y-1.5">
            <h2 className="font-display text-2xl font-extrabold md:text-[26px]">
              {isDragging ? "Yahan chhodo" : files.length ? "Aur files add karo" : "PDFs ya ZIP upload karo"}
            </h2>
            <p className="max-w-lg text-mute">
              {isDragging ? (
                <span className="font-semibold text-pen">Chhodte hi padhna shuru ho jayega</span>
              ) : (
                <>
                  Drag &amp; drop karo, ya <span className="font-semibold text-pen">browse</span> karo. Sab kuch aapke
                  browser me hota hai, file kahin upload nahi hoti.
                </>
              )}
            </p>
            <p className="text-sm text-mute">Inspection Request PDFs, ya unki ZIP</p>
          </div>
        </div>
        <input ref={inputRef} type="file" multiple hidden onChange={onSelect} accept=".pdf,.zip,application/pdf,application/zip" />
      </motion.div>

      {/* Uploaded files list */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-line px-5 pb-4 pt-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-base font-bold">Files ({files.length})</h3>
                {files.length > 1 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onClear}
                    className="cursor-pointer rounded-md px-3 py-1 text-sm font-medium text-mute transition-colors hover:bg-line2 hover:text-bad disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className={cn("flex flex-col gap-2 overflow-y-auto pr-1", files.length > 3 && "max-h-72")}>
                <AnimatePresence initial={false}>
                  {files.map((file) => (
                    <motion.div
                      key={file.id}
                      layout
                      initial={{ opacity: 0, y: 14, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -24, scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 300, damping: 24 }}
                      className="flex items-center gap-3 rounded-xl border border-line2 bg-ground/50 px-3 py-2.5"
                    >
                      <div className="relative shrink-0">
                        <FileIcon strokeWidth={1.5} className="h-9 w-9 text-pen" />
                        {file.progress >= 100 && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.3 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: "spring", stiffness: 420, damping: 16 }}
                            className="absolute -bottom-1.5 -right-1.5 rounded-full bg-panel"
                          >
                            <CheckCircle className="h-[18px] w-[18px] text-ok" />
                          </motion.div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-medium" title={file.name}>
                          {file.name}
                        </p>
                        <div className="mt-0.5 flex items-center justify-between text-xs text-mute">
                          <span>{formatFileSize(file.size)}</span>
                          <span className="flex items-center gap-1.5">
                            <span className="font-medium tabular-nums">{Math.round(file.progress)}%</span>
                            {file.progress < 100 ? (
                              <Loader className="h-3.5 w-3.5 animate-spin text-pen" />
                            ) : (
                              <button
                                type="button"
                                disabled={busy}
                                aria-label="Is file ko hatao"
                                onClick={() => onRemove(file.id)}
                                className="cursor-pointer text-mute transition-colors hover:text-bad disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line2">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${file.progress}%` }}
                            transition={{ type: "spring", stiffness: 120, damping: 20 }}
                            className={cn("h-full rounded-full", file.progress < 100 ? "bg-pen" : "bg-ok")}
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
