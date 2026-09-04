"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  BrainCircuit,
  LayoutDashboard,
  BookOpen,
  UploadCloud,
  MessageSquare,
  Bell,
  Settings,
  Trophy,
  Trash2,
  Sparkles,
  Users,
} from "lucide-react";

const navigation = [
  { name: "Dashboard",    href: "/dashboard",   icon: LayoutDashboard },
  { name: "Subjects",     href: "/subjects",    icon: BookOpen },
  { name: "Uploads",      href: "/uploads",     icon: UploadCloud },
  { name: "Study Coach",  href: "/study-coach", icon: Sparkles },
  { name: "Study Rooms",  href: "/rooms",       icon: Users },
  { name: "AI Assistant", href: "/assistant",   icon: MessageSquare },
  { name: "Reminders",    href: "/reminders",   icon: Bell },
  { name: "Leaderboard",  href: "/leaderboard", icon: Trophy },
  { name: "Recycle Bin",  href: "/recycle-bin", icon: Trash2 },
];

interface SidebarProps {
  /** Controlled by the parent DashboardShell on hover */
  expanded?: boolean;
}

export function Sidebar({ expanded = false }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div
      className={cn(
        "h-full w-full flex flex-col border-r border-[#d0d4db] bg-[#ffffff] py-3 overflow-hidden select-none",
        "transition-all duration-300 ease-in-out"
      )}
      style={{
        fontFamily: '"Segoe UI Variable", "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, sans-serif'
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 mb-4 h-9 overflow-hidden shrink-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0078d4] text-white shrink-0 shadow-xs">
          <BrainCircuit className="h-4 w-4" />
        </div>
        <span
          className={cn(
            "text-xs font-bold tracking-wider text-[#201f1e] whitespace-nowrap uppercase tracking-widest transition-all duration-200",
            expanded ? "opacity-100 delay-75" : "opacity-0 w-0"
          )}
        >
          Neuron OS
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-0.5 px-2">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              title={item.name}
              className={cn(
                "group/item flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-normal transition-colors duration-150 overflow-hidden",
                isActive
                  ? "bg-[#eff6fc] text-[#0078d4] font-semibold border-l-2 border-l-[#0078d4] border-t-0 border-r-0 border-b-0"
                  : "bg-transparent text-[#323130] hover:bg-[#f3f2f1] hover:text-[#000000]"
              )}
            >
              {/* Icon — always visible */}
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  isActive
                    ? "text-[#0078d4]"
                    : "text-[#605e5c] group-hover/item:text-[#201f1e]"
                )}
                aria-hidden="true"
              />
              {/* Label — controlled by expanded prop */}
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-200",
                  expanded ? "opacity-100 delay-75" : "opacity-0 w-0"
                )}
              >
                {item.name}
              </span>
              {/* Active dot — visible only when collapsed */}
              {isActive && (
                <span
                  className={cn(
                    "ml-auto h-1.5 w-1.5 rounded-full bg-[#0078d4] shrink-0 transition-opacity duration-200",
                    expanded ? "opacity-0" : "opacity-100"
                  )}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: Settings */}
      <div className="mt-auto px-2 space-y-0.5 shrink-0">
        <div className="h-px bg-[#e1dfdd] mx-1 mb-2" />
        <Link
          href="/profile"
          title="Settings"
          className={cn(
            "group/item flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-normal transition-colors duration-150 overflow-hidden",
            pathname === "/profile"
              ? "bg-[#eff6fc] text-[#0078d4] font-semibold border-l-2 border-l-[#0078d4]"
              : "bg-transparent text-[#323130] hover:bg-[#f3f2f1] hover:text-[#000000]"
          )}
        >
          <Settings
            className={cn(
              "h-4 w-4 shrink-0 transition-colors",
              pathname === "/profile"
                ? "text-[#0078d4]"
                : "text-[#605e5c] group-hover/item:text-[#201f1e]"
            )}
            aria-hidden="true"
          />
          <span
            className={cn(
              "whitespace-nowrap transition-all duration-200",
              expanded ? "opacity-100 delay-75" : "opacity-0 w-0"
            )}
          >
            Settings
          </span>
        </Link>
      </div>
    </div>
  );
}
