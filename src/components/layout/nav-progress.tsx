"use client";

import { useEffect, useState, startTransition } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // When pathname or search params change, route loading finishes
  useEffect(() => {
    setLoading(false);
    setProgress(0);
  }, [pathname, searchParams]);

  // Handle fake progress bar progression
  useEffect(() => {
    if (!loading) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        // Slower increment as it gets closer to 90%
        const increment = prev < 50 ? Math.random() * 12 + 5 : Math.random() * 4 + 1;
        return Math.min(90, prev + increment);
      });
    }, 120);

    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      // Find nearest parent anchor tag
      let target = e.target as HTMLElement | null;
      while (target && target.tagName !== "A") {
        target = target.parentElement;
      }

      if (!target || !(target instanceof HTMLAnchorElement)) return;

      const href = target.getAttribute("href");
      if (!href) return;

      // Only capture relative paths starting with /
      const isInternal = href.startsWith("/") && !href.startsWith("//");
      const isAnchor = href.includes("#");

      if (isInternal && !isAnchor && target.target !== "_blank") {
        // Compare paths
        const currentPath = window.location.pathname;
        const currentSearch = window.location.search;
        
        try {
          const targetUrl = new URL(href, window.location.href);
          if (currentPath !== targetUrl.pathname || currentSearch !== targetUrl.search) {
            setLoading(true);
            setProgress(15);
          }
        } catch (err) {
          // Fallback if URL constructor fails on dynamic routes
          setLoading(true);
          setProgress(15);
        }
      }
    };

    document.addEventListener("click", handleLinkClick, { capture: true });
    return () => document.removeEventListener("click", handleLinkClick, { capture: true });
  }, []);

  if (!loading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-primary/20 pointer-events-none w-full">
      <div
        className="h-full bg-primary transition-all duration-200 ease-out shadow-[0_0_8px_var(--color-primary)]"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
