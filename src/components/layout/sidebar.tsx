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
        "h-full flex flex-col border-r border-border/80 bg-sidebar py-4 overflow-hidden shadow-2xs select-none",
        "transition-all duration-300 ease-in-out"
      )}
      style={{ width: expanded ? "13rem" : "3.2rem" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 mb-6 h-9 overflow-hidden shrink-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shrink-0 shadow-md shadow-primary/25">
          <BrainCircuit className="h-4 w-4" />
        </div>
        <span
          className={cn(
            "text-xs font-bold tracking-wider text-foreground whitespace-nowrap uppercase tracking-widest transition-all duration-200",
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
                "group/item flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition-all duration-200 overflow-hidden",
                isActive
                  ? "bg-primary/10 border-primary/20 text-foreground shadow-2xs"
                  : "bg-transparent border-transparent text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
              )}
            >
              {/* Icon — always visible */}
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-transform duration-200 group-hover/item:scale-105",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground group-hover/item:text-foreground"
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
                    "ml-auto h-1.5 w-1.5 rounded-full bg-primary shrink-0 transition-opacity duration-200",
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
        <div className="h-px bg-border/40 mx-1 mb-2" />
        <Link
          href="/profile"
          title="Settings"
          className={cn(
            "group/item flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition-all duration-200 overflow-hidden",
            pathname === "/profile"
              ? "bg-primary/10 border-primary/20 text-foreground"
              : "bg-transparent border-transparent text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
          )}
        >
          <Settings
            className={cn(
              "h-4 w-4 shrink-0 transition-transform duration-200 group-hover/item:rotate-12",
              pathname === "/profile"
                ? "text-primary"
                : "text-muted-foreground group-hover/item:text-foreground"
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
