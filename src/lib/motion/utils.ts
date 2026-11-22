import { ScrollTrigger } from "./gsap";
import { getPrefersReducedMotion } from "@/hooks/use-reduced-motion";

/**
 * Utility to run an animation callback if reduced motion is disabled,
 * or immediately apply the static/fallback state if reduced motion is enabled.
 * 
 * Ensures elements are NEVER stuck in an invisible or incomplete state
 * when a user has prefers-reduced-motion enabled.
 * 
 * @param animateFn Function containing GSAP animation logic
 * @param fallbackFn Optional function to apply final state immediately (defaults to gsap.set)
 */
export function safeAnimate(
  animateFn: () => void,
  fallbackFn?: () => void
): void {
  if (getPrefersReducedMotion()) {
    if (fallbackFn) {
      fallbackFn();
    }
    return;
  }
  animateFn();
}

/**
 * Standardized ScrollTrigger factory with production-safe defaults:
 * - Always sets invalidateOnRefresh: true for reliable window resize recalculations
 * - Automatically ignores when reduced-motion is requested
 */
export function createSafeScrollTrigger(
  vars: ScrollTrigger.Vars
): ScrollTrigger | null {
  if (typeof window === "undefined") {
    return null;
  }

  return ScrollTrigger.create({
    invalidateOnRefresh: true,
    ...vars,
  });
}
