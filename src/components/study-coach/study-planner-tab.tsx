"use client";

import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  Calendar, 
  Clock, 
  CheckSquare, 
  AlertCircle,
  RotateCw,
  Plus,
  Trash2,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { saveStudyPlanAction, getStudyPlanAction } from "@/actions/study-coach";

interface StudyTask {
  activity: string;
  subject: string;
  durationMinutes: number;
  time: string;
  type: string;
}

interface DailyPlan {
  day: string;
  tasks: StudyTask[];
  productivityTip: string;
}

interface WeeklySchedule {
  weekGoal: string;
  dailyPlans: DailyPlan[];
}

interface StudyPlanData {
  weeklySchedule: WeeklySchedule;
  revisionStrategy: string[];
  breakRecommendations: string[];
}

interface StudyPlannerTabProps {
  subjects: { id: string; name: string; code: string; color: string }[];
}

export function StudyPlannerTab({ subjects }: StudyPlannerTabProps) {
  const [activePlan, setActivePlan] = useState<StudyPlanData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [activeDay, setActiveDay] = useState<string>("Monday");

  // Preference wizard fields
  const [hoursPerDay, setHoursPerDay] = useState<number>(3);
  const [sleepSchedule, setSleepSchedule] = useState<string>("11:00 PM - 07:00 AM");
  const [moodLevel, setMoodLevel] = useState<string>("Calm");
  const [prepLevel, setPrepLevel] = useState<string>("beginner");
  const [learningStyle, setLearningStyle] = useState<string>("visual");
  const [academicGoals, setAcademicGoals] = useState<string>("Excel in my upcoming finals and improve weak subjects");
  
  // Dynamic lists
  const [examDates, setExamDates] = useState<{ subject: string; date: string }[]>([]);
  const [weakSubjects, setWeakSubjects] = useState<string[]>([]);
  const [backlogSubjects, setBacklogSubjects] = useState<string[]>([]);

  // Load existing plan on mount
  useEffect(() => {
    async function loadPlan() {
      setIsLoading(true);
      try {
        const res = await getStudyPlanAction();
        if (res.success && res.plan) {
          setActivePlan(res.plan.plan_data as unknown as StudyPlanData);
          // Set initial active day
          const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
          const currentDayStr = days[new Date().getDay()];
          setActiveDay(currentDayStr);
        }
      } catch {
        // no-op
      }
      setIsLoading(false);
    }
    loadPlan();
  }, []);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      // Map examDates list to dictionary
      const examDatesDict: Record<string, string> = {};
      examDates.forEach(ed => {
        if (ed.subject && ed.date) examDatesDict[ed.subject] = ed.date;
      });

      const res = await saveStudyPlanAction({
        hoursPerDay,
        sleepSchedule,
        moodLevel,
        prepLevel,
        learningStyle,
        academicGoals,
        examDates: examDatesDict,
        weakSubjects,
        backlogSubjects,
      });

      if (res.success && res.planData) {
        setActivePlan(res.planData as unknown as StudyPlanData);
        alert("AI Study Plan generated! All focus blocks are successfully synchronized with your global reminders.");
      } else {
        alert(res.error || "Failed to generate plan.");
      }
    } catch {
      alert("Planner generation failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddExam = () => {
    setExamDates(prev => [...prev, { subject: "", date: "" }]);
  };

  const handleRemoveExam = (idx: number) => {
    setExamDates(prev => prev.filter((_, i) => i !== idx));
  };

  const handleToggleWeakSubject = (subName: string) => {
    setWeakSubjects(prev => 
      prev.includes(subName) ? prev.filter(s => s !== subName) : [...prev, subName]
    );
  };

  const handleToggleBacklog = (subName: string) => {
    setBacklogSubjects(prev => 
      prev.includes(subName) ? prev.filter(s => s !== subName) : [...prev, subName]
    );
  };

  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground font-semibold">Loading AI Study planner details...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in slide-in-from-bottom duration-300">
      
      {activePlan ? (
        /* Plan viewer screen */
        <div className="space-y-6">
          
          {/* Synchronized alert */}
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 shadow-inner">
            <Check className="h-5 w-5 stroke-[3] shrink-0" />
            <div className="text-xs">
              <span className="font-bold">Reminders Synchronized!</span> All study sessions in this calendar are active globally across Neuron OS. You will receive standard reminder alerts.
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground flex gap-1.5 items-center">
                <Calendar className="h-5 w-5 text-primary" />
                Active Weekly Study Plan
              </h2>
              <p className="text-muted-foreground text-xs font-semibold mt-0.5">
                Week Goal: {activePlan.weeklySchedule?.weekGoal}
              </p>
            </div>
            
            <Button
              onClick={() => setActivePlan(null)}
              variant="outline"
              size="sm"
              className="rounded-xl flex gap-1 items-center font-bold"
            >
              Reconfigure Planner
            </Button>
          </div>

          {/* 7-Day Horizontal Selector */}
          <div className="flex gap-2 pb-2 overflow-x-auto border-b border-border/20">
            {daysOfWeek.map(day => (
              <button
                key={day}
                onClick={() => setActiveDay(day)}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  activeDay === day
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {day}
              </button>
            ))}
          </div>

          {/* Selected Day Checklist */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* List of Tasks */}
            <div className="lg:col-span-8 space-y-4">
              <Card className="rounded-2xl border-border/40 shadow-sm bg-card/60">
                <CardHeader className="py-4 border-b border-border/30">
                  <CardTitle className="text-sm font-bold flex gap-1.5 items-center">
                    <CheckSquare className="h-4 w-4 text-primary" />
                    Schedules for {activeDay}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  {activePlan.weeklySchedule?.dailyPlans?.find((p: DailyPlan) => p.day.toLowerCase() === activeDay.toLowerCase())?.tasks.map((task: StudyTask, idx: number) => (
                    <div 
                      key={idx} 
                      className={`flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border leading-relaxed shadow-sm gap-2 transition-transform hover:scale-[1.01] ${
                        task.type === "focus" 
                          ? "bg-purple-500/[0.02] border-purple-500/20" 
                          : task.type === "revision" 
                            ? "bg-emerald-500/[0.02] border-emerald-500/20" 
                            : task.type === "quiz" 
                              ? "bg-blue-500/[0.02] border-blue-500/20" 
                              : "bg-muted/30 border-border/30"
                      }`}
                    >
                      <div className="flex gap-3 items-center">
                        <div className={`p-2 rounded-lg ${
                          task.type === "focus" 
                            ? "bg-purple-500/10 text-purple-400" 
                            : task.type === "revision" 
                              ? "bg-emerald-500/10 text-emerald-400" 
                              : task.type === "quiz" 
                                ? "bg-blue-500/10 text-blue-400" 
                                : "bg-muted text-muted-foreground"
                        }`}>
                          <Clock className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-foreground">
                            {task.activity}
                          </h4>
                          <span className="text-[10px] text-muted-foreground font-semibold">
                            Subject: {task.subject} • Duration: {task.durationMinutes}m
                          </span>
                        </div>
                      </div>
                      
                      <span className="text-xs font-bold text-muted-foreground md:text-right shrink-0 bg-card px-2.5 py-1 rounded-lg border border-border/30">
                        {task.time}
                      </span>
                    </div>
                  ))}

                  {/* Daily Tip */}
                  <div className="p-4 bg-muted/40 rounded-xl border border-border/20 text-xs mt-4">
                    <span className="font-bold text-foreground">💡 Daily Productivity Tip:</span>{" "}
                    {activePlan.weeklySchedule?.dailyPlans?.find((p: DailyPlan) => p.day.toLowerCase() === activeDay.toLowerCase())?.productivityTip}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Side Strategy details */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              {/* Revision tips */}
              <Card className="rounded-2xl border-border/40 shadow-sm bg-card/60">
                <CardHeader className="pb-3 border-b border-border/30">
                  <CardTitle className="text-xs font-black uppercase tracking-wider flex gap-1.5 items-center">
                    <Sparkles className="h-4 w-4 text-indigo-400" />
                    AI Revision Strategies
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-2">
                  {activePlan.revisionStrategy?.map((strat: string, idx: number) => (
                    <div key={idx} className="text-xs leading-relaxed text-foreground/90 flex gap-2 items-start">
                      <span className="text-primary font-bold">•</span>
                      {strat}
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Stress break suggestions */}
              <Card className="rounded-2xl border-border/40 shadow-sm bg-card/60">
                <CardHeader className="pb-3 border-b border-border/30">
                  <CardTitle className="text-xs font-black uppercase tracking-wider flex gap-1.5 items-center">
                    <AlertCircle className="h-4 w-4 text-emerald-500" />
                    Break Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-2">
                  {activePlan.breakRecommendations?.map((rec: string, idx: number) => (
                    <div key={idx} className="text-xs leading-relaxed text-foreground/90 flex gap-2 items-start">
                      <span className="text-emerald-500 font-bold">•</span>
                      {rec}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

          </div>

        </div>
      ) : (
        /* Configuration Form Screen */
        <div className="max-w-2xl mx-auto w-full py-4 space-y-6">
          <div className="text-center space-y-2 border-b border-border/30 pb-4">
            <Sparkles className="h-10 w-10 text-primary mx-auto animate-pulse" />
            <h3 className="text-2xl font-black tracking-tight bg-gradient-to-r from-primary to-indigo-400 bg-clip-text text-transparent">
              Generate AI Study Plan
            </h3>
            <p className="text-muted-foreground text-xs font-semibold leading-relaxed">
              Answer a few baseline parameters, and our AI Coach will structure the ultimate personalized weekly study calendar.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            
            {/* Hours per day */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Available Study Hours / Day</label>
              <input
                type="number"
                min={1}
                max={12}
                value={hoursPerDay}
                onChange={(e) => setHoursPerDay(parseInt(e.target.value) || 3)}
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm font-semibold focus:border-primary focus:outline-none"
              />
            </div>

            {/* Prep level */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Current Preparation Level</label>
              <div className="relative">
                <select
                  value={prepLevel}
                  onChange={(e) => setPrepLevel(e.target.value)}
                  className="w-full h-10 px-3 pr-8 rounded-xl border border-border bg-background text-sm font-semibold focus:border-primary focus:outline-none appearance-none cursor-pointer"
                >
                  <option value="beginner">Beginner (Reviewing definitions)</option>
                  <option value="intermediate">Intermediate (Understand core concepts)</option>
                  <option value="advanced">Advanced (Exam mock practice ready)</option>
                </select>
                <div className="absolute right-3 top-3.5 pointer-events-none w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-muted-foreground" />
              </div>
            </div>

            {/* Learning Style */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Preferred Learning Style</label>
              <div className="relative">
                <select
                  value={learningStyle}
                  onChange={(e) => setLearningStyle(e.target.value)}
                  className="w-full h-10 px-3 pr-8 rounded-xl border border-border bg-background text-sm font-semibold focus:border-primary focus:outline-none appearance-none cursor-pointer"
                >
                  <option value="visual">Visual (Mind maps, charts)</option>
                  <option value="auditory">Auditory (Viva conversations)</option>
                  <option value="read_write">Read & Write (Written evaluation)</option>
                  <option value="kinesthetic">Kinesthetic (Active MCQ Quizzes)</option>
                </select>
                <div className="absolute right-3 top-3.5 pointer-events-none w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-muted-foreground" />
              </div>
            </div>

            {/* Sleep Schedule */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Sleep Schedule Intervals</label>
              <input
                type="text"
                value={sleepSchedule}
                onChange={(e) => setSleepSchedule(e.target.value)}
                placeholder="e.g. 11:00 PM - 07:00 AM"
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm font-semibold focus:border-primary focus:outline-none"
              />
            </div>

            {/* Stress level */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Stress / Mood Rating</label>
              <div className="relative">
                <select
                  value={moodLevel}
                  onChange={(e) => setMoodLevel(e.target.value)}
                  className="w-full h-10 px-3 pr-8 rounded-xl border border-border bg-background text-sm font-semibold focus:border-primary focus:outline-none appearance-none cursor-pointer"
                >
                  <option value="Calm">Calm & Focused</option>
                  <option value="Tired">Tired / Low energy</option>
                  <option value="Anxious">Anxious / Stressed about Exams</option>
                  <option value="Unmotivated">Unmotivated</option>
                </select>
                <div className="absolute right-3 top-3.5 pointer-events-none w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-muted-foreground" />
              </div>
            </div>

            {/* Academic goals */}
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Academic Goals & Ambitions</label>
              <input
                type="text"
                value={academicGoals}
                onChange={(e) => setAcademicGoals(e.target.value)}
                placeholder="e.g. Get an A in operating systems, master normalization"
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm font-semibold focus:border-primary focus:outline-none"
              />
            </div>

          </div>

          {/* Weak subjects checkboxes */}
          <div className="space-y-2 border-t border-border/20 pt-4">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">4. Select Weak Subjects (Prioritized in Plan)</label>
            <div className="flex flex-wrap gap-2">
              {subjects.map(sub => {
                const active = weakSubjects.includes(sub.name);
                return (
                  <button
                    key={sub.id}
                    onClick={() => handleToggleWeakSubject(sub.name)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      active
                        ? "bg-red-500/10 border-red-500 text-red-500"
                        : "border-border hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    {sub.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Backlog subjects */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">5. Select Backlog Courses</label>
            <div className="flex flex-wrap gap-2">
              {subjects.map(sub => {
                const active = backlogSubjects.includes(sub.name);
                return (
                  <button
                    key={sub.id}
                    onClick={() => handleToggleBacklog(sub.name)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      active
                        ? "bg-orange-500/10 border-orange-500 text-orange-500"
                        : "border-border hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    {sub.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Exam Dates Picker list */}
          <div className="space-y-3 border-t border-border/20 pt-4">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">6. Exam Dates Schedules</label>
              <Button 
                onClick={handleAddExam}
                variant="outline" 
                size="xs" 
                className="rounded-lg flex gap-1 font-bold items-center cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Exam Date
              </Button>
            </div>

            {examDates.length === 0 && (
              <p className="text-muted-foreground text-xs leading-relaxed italic bg-muted/20 p-4 rounded-2xl border border-border/10 text-center">
                No upcoming exams registered. Click above to map dates.
              </p>
            )}

            {examDates.map((ed, idx) => (
              <div key={idx} className="flex gap-2 items-center leading-relaxed">
                <div className="relative flex-1">
                  <select
                    value={ed.subject}
                    onChange={(e) => {
                      const next = [...examDates];
                      next[idx].subject = e.target.value;
                      setExamDates(next);
                    }}
                    className="w-full h-10 px-3 pr-8 rounded-xl border border-border bg-background text-xs font-semibold focus:border-primary focus:outline-none appearance-none cursor-pointer"
                  >
                    <option value="">-- Choose Subject --</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-3.5 pointer-events-none w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-muted-foreground" />
                </div>
                
                <input
                  type="date"
                  value={ed.date}
                  onChange={(e) => {
                    const next = [...examDates];
                    next[idx].date = e.target.value;
                    setExamDates(next);
                  }}
                  className="h-10 px-3 rounded-xl border border-border bg-background text-xs font-semibold focus:border-primary focus:outline-none flex-1"
                />

                <Button
                  onClick={() => handleRemoveExam(idx)}
                  variant="destructive"
                  size="icon-sm"
                  className="rounded-xl cursor-pointer shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            size="lg"
            className="w-full font-bold rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-95 transition-all mt-6 cursor-pointer"
          >
            {isGenerating ? (
              <>
                <RotateCw className="h-4 w-4 animate-spin shrink-0" />
                AI is compiling weekly focus blocks...
              </>
            ) : (
              <>
                Create Optimized AI Schedule
                <Sparkles className="h-4 w-4 shrink-0 fill-white/20" />
              </>
            )}
          </Button>
        </div>
      )}

    </div>
  );
}
