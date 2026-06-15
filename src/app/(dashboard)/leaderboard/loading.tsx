import { Skeleton } from "@/components/ui/skeleton";

export default function LeaderboardLoading() {
  return (
    <div className="max-w-5xl mx-auto w-full pb-10 px-4 md:px-0">
      {/* Header */}
      <div className="flex flex-col gap-1.5 border-b border-border/40 pb-5 mb-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-3.5 w-80 mt-1" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Main Leaderboard Table (2 columns) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-border/60 bg-card/30 overflow-hidden">
            {/* Table Header toolbar */}
            <div className="p-4 border-b border-border/40 flex items-center justify-between">
              <Skeleton className="h-5 w-44" />
              <div className="flex gap-2">
                <Skeleton className="h-7 w-24 rounded-lg" />
                <Skeleton className="h-7 w-24 rounded-lg" />
              </div>
            </div>
            {/* Table rows */}
            <div className="p-4 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-background/50">
                  <Skeleton className="h-6 w-6 rounded-full" /> {/* Rank */}
                  <Skeleton className="h-9 w-9 rounded-full" /> {/* Avatar */}
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-2.5 w-40" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded" /> {/* XP */}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar (Trophy Room, Streaks, Challenges) */}
        <div className="space-y-6">
          {/* User gamification card */}
          <div className="p-5 rounded-2xl border border-border/60 bg-card/30 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/20">
              <div className="text-center space-y-1">
                <Skeleton className="h-3 w-8 mx-auto" />
                <Skeleton className="h-4 w-12 mx-auto" />
              </div>
              <div className="text-center space-y-1">
                <Skeleton className="h-3 w-8 mx-auto" />
                <Skeleton className="h-4 w-12 mx-auto" />
              </div>
              <div className="text-center space-y-1">
                <Skeleton className="h-3 w-8 mx-auto" />
                <Skeleton className="h-4 w-12 mx-auto" />
              </div>
            </div>
          </div>

          {/* Daily Challenges card */}
          <div className="p-5 rounded-2xl border border-border/60 bg-card/30 space-y-4">
            <Skeleton className="h-4 w-40" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <Skeleton className="h-3 w-44" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
