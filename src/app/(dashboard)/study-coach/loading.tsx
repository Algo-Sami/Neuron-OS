import { Skeleton } from "@/components/ui/skeleton";

export default function StudyCoachLoading() {
  return (
    <div className="max-w-5xl mx-auto w-full pb-10 px-4 md:px-0">
      {/* Header */}
      <div className="flex flex-col gap-1.5 border-b border-border/40 pb-5 mb-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-3.5 w-96 mt-1" />
      </div>

      {/* Tabs list skeleton */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-secondary/40 border border-border/40 w-fit mb-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-lg" />
        ))}
      </div>

      {/* Main content area skeleton */}
      <div className="grid gap-5 grid-cols-1 md:grid-cols-3">
        {/* Left main area (e.g. self study cards or evaluation tools) */}
        <div className="md:col-span-2 space-y-4">
          <div className="p-6 rounded-2xl border border-border/60 bg-card/30 space-y-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-80" />
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 pt-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-4 rounded-xl border border-border/40 bg-background/50 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right sidebar area */}
        <div className="space-y-4">
          <div className="p-5 rounded-2xl border border-border/60 bg-card/30 space-y-4">
            <Skeleton className="h-4 w-32" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-3 rounded-lg border border-border/40 bg-background/50 flex justify-between items-center">
                  <div className="space-y-1.5 flex-1 mr-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-2.5 w-16" />
                  </div>
                  <Skeleton className="h-6 w-12 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
