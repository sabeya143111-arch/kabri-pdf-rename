import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface PillOption<T extends string> {
  value: T;
  label: string;
  badge?: string;
}

/** Sliding two-option switch (adapted from the pricing section's billing switch). */
export function PillSwitch<T extends string>({
  options,
  value,
  onChange,
  className,
  layoutId = "pill",
}: {
  options: PillOption<T>[];
  value: T | null;
  onChange: (v: T) => void;
  className?: string;
  layoutId?: string;
}) {
  return (
    <div className={cn("flex justify-center", className)}>
      <div className="relative z-10 mx-auto flex w-fit rounded-xl border border-line bg-ground p-1">
        {options.map((o) => {
          const on = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              aria-pressed={on}
              className={cn(
                "relative z-10 h-12 w-fit shrink-0 cursor-pointer rounded-xl px-3 py-1 text-sm font-medium transition-colors sm:px-6 sm:py-2 sm:text-base",
                on ? "text-white" : "text-muted-foreground hover:text-ink",
              )}
            >
              {on && (
                <motion.span
                  layoutId={layoutId}
                  className="absolute left-0 top-0 h-12 w-full rounded-xl border-4 border-orange-600 bg-gradient-to-t from-orange-500 via-orange-400 to-orange-600 shadow-sm shadow-orange-600"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <span className="relative flex items-center gap-2">
                {o.label}
                {o.badge && <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-black">{o.badge}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
