import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-5 max-w-5xl mx-auto w-full pb-10 px-4 md:px-0 animate-pulse">
      {/* Header skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 border-b border-border/40 pb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-52" />
            <Skeleton className="h-3 w-72" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-7 w-24 rounded-lg" />
          <Skeleton className="h-7 w-24 rounded-lg" />
          <Skeleton className="h-7 w-24 rounded-lg" />
        </div>
      </div>

      {/* AI advisor skeleton */}
      <Skeleton className="h-20 w-full rounded-xl" />

      {/* Stats cards */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-3.5 w-3.5 rounded" />
            </div>
            <Skeleton className="h-7 w-10" />
            <Skeleton className="h-2.5 w-24" />
          </div>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 items-start">
        <div className="lg:col-span-4 rounded-xl border border-border/60 bg-card/50 p-4 space-y-3">
          <Skeleton className="h-3.5 w-28 mb-1" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/30">
              <Skeleton className="h-8 w-8 rounded-md shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
            </div>
          ))}
        </div>
        <div className="lg:col-span-3 flex flex-col gap-4">
          <Skeleton className="h-20 w-full rounded-xl" />
          <div className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-2.5">
            <Skeleton className="h-3.5 w-32 mb-1" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
