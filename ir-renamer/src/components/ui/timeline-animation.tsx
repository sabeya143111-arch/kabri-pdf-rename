"use client";

import { motion, useInView, type Variants } from "motion/react";
import type { ReactNode, RefObject } from "react";

type Tag = "div" | "p" | "section" | "article" | "h2" | "span";

interface TimelineContentProps {
  as?: Tag;
  animationNum: number;
  timelineRef: RefObject<HTMLElement | null>;
  customVariants?: Variants;
  className?: string;
  children?: ReactNode;
  once?: boolean;
}

/** Reveals its children in sequence (by `animationNum`) once the timeline container is on screen. */
export function TimelineContent({
  as = "div",
  animationNum,
  timelineRef,
  customVariants,
  className,
  children,
  once = true,
}: TimelineContentProps) {
  const inView = useInView(timelineRef as RefObject<HTMLElement>, { once });
  const Comp = motion[as] as typeof motion.div;
  return (
    <Comp custom={animationNum} initial="hidden" animate={inView ? "visible" : "hidden"} variants={customVariants} className={className}>
      {children}
    </Comp>
  );
}
