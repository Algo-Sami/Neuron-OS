import { Skeleton } from "@/components/ui/skeleton";

export default function AssistantLoading() {
  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] px-4 md:px-0">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between shrink-0 border-b border-border/40 pb-3">
        <div className="space-y-1">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-3 w-80" />
        </div>
      </div>

      {/* 3-Column Workspace */}
      <div className="flex-1 flex gap-3 overflow-hidden min-h-0">
        {/* LEFT Sidebar: Chat History */}
        <div className="w-[150px] shrink-0 hidden lg:flex flex-col overflow-hidden border border-border/60 rounded-xl bg-card/30 p-2 space-y-3">
          <Skeleton className="h-8 w-full rounded-lg" />
          <div className="space-y-2 pt-2">
            <Skeleton className="h-3 w-16" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-full rounded-md" />
            ))}
          </div>
        </div>

        {/* CENTER: Chat Interface */}
        <div className="flex-1 flex flex-col overflow-hidden bg-card/30 border border-border/60 rounded-xl">
          {/* Chat Header */}
          <div className="px-4 py-2.5 border-b border-border/40 bg-card/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3.5 w-36" />
            </div>
            <Skeleton className="h-5 w-24 rounded" />
          </div>

          {/* Messages Skeletons */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex gap-3">
              <Skeleton className="h-7 w-7 rounded-lg shrink-0" />
              <div className="space-y-2 flex-1 max-w-[70%]">
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            </div>
            <div className="flex gap-3 flex-row-reverse">
              <Skeleton className="h-7 w-7 rounded-lg shrink-0" />
              <div className="space-y-2 flex-1 max-w-[50%]">
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-7 w-7 rounded-lg shrink-0" />
              <div className="space-y-2 flex-1 max-w-[65%]">
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
            </div>
          </div>

          {/* Chat Input */}
          <div className="p-3 border-t border-border/40 bg-card/10 flex gap-2">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-9 flex-1 rounded-lg" />
            <Skeleton className="h-9 w-9 rounded-lg" />
          </div>
        </div>

        {/* RIGHT Sidebar: Study Focus */}
        <div className="w-[150px] shrink-0 hidden lg:flex flex-col overflow-hidden border border-border/60 rounded-xl bg-card/30 p-2 space-y-3">
          <Skeleton className="h-4 w-20" />
          <div className="space-y-2 pt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 p-1">
                <Skeleton className="h-3 w-3 rounded" />
                <Skeleton className="h-3 w-20 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
