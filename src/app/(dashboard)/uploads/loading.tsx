import { Skeleton } from "@/components/ui/skeleton";

export default function UploadsLoading() {
  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full pb-10">
      {/* Page header skeleton */}
      <div className="flex flex-col gap-1.5 border-b border-border/40 pb-5">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-3 w-64 mt-0.5" />
      </div>

      {/* Upload Area card skeleton */}
      <div className="rounded-2xl border border-border/60 bg-card/50 overflow-hidden">
        {/* Card header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border/40">
          <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-72" />
          </div>
        </div>
        {/* Drop zone area */}
        <div className="p-6">
          <Skeleton className="h-44 w-full rounded-xl" />
          <div className="flex items-center gap-4 mt-5 pt-4 border-t border-border/30">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
      </div>

      {/* Section divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 border-t border-border/30" />
        <Skeleton className="h-3 w-24 rounded-full" />
        <div className="flex-1 border-t border-border/30" />
      </div>

      {/* History table skeleton */}
      <div className="flex flex-col gap-4">
        {/* History header + search */}
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-8 w-48 rounded-lg" />
        </div>

        {/* Filter tab pills */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-14 rounded-lg shrink-0" />
          ))}
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border/60 bg-card/50 overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-7 gap-4 px-4 py-3 border-b border-border/40 bg-secondary/30">
            {["File Name", "Subject", "Type", "Size", "Date", "Status", ""].map(
              (col) => (
                <Skeleton key={col} className="h-3 w-full" />
              )
            )}
          </div>
          {/* Table rows */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-3.5 border-b border-border/20 last:border-0"
            >
              <Skeleton className="h-7 w-7 rounded-md shrink-0" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3 w-24 hidden md:block" />
              <Skeleton className="h-5 w-10 rounded-md hidden md:block" />
              <Skeleton className="h-3 w-14 hidden md:block" />
              <Skeleton className="h-3 w-20 hidden md:block" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-6 w-6 rounded-md ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
