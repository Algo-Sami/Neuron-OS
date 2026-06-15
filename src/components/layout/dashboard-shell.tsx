"use client";

import React, { useState, Suspense } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { NavProgress } from "@/components/layout/nav-progress";

// Routes that need full-height, no-padding explorer mode
const EXPLORER_ROUTES = ["/subjects", "/recycle-bin"];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const pathname = usePathname();

  // Any route starting with an explorer prefix gets full-height mode
  const isExplorerRoute = EXPLORER_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Suspense fallback={null}>
        <NavProgress />
      </Suspense>

      {/* Sidebar column */}
      <div
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        className={`
          shrink-0 sticky top-0 h-screen z-40
          transition-all duration-300 ease-in-out
          ${expanded ? "w-56" : "w-14"}
        `}
      >
        <Sidebar expanded={expanded} />
      </div>

      {/* Main column — fills remaining space, never overflows */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <TopNav />
        {isExplorerRoute ? (
          /* Full-height no-padding mode: for explorer pages */
          <main className="flex-1 overflow-hidden flex flex-col min-h-0 bg-muted/20">
            {children}
          </main>
        ) : (
          /* Standard padded scrollable mode: for all other pages */
          <main className="flex-1 overflow-y-auto bg-muted/20">
            <div className="mx-auto max-w-6xl p-6">
              {children}
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
