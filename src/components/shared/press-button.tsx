"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

export function PressButton(props: HTMLMotionProps<"button">) {
  const reduced = useReducedMotion();
  return <motion.button type="button" {...props} data-motion-press
    whileTap={reduced ? undefined : { scale: .96 }}
    transition={{ type: "spring", stiffness: 400, damping: 30 }}/>;
}
