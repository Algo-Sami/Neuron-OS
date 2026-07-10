import { Skeleton } from "@/components/ui/skeleton";

export default function RemindersLoading() {
  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto px-4 md:px-0">
      {/* Productivity Stats Header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Welcome and Toggle */}
        <div className="md:col-span-2 flex flex-col justify-between p-6 rounded-2xl border border-border/60 bg-card/30 space-y-4">
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-3.5 w-80" />
          </div>
          <div className="flex items-center gap-3 pt-3 border-t border-border/20">
            <Skeleton className="h-8 w-44 rounded-lg" />
            <Skeleton className="h-8 w-32 rounded-lg" />
          </div>
        </div>

        {/* Stats 2 */}
        <div className="p-6 rounded-2xl border border-border/60 bg-card/30 flex flex-col justify-between gap-4">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-2 w-full rounded-full" />
        </div>

        {/* Stats 3 */}
        <div className="p-6 rounded-2xl border border-border/60 bg-card/30 flex flex-col justify-between gap-4">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3.5 w-full" />
        </div>
      </div>

      {/* Main UI Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Calendar Grid Skeleton (2 columns) */}
        <div className="lg:col-span-2">
          <div className="border border-border/60 bg-card/30 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-border/20 flex justify-between items-center pl-6 pr-6 pt-5">
              <Skeleton className="h-5 w-40" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-8 w-14 rounded-lg" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            </div>
            <div className="p-4 md:p-6 space-y-4">
              <div className="grid grid-cols-7 gap-1 pb-3 mb-3 border-b border-border/20">
                {Array.from({ length: 7 }).map((_, i) => (
                  <Skeleton key={i} className="h-3 w-8 mx-auto" />
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} className="min-h-[72px] p-2 rounded-xl border border-border/40 bg-background/30 flex flex-col justify-between">
                    <Skeleton className="h-4 w-5 rounded" />
                    <Skeleton className="h-2 w-3 rounded-full mt-2" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar (Selected date & Quick Add) */}
        <div className="space-y-6">
          <div className="border border-border/60 bg-card/30 rounded-2xl p-5 space-y-4">
            <Skeleton className="h-5 w-44" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-3 rounded-xl border border-border/40 bg-background/50 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-3.5 w-32" />
                  </div>
                  <Skeleton className="h-3 w-full" />
                  <div className="flex gap-1.5 pt-1.5 border-t border-border/20">
                    <Skeleton className="h-4 w-12 rounded" />
                    <Skeleton className="h-4 w-12 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
