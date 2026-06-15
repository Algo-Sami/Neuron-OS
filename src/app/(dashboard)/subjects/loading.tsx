import { Skeleton } from "@/components/ui/skeleton";

export default function SubjectsLoading() {
  return (
    <div className="max-w-5xl mx-auto w-full pb-10 px-4 md:px-0">
      {/* Header */}
      <div className="flex flex-col gap-1.5 border-b border-border/40 pb-5 mb-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-3 w-80 mt-1" />
      </div>

      {/* Explorer toolbar skeleton */}
      <div className="flex flex-col flex-1 border border-border/80 bg-background rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-4 w-4 rounded mx-1" />
          <Skeleton className="h-4 w-20 rounded" />
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="h-7 w-36 rounded-lg" />
            <Skeleton className="h-7 w-7 rounded-lg" />
            <Skeleton className="h-7 w-7 rounded-lg" />
            <Skeleton className="h-7 w-7 rounded-lg" />
          </div>
        </div>

        {/* File grid skeleton */}
        <div className="p-4 grid gap-2.5 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl border border-border/40 bg-card/25 flex items-center gap-3 px-3 animate-pulse">
              <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-2.5 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
