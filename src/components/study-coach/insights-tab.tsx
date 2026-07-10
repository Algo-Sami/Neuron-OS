"use client";

import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  Flame, 
  RotateCw, 
  AlertTriangle,
  Lightbulb,
  Heart
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { getProductivityInsightsAction } from "@/actions/study-coach";

interface ProductivityInsights {
  motivationMessage: string;
  burnoutRisk: string;
  recommendedFocusInterval: string;
  smartBreakSuggestions: string[];
}

export function InsightsTab() {
  const [insights, setInsights] = useState<ProductivityInsights | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  async function loadInsights(showLoading = false) {
    if (showLoading) {
      setIsLoading(true);
    }
    try {
      const res = await getProductivityInsightsAction();
      if (res.success && res.insights) {
        setInsights(res.insights as unknown as ProductivityInsights);
      }
    } catch {
      // no-op
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadInsights();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await getProductivityInsightsAction();
      if (res.success && res.insights) {
        setInsights(res.insights as unknown as ProductivityInsights);
        alert("Productivity coaching insights updated!");
      }
    } catch {
      // no-op
    }
    setIsRefreshing(false);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground font-semibold">AI Coach is evaluating your weekly study habits...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in slide-in-from-bottom duration-300">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex gap-1.5 items-center">
            <Sparkles className="h-5 w-5 text-amber-500 animate-pulse" />
            AI Coach Motivation & Productivity Insights
          </h2>
          <p className="text-muted-foreground text-xs font-semibold mt-0.5">
            Personalized cognitive pacing, burnout analysis, and daily affirmations.
          </p>
        </div>

        <Button
          onClick={handleRefresh}
          disabled={isRefreshing}
          variant="outline"
          size="sm"
          className="rounded-xl flex gap-1 items-center font-bold"
        >
          {isRefreshing ? (
            <>
              <RotateCw className="h-3.5 w-3.5 animate-spin" />
              Recalculating...
            </>
          ) : (
            <>
              <RotateCw className="h-3.5 w-3.5" />
              Refresh Insights
            </>
          )}
        </Button>
      </div>

      {insights ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Motivation Quote Banner */}
          <div className="lg:col-span-12 p-6 rounded-3xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 shadow-inner flex gap-4 items-start">
            <div className="p-3 bg-primary/20 text-primary rounded-2xl shrink-0 animate-pulse">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-primary tracking-wider">AI Coach Positive Reinforcement</span>
              <p className="text-sm font-bold leading-relaxed text-foreground italic">
                &quot;{insights.motivationMessage}&quot;
              </p>
            </div>
          </div>

          {/* Left panel: stats & dials */}
          <div className="lg:col-span-5 grid grid-cols-1 gap-6">
            
            {/* Burnout Risk Card */}
            <Card className="rounded-3xl border-border/40 bg-card/60 shadow-sm p-5 flex flex-col items-center text-center justify-between min-h-[220px]">
              <div className="w-full text-left">
                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider flex gap-1 items-center">
                  <Heart className="h-3.5 w-3.5 text-red-400" />
                  Burnout Risk Rating
                </span>
              </div>

              <div className="my-4 space-y-1">
                <span className={`text-2xl font-black uppercase tracking-wider ${
                  insights.burnoutRisk === "High" 
                    ? "text-red-500" 
                    : insights.burnoutRisk === "Moderate" 
                      ? "text-orange-500" 
                      : "text-emerald-500"
                }`}>
                  {insights.burnoutRisk} Risk
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed px-4">
                  Assessment based on spacing intervals between study sessions.
                </p>
              </div>

              <div className={`w-full py-2.5 rounded-xl border text-xs font-bold ${
                insights.burnoutRisk === "High"
                  ? "bg-red-500/10 border-red-500/20 text-red-500 animate-pulse"
                  : insights.burnoutRisk === "Moderate"
                    ? "bg-orange-500/10 border-orange-500/20 text-orange-500"
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
              }`}>
                {insights.burnoutRisk === "High" 
                  ? "🚨 STOP Cramming. Take a mandatory 1-hour active offline break!" 
                  : "✓ Learning intervals are healthy. Spacing is maintained."}
              </div>
            </Card>

            {/* Pomodoro Settings */}
            <Card className="rounded-3xl border-border/40 bg-card/60 shadow-sm p-5 flex flex-col items-center text-center justify-between min-h-[200px]">
              <div className="w-full text-left">
                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider flex gap-1 items-center">
                  <Flame className="h-3.5 w-3.5 text-orange-400" />
                  Prescribed Pomodoro Focus Intervals
                </span>
              </div>

              <div className="my-4">
                <span className="text-2xl font-black tracking-tight text-primary">
                  {insights.recommendedFocusInterval}
                </span>
                <p className="text-[10px] text-muted-foreground font-semibold mt-1">
                  Custom intervals aligned with sleep metrics & goal structures.
                </p>
              </div>

              <div className="text-[11px] text-muted-foreground leading-relaxed">
                Utilize these timing profiles inside Neuron Focus timer loops to achieve optimal memory consolidation.
              </div>
            </Card>

          </div>

          {/* Right panel: Break Suggestions */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* Scientific Breaks */}
            <Card className="rounded-2xl border-border/40 shadow-sm bg-card/60">
              <CardHeader className="pb-3 border-b border-border/30">
                <CardTitle className="text-sm font-bold flex gap-1.5 items-center">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  AI Recommended Sensory Spacing Breaks
                </CardTitle>
                <p className="text-xs text-muted-foreground font-semibold">Scientifically proven spacing checks to restore cognitive capacity</p>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {insights.smartBreakSuggestions?.map((breakTip: string, idx: number) => (
                  <div 
                    key={idx}
                    className="flex gap-3 p-3.5 rounded-xl border border-border/30 bg-muted/20 items-start leading-relaxed shadow-sm transition-transform hover:scale-[1.01]"
                  >
                    <span className="text-primary font-black text-sm">{idx + 1}.</span>
                    <p className="text-xs font-semibold text-foreground/90 leading-relaxed">
                      {breakTip}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

          </div>

        </div>
      ) : (
        <div className="max-w-md mx-auto w-full text-center py-10 space-y-4 animate-in zoom-in duration-300">
          <AlertTriangle className="h-10 w-10 text-orange-500 mx-auto" />
          <h3 className="text-lg font-bold tracking-tight">No Insights Logged</h3>
          <p className="text-muted-foreground text-xs font-semibold leading-relaxed">
            Please log some study time and solve interactive tests. The AI Coach will compile habits spacing and burnout limits in background diagnostics!
          </p>
        </div>
      )}

    </div>
  );
}
