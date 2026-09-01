"use client";

import React, { useState, useEffect } from "react";
import { Clock, RefreshCw, AlertTriangle, ShieldCheck, Hourglass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AIRateLimitCardProps {
  cooldownUntil?: string | null;
  errorCategory?: string | null;
  errorMessage?: string | null;
  onRetry?: () => void | Promise<void>;
  isRetrying?: boolean;
  className?: string;
}

function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function AIRateLimitCard({
  cooldownUntil,
  errorCategory,
  errorMessage,
  onRetry,
  isRetrying = false,
  className,
}: AIRateLimitCardProps) {
  const isQuotaExhausted = errorCategory === "rate_limit_quota";

  // Calculate target timestamp
  const targetMs = cooldownUntil ? new Date(cooldownUntil).getTime() : 0;
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!targetMs || targetMs <= Date.now()) {
      return;
    }

    const interval = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= targetMs) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetMs]);

  const remainingMs = targetMs > 0 ? Math.max(0, targetMs - now) : 0;
  const isCooldownActive = remainingMs > 0;

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-all",
        isQuotaExhausted
          ? "border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20"
          : "border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
          {isCooldownActive ? (
            <Hourglass className="h-4 w-4 text-amber-600 dark:text-amber-400 animate-pulse" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              {isQuotaExhausted
                ? "AI Generation Temporarily Unavailable"
                : "AI Engine Temporarily Busy"}
            </h4>

            {isCooldownActive && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                <Clock className="h-3 w-3 shrink-0" />
                Retry available in {formatCountdown(remainingMs)}
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            {errorMessage ||
              (isQuotaExhausted
                ? "The AI provider has temporarily restricted new generation requests due to daily limits. Your uploaded files and existing study resources remain safe."
                : "We're temporarily receiving a high number of AI requests. Your file and progress are safe.")}
          </p>

          <div className="flex items-center justify-between gap-3 pt-2 border-t border-amber-500/15 flex-wrap">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span>All documents and notes preserved</span>
            </div>

            {onRetry && (
              <Button
                onClick={onRetry}
                disabled={isCooldownActive || isRetrying}
                size="sm"
                variant={isCooldownActive ? "outline" : "default"}
                className={cn(
                  "h-7 text-xs font-medium gap-1.5 transition-all",
                  isCooldownActive
                    ? "opacity-60 cursor-not-allowed border-amber-500/20 text-muted-foreground bg-transparent"
                    : "cursor-pointer bg-amber-600 hover:bg-amber-700 text-white"
                )}
              >
                <RefreshCw className={cn("h-3 w-3", isRetrying ? "animate-spin" : "")} />
                {isRetrying
                  ? "Retrying..."
                  : isCooldownActive
                  ? `Retry in ${formatCountdown(remainingMs)}`
                  : "Retry Generation"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
