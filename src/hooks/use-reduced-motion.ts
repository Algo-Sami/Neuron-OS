import * as React from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Synchronous non-hook helper to detect reduced-motion preference.
 * Safe to call outside React components (e.g., inside GSAP context setup, Three.js useFrame, or event handlers).
 */
export function getPrefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * Reactive React hook to detect and subscribe to user's reduced-motion preference.
 * Uses React.useSyncExternalStore for hydration safety in Next.js App Router (SSR-safe).
 * 
 * @returns boolean true if user prefers reduced motion, false otherwise.
 */
export function useReducedMotion(): boolean {
  const subscribe = React.useCallback((callback: () => void) => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return () => {};
    }

    const mql = window.matchMedia(REDUCED_MOTION_QUERY);
    mql.addEventListener("change", callback);
    return () => mql.removeEventListener("change", callback);
  }, []);

  const getSnapshot = React.useCallback(() => {
    return getPrefersReducedMotion();
  }, []);

  const getServerSnapshot = React.useCallback(() => {
    return false; // Default to false during SSR to render consistent initial markup
  }, []);

  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
