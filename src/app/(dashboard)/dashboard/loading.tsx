import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full pb-10 px-4 md:px-0 animate-pulse">
      {/* Header skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div className="flex items-center gap-3.5">
          <Skeleton className="h-11 w-11 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-3 w-80" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-7 w-24 rounded-lg" />
          <Skeleton className="h-7 w-24 rounded-lg" />
          <Skeleton className="h-7 w-24 rounded-lg" />
        </div>
      </div>

      {/* AI advisor skeleton */}
      <Skeleton className="h-24 w-full rounded-xl" />

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/60 bg-card/60 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-4 rounded" />
            </div>
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-7 items-start">
        <div className="lg:col-span-4 rounded-xl border border-border/60 bg-card/40 p-5 space-y-3">
          <Skeleton className="h-4 w-32 mb-2" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-lg border border-border/40">
              <Skeleton className="h-8 w-8 rounded-md shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
            </div>
          ))}
        </div>
        <div className="lg:col-span-3 flex flex-col gap-5">
          <Skeleton className="h-28 w-full rounded-xl" />
          <div className="rounded-xl border border-border/60 p-4 space-y-3">
            <Skeleton className="h-4 w-36 mb-1" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
