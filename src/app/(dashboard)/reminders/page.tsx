"use client"

import React, { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Plus, 
  Calendar as CalendarIcon, 
  List as ListIcon, 
  CheckCircle2, 
  Circle, 
  Trash2, 
  Clock, 
  Edit3, 
  AlertTriangle, 
  Bell, 
  BellOff, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  Award,
  BookOpen
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogTrigger, 
  DialogTitle, 
  DialogDescription, 
  DialogHeader, 
  DialogFooter 
} from "@/components/ui/dialog";
import { 
  getReminders, 
  getSubjects, 
  toggleReminder, 
  addReminder, 
  updateReminder, 
  deleteReminder 
} from "./actions";

interface Subject {
  id: string;
  name: string;
  color: string;
}

interface Reminder {
  id: string;
  title: string;
  due_date: string;
  reminder_type: 'assignment' | 'exam' | 'quiz' | 'presentation' | 'generic';
  priority: 'low' | 'medium' | 'high';
  completed_status: boolean;
  description?: string;
  subject_id?: string | null;
  subjects?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');
  
  // Dialog Open States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  
  // Notification Permission State
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission === "granted";
    }
    return false;
  });

  // Form State (Add / Edit)
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [type, setType] = useState<'assignment' | 'exam' | 'quiz' | 'presentation' | 'generic'>("assignment");
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>("medium");
  const [subjectId, setSubjectId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Calendar Date State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(new Date());

  const requestNotificationPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === "granted");
  };

  const fetchAllData = useCallback(async () => {
    try {
      const [remindersData, subjectsData] = await Promise.all([
        getReminders(),
        getSubjects()
      ]);
      setReminders(remindersData as Reminder[]);
      setSubjects(subjectsData as Subject[]);
    } catch (err) {
      console.error("Failed to load reminders data:", err);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAllData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchAllData]);

  // Push notifications checker
  useEffect(() => {
    if (notificationsEnabled && reminders.length > 0) {
      const now = new Date();
      const targetTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
      
      reminders.forEach(r => {
        if (!r.completed_status) {
          const dueDate = new Date(r.due_date);
          if (dueDate > now && dueDate <= targetTime) {
            const storageKey = `notified_${r.id}`;
            if (!localStorage.getItem(storageKey)) {
              new Notification(`Upcoming Deadline: ${r.title}`, {
                body: `Due: ${dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Priority: ${r.priority.toUpperCase()}. Course: ${r.subjects?.name || 'General Study'}`,
                icon: '/favicon.ico'
              });
              localStorage.setItem(storageKey, 'true');
            }
          }
        }
      });
    }
  }, [reminders, notificationsEnabled]);

  // Actions
  const handleToggle = async (id: string, currentStatus: boolean) => {
    setReminders(prev =>
      prev.map(r => r.id === id ? { ...r, completed_status: !currentStatus } : r)
    );
    try {
      await toggleReminder(id, currentStatus);
    } catch (err) {
      console.error("Failed to toggle reminder:", err);
      fetchAllData();
    }
  };

  const handleDelete = async (id: string) => {
    setReminders(prev => prev.filter(r => r.id !== id));
    try {
      await deleteReminder(id);
    } catch (err) {
      console.error("Failed to delete reminder:", err);
      fetchAllData();
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) return;

    setLoading(true);
    try {
      await addReminder(
        title, 
        dueDate, 
        type, 
        priority, 
        subjectId || null, 
        description || undefined
      );
      setIsAddOpen(false);
      resetForm();
      fetchAllData();
    } catch (err) {
      console.error("Failed to add reminder:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (reminder: Reminder) => {
    setSelectedReminder(reminder);
    setTitle(reminder.title);
    setDescription(reminder.description || "");
    setDueDate(formatForInput(reminder.due_date));
    setType(reminder.reminder_type);
    setPriority(reminder.priority);
    setSubjectId(reminder.subject_id || "");
    setIsEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReminder || !title.trim() || !dueDate) return;

    setLoading(true);
    try {
      await updateReminder(selectedReminder.id, {
        title,
        description: description || "",
        due_date: dueDate,
        reminder_type: type,
        priority,
        subject_id: subjectId || null
      });
      setIsEditOpen(false);
      resetForm();
      fetchAllData();
    } catch (err) {
      console.error("Failed to update reminder:", err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedReminder(null);
    setTitle("");
    setDescription("");
    setDueDate("");
    setType("assignment");
    setPriority("medium");
    setSubjectId("");
  };

  // Helper formats
  const formatDeadline = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
      });
    } catch {
      return dateStr;
    }
  };

  const formatForInput = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const pad = (n: number) => String(n).padStart(2, '0');
      const year = d.getFullYear();
      const month = pad(d.getMonth() + 1);
      const day = pad(d.getDate());
      const hours = pad(d.getHours());
      const minutes = pad(d.getMinutes());
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch {
      return "";
    }
  };

  const isOverdue = (dateStr: string, completed: boolean) => {
    if (completed) return false;
    return new Date(dateStr) < new Date();
  };

  // Stats
  const completedCount = reminders.filter(r => r.completed_status).length;
  const totalCount = reminders.length;
  const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const overdueCount = reminders.filter(r => isOverdue(r.due_date, r.completed_status)).length;

  // Calendar Helpers
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  // Calendar cell builder
  const daysInMonth = getDaysInMonth(currentDate);
  const firstDayIndex = getFirstDayOfMonth(currentDate);
  
  const prevMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
  const prevMonthDays = prevMonthDate.getDate();

  const calendarGrid = [];

  // Previous month dates
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    const cellDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, day);
    calendarGrid.push({ day, currentMonth: false, date: cellDate });
  }

  // Current month dates
  for (let day = 1; day <= daysInMonth; day++) {
    const cellDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    calendarGrid.push({ day, currentMonth: true, date: cellDate });
  }

  // Next month dates
  const remainingCells = 42 - calendarGrid.length;
  for (let day = 1; day <= remainingCells; day++) {
    const cellDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, day);
    calendarGrid.push({ day, currentMonth: false, date: cellDate });
  }

  // Get reminders due on a specific cell date
  const getRemindersOnDate = (date: Date) => {
    return reminders.filter(r => {
      const d = new Date(r.due_date);
      return d.getFullYear() === date.getFullYear() &&
             d.getMonth() === date.getMonth() &&
             d.getDate() === date.getDate();
    });
  };

  // Currently viewed list of reminders for selected calendar date
  const selectedDateReminders = selectedCalendarDate 
    ? getRemindersOnDate(selectedCalendarDate) 
    : [];

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto px-4 md:px-0 animate-in fade-in duration-300">
      
      {/* Productivity Stats Header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Welcome and Toggle */}
        <div className="md:col-span-2 flex flex-col justify-between p-6 rounded-2xl border border-border/60 bg-card/35 backdrop-blur-xs shadow-2xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/8 transition-all duration-500"></div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground bg-gradient-to-r from-foreground via-foreground to-foreground/75 bg-clip-text">Reminders & Alarms</h1>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm leading-relaxed">Manage your academic life, detect AI syllabus schedules, and check quizzes or exams instantly.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-border/20">
            <div className="flex items-center rounded-lg p-1 bg-secondary/85 border border-border/60 shadow-3xs">
              <Button 
                variant={viewMode === 'calendar' ? 'default' : 'ghost'} 
                size="sm"
                className="rounded-md px-3 text-xs h-7 cursor-pointer transition-all"
                onClick={() => setViewMode('calendar')}
              >
                <CalendarIcon className="h-3.5 w-3.5 mr-1.5" /> Calendar Grid
              </Button>
              <Button 
                variant={viewMode === 'list' ? 'default' : 'ghost'} 
                size="sm"
                className="rounded-md px-3 text-xs h-7 cursor-pointer transition-all"
                onClick={() => setViewMode('list')}
              >
                <ListIcon className="h-3.5 w-3.5 mr-1.5" /> List View
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              className={`rounded-lg text-xs gap-1.5 h-8 border-border/80 hover:bg-card/85 transition-all text-muted-foreground hover:text-foreground cursor-pointer ${notificationsEnabled ? 'border-primary/20 bg-primary/5 text-primary hover:text-primary hover:bg-primary/10' : ''}`}
              onClick={requestNotificationPermission}
            >
              {notificationsEnabled ? (
                <>
                  <Bell className="h-3.5 w-3.5 text-primary animate-pulse" /> Push On
                </>
              ) : (
                <>
                  <BellOff className="h-3.5 w-3.5 text-muted-foreground" /> Push Notifications
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Progress Circular/Pill Widget */}
        <Card className="border border-border/60 bg-card/35 backdrop-blur-xs shadow-2xs flex flex-col justify-between rounded-2xl">
          <CardContent className="p-6 flex flex-col h-full justify-between gap-4">
            <div className="flex items-center justify-between select-none">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Study Progress</span>
              <Award className="h-4.5 w-4.5 text-primary animate-pulse" />
            </div>
            <div className="flex items-baseline gap-2 my-1">
              <span className="text-3xl font-bold tracking-tight text-foreground">{completionPercentage}%</span>
              <span className="text-[10px] text-muted-foreground font-medium">({completedCount}/{totalCount} tasks)</span>
            </div>
            <div className="w-full bg-secondary/80 rounded-full h-2 overflow-hidden border border-border/40">
              <div 
                className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${completionPercentage}%` }}
              ></div>
            </div>
          </CardContent>
        </Card>

        {/* Alarms Alerts Card */}
        <Card className={`border border-border/60 bg-card/35 backdrop-blur-xs shadow-2xs flex flex-col justify-between rounded-2xl transition-colors duration-300 ${overdueCount > 0 ? 'border-destructive/20 bg-destructive/5' : ''}`}>
          <CardContent className="p-6 flex flex-col h-full justify-between gap-4">
            <div className="flex items-center justify-between select-none">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Warnings</span>
              <AlertTriangle className={`h-4.5 w-4.5 ${overdueCount > 0 ? 'text-destructive animate-bounce' : 'text-muted-foreground/60'}`} />
            </div>
            <div className="flex items-baseline gap-2 my-1">
              <span className={`text-3xl font-bold tracking-tight ${overdueCount > 0 ? 'text-destructive' : 'text-foreground'}`}>
                {overdueCount}
              </span>
              <span className="text-[10px] text-muted-foreground font-medium">overdue items</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              {overdueCount > 0 
                ? "Immediate attention required! Check calendar highlighted dates." 
                : "All deadlines are perfectly on schedule."}
            </p>
          </CardContent>
        </Card>

      </div>

      {/* Main UI Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left/Middle Columns: Calendar Grid or Full List */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          
          {viewMode === 'calendar' ? (
            /* Month Calendar Grid */
            <Card className="border border-border/60 bg-card/35 backdrop-blur-xs shadow-2xs rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-border/20 pl-6 pr-6 pt-5">
                <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2 select-none">
                  <CalendarIcon className="h-4.5 w-4.5 text-primary" />
                  {currentDate.toLocaleString("en-US", { month: "long", year: "numeric" })}
                </CardTitle>
                <div className="flex items-center gap-1.5">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-8 w-8 rounded-lg border-border/80 text-muted-foreground hover:text-foreground cursor-pointer transition-all"
                    onClick={() => changeMonth(-1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 rounded-lg text-xs border-border/80 text-muted-foreground hover:text-foreground cursor-pointer transition-all px-3"
                    onClick={() => setCurrentDate(new Date())}
                  >
                    Today
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-8 w-8 rounded-lg border-border/80 text-muted-foreground hover:text-foreground cursor-pointer transition-all"
                    onClick={() => changeMonth(1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                
                {/* Weekdays Labels */}
                <div className="grid grid-cols-7 gap-1 text-center font-bold text-[9px] text-muted-foreground/80 tracking-widest pb-3 mb-3 border-b border-border/20 select-none">
                  <div>SUN</div>
                  <div>MON</div>
                  <div>TUE</div>
                  <div>WED</div>
                  <div>THU</div>
                  <div>FRI</div>
                  <div>SAT</div>
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-2">
                  {calendarGrid.map((cell, idx) => {
                    const isSelected = selectedCalendarDate && 
                      cell.date.getDate() === selectedCalendarDate.getDate() &&
                      cell.date.getMonth() === selectedCalendarDate.getMonth() &&
                      cell.date.getFullYear() === selectedCalendarDate.getFullYear();

                    const dateReminders = getRemindersOnDate(cell.date);

                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedCalendarDate(cell.date)}
                        className={`min-h-[72px] flex flex-col justify-between p-2.5 rounded-xl text-left border relative transition-all duration-300 group cursor-pointer ${
                          !cell.currentMonth 
                            ? 'bg-transparent text-muted-foreground/30 border-transparent opacity-30 pointer-events-none' 
                            : 'bg-secondary/40 border-border/40 hover:bg-secondary/80 hover:border-primary/20 shadow-2xs'
                        } ${
                          isSelected 
                            ? 'ring-2 ring-primary border-primary bg-primary/5' 
                            : ''
                        }`}
                      >
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          cell.date.toDateString() === new Date().toDateString()
                            ? 'bg-primary text-primary-foreground' 
                            : 'text-foreground/80'
                        }`}>
                          {cell.day}
                        </span>

                        {/* Reminders dots indicator */}
                        {dateReminders.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2.5 pl-0.5">
                            {dateReminders.slice(0, 3).map((r) => (
                              <span 
                                key={r.id} 
                                className={`w-1.5 h-1.5 rounded-full transition-transform group-hover:scale-125 ${
                                  r.completed_status 
                                    ? 'bg-emerald-500/35' 
                                    : r.reminder_type === 'exam' 
                                    ? 'bg-destructive animate-pulse'
                                    : r.reminder_type === 'quiz'
                                    ? 'bg-purple-500'
                                    : r.reminder_type === 'presentation'
                                    ? 'bg-amber-500'
                                    : r.reminder_type === 'assignment'
                                    ? 'bg-blue-500'
                                    : 'bg-zinc-500'
                                }`}
                                title={r.title}
                              />
                            ))}
                            {dateReminders.length > 3 && (
                              <span className="text-[8px] font-bold text-muted-foreground leading-none align-middle">
                                +{dateReminders.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Full List View of all active reminders */
            <Card className="border border-border/60 bg-card/35 backdrop-blur-xs shadow-2xs rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/20 pl-6 pr-6 pt-5">
                <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2 select-none">
                  All Reminders List
                </CardTitle>
                <div className="text-[10px] font-semibold text-muted-foreground bg-secondary/80 border border-border/40 px-2.5 py-1 rounded-md uppercase tracking-wider">
                  {reminders.length} Total Alarms
                </div>
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                <div className="space-y-2.5">
                  {reminders.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground flex flex-col items-center justify-center gap-2">
                      <Clock className="h-10 w-10 text-muted-foreground/30 animate-pulse" />
                      <p className="font-semibold text-sm">No reminders available.</p>
                      <p className="text-xs max-w-sm">Create standard study tasks manually or upload document files to automatically scan and generate due dates!</p>
                    </div>
                  ) : (
                    reminders.map((task) => (
                      <div 
                        key={task.id}
                        className={`flex items-center justify-between gap-4 p-4 rounded-xl border transition-all duration-300 ${
                          task.completed_status 
                            ? 'bg-secondary/20 border-border/20 opacity-45' 
                            : isOverdue(task.due_date, task.completed_status)
                            ? 'bg-destructive/5 border-destructive/20 hover:bg-destructive/10'
                            : 'bg-background/55 border-border/45 hover:bg-background hover:border-primary/10 hover:shadow-xs'
                        }`}
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <button 
                            onClick={() => handleToggle(task.id, task.completed_status)}
                            className="text-muted-foreground hover:text-primary transition-colors focus:outline-none shrink-0 cursor-pointer"
                          >
                            {task.completed_status ? (
                              <CheckCircle2 className="h-5 w-5 text-primary fill-primary/10" />
                            ) : (
                              <Circle className="h-5 w-5 hover:scale-105 transition-transform" />
                            )}
                          </button>
                          
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className={`font-semibold text-foreground text-xs leading-tight ${task.completed_status ? 'line-through text-muted-foreground' : ''}`}>
                                {task.title}
                              </p>
                              
                              {/* Overdue Badge */}
                              {isOverdue(task.due_date, task.completed_status) && (
                                <span className="bg-destructive/15 text-destructive text-[8px] font-bold px-2 py-0.5 rounded border border-destructive/20 animate-pulse flex items-center gap-0.5">
                                  <AlertTriangle className="h-2.5 w-2.5" /> OVERDUE
                                </span>
                              )}
                              
                              {/* Priority Badge */}
                              <span className={`text-[8px] font-bold px-1.5 py-0.25 rounded border uppercase tracking-wider ${
                                task.priority === 'high'
                                  ? 'bg-destructive/10 text-destructive border-destructive/15'
                                  : task.priority === 'medium'
                                  ? 'bg-primary/10 text-primary border-primary/15'
                                  : 'bg-muted/40 text-muted-foreground border-border/80'
                              }`}>
                                {task.priority}
                              </span>
                            </div>

                            {task.description && (
                              <p className="text-[11px] text-muted-foreground mt-1 max-w-md line-clamp-1">
                                {task.description}
                              </p>
                            )}

                            <div className="flex flex-wrap items-center text-[10px] text-muted-foreground gap-3 mt-2">
                              {/* Category pill */}
                              <span className={`px-2 py-0.5 rounded uppercase text-[8px] font-bold border ${
                                task.reminder_type === 'exam' 
                                  ? 'bg-red-500/10 text-red-400 border-red-500/15' 
                                  : task.reminder_type === 'quiz'
                                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/15'
                                  : task.reminder_type === 'presentation'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/15'
                                  : task.reminder_type === 'assignment'
                                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/15'
                                  : 'bg-muted/40 text-muted-foreground border-border/80'
                              }`}>
                                {task.reminder_type}
                              </span>

                              {/* Course/Subject name */}
                              {task.subjects && (
                                <span className="flex items-center gap-1 text-[9px] font-bold text-primary">
                                  <BookOpen className="h-3 w-3" />
                                  {task.subjects.name}
                                </span>
                              )}

                              <span className="flex items-center gap-1 font-medium text-[9px]">
                                <Clock className="h-3.5 w-3.5 shrink-0" />
                                {formatDeadline(task.due_date)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-secondary/80 rounded-lg cursor-pointer transition-all border border-transparent hover:border-border/30"
                            onClick={() => handleOpenEdit(task)}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer transition-all border border-transparent hover:border-destructive/20"
                            onClick={() => handleDelete(task.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}

        </div>

        {/* Right Column: Selected Day Due Section & Quick Add */}
        <div className="flex flex-col gap-6">

          {/* Selected Date Reminders Section */}
          {viewMode === 'calendar' && (
            <Card className="border border-border/60 bg-card/35 backdrop-blur-xs shadow-2xs rounded-2xl">
              <CardHeader className="pb-3 border-b border-border/20 pl-5 pr-5 pt-4">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center justify-between select-none">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-primary" />
                    Due on Selected Day
                  </span>
                  {selectedCalendarDate && (
                    <span className="text-[10px] font-semibold text-primary bg-primary/5 border border-primary/10 px-2 py-0.5 rounded-md uppercase tracking-wider">
                      {selectedCalendarDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 px-4 pb-4">
                <div className="space-y-2.5">
                  {selectedDateReminders.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground flex flex-col items-center justify-center gap-2">
                      <Check className="h-8 w-8 text-emerald-400 bg-emerald-400/10 rounded-full p-1.5 animate-pulse" />
                      <p className="font-semibold text-xs text-foreground">No tasks due today!</p>
                      <p className="text-[10px] leading-relaxed text-muted-foreground">Select another day in the month grid or add a task below.</p>
                    </div>
                  ) : (
                    selectedDateReminders.map(task => (
                      <div 
                        key={task.id} 
                        className={`p-3 rounded-xl border flex flex-col gap-2 transition-all duration-300 hover:bg-background/80 ${
                          task.completed_status 
                            ? 'bg-secondary/20 border-border/20 opacity-50' 
                            : isOverdue(task.due_date, task.completed_status)
                            ? 'bg-destructive/5 border-destructive/20'
                            : 'bg-background/55 border-border/45'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            <button 
                              onClick={() => handleToggle(task.id, task.completed_status)}
                              className="text-muted-foreground hover:text-primary transition-colors mt-0.5 focus:outline-none cursor-pointer"
                            >
                              {task.completed_status ? (
                                <CheckCircle2 className="h-5 w-5 text-primary fill-primary/10" />
                              ) : (
                                <Circle className="h-5 w-5 hover:scale-105" />
                              )}
                            </button>
                            <div>
                              <p className={`font-semibold text-xs leading-snug text-foreground ${task.completed_status ? 'line-through text-muted-foreground' : ''}`}>
                                {task.title}
                              </p>
                              {task.description && (
                                <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                                  {task.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-border/20 mt-1">
                          <span className={`text-[8px] font-bold px-1.5 py-0.25 rounded uppercase border ${
                            task.reminder_type === 'exam' 
                              ? 'bg-red-500/10 text-red-400 border border-red-500/15' 
                              : task.reminder_type === 'quiz'
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/15'
                              : task.reminder_type === 'presentation'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/15'
                              : task.reminder_type === 'assignment'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/15'
                              : 'bg-muted/40 text-muted-foreground border border-border/80'
                          }`}>
                            {task.reminder_type}
                          </span>

                          <span className={`text-[8px] font-bold px-1.5 py-0.25 rounded border uppercase ${
                            task.priority === 'high'
                              ? 'bg-destructive/10 text-destructive border-destructive/15'
                              : task.priority === 'medium'
                              ? 'bg-primary/10 text-primary border-primary/15'
                              : 'bg-muted/40 text-muted-foreground border-border/80'
                          }`}>
                            {task.priority}
                          </span>

                          {task.subjects && (
                            <span className="text-[8px] font-bold text-primary flex items-center gap-0.5 bg-primary/5 border border-primary/15 px-1.5 py-0.25 rounded-md">
                              {task.subjects.name}
                            </span>
                          )}

                          {isOverdue(task.due_date, task.completed_status) && (
                            <span className="text-[8px] font-bold text-destructive bg-destructive/10 border border-destructive/15 px-1.5 py-0.25 rounded-md animate-pulse">
                              OVERDUE
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1.5 border-t border-border/20 mt-1">
                          <span className="flex items-center gap-1 font-medium text-[9px]">
                            <Clock className="h-3 w-3 shrink-0" />
                            {new Date(task.due_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>

                          <div className="flex items-center gap-1 shrink-0 z-10">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 text-muted-foreground hover:text-primary rounded-md cursor-pointer transition-all border border-transparent hover:border-border/30"
                              onClick={() => handleOpenEdit(task)}
                            >
                              <Edit3 className="h-3 w-3" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 text-muted-foreground hover:text-destructive rounded-md cursor-pointer transition-all border border-transparent hover:border-destructive/20"
                              onClick={() => handleDelete(task.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Create CTA Card */}
          <Card className="border border-border/60 bg-card/35 backdrop-blur-xs shadow-2xs rounded-2xl">
            <CardHeader className="pb-3 border-b border-border/20 px-5 pt-4">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2 select-none">
                <Plus className="h-4 w-4 text-primary" /> Create New Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-4 pb-4">
              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger render={<Button className="w-full rounded-lg gap-2 font-medium shadow-sm transition-all h-8 text-xs cursor-pointer" />}>
                  <Plus className="h-4 w-4" /> Add Task Alarm
                </DialogTrigger>
                <DialogContent className="sm:max-w-md rounded-xl bg-card border border-border/60 shadow-2xl p-5">
                  <DialogHeader>
                    <DialogTitle className="text-sm font-semibold text-foreground uppercase tracking-wider">Schedule New Alarm</DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground mt-1">
                      Manually add study tasks, homework, quiz deadlines, or exams.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAdd} className="space-y-4 py-2 text-left">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Task Title</label>
                      <Input 
                        placeholder="e.g. DBMS Assignment 3" 
                        value={title} 
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        className="rounded-lg border-border/80 bg-secondary/35 text-xs font-semibold focus-visible:ring-primary focus-visible:bg-card transition-all"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Description / Instructions (Optional)</label>
                      <textarea
                        placeholder="Add additional context or criteria..." 
                        value={description} 
                        onChange={(e) => setDescription(e.target.value)}
                        className="flex min-h-[60px] w-full rounded-lg border border-border/80 bg-secondary/35 px-3 py-2 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary focus-visible:bg-card transition-all text-foreground"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Due Date & Time</label>
                        <Input 
                          type="datetime-local" 
                          value={dueDate} 
                          onChange={(e) => setDueDate(e.target.value)}
                          required
                          className="rounded-lg border-border/80 bg-secondary/35 text-xs focus-visible:ring-primary focus-visible:bg-card transition-all"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Course Subject</label>
                        <select 
                          className="flex h-9 w-full rounded-lg border border-border/80 bg-secondary/35 px-3 py-1 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary focus-visible:bg-card transition-all text-foreground cursor-pointer"
                          value={subjectId}
                          onChange={(e) => setSubjectId(e.target.value)}
                        >
                          <option value="">General Study</option>
                          {subjects.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Category</label>
                        <select 
                          className="flex h-9 w-full rounded-lg border border-border/80 bg-secondary/35 px-3 py-1 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary focus-visible:bg-card transition-all text-foreground cursor-pointer"
                          value={type}
                          onChange={(e) => setType(e.target.value as 'assignment' | 'exam' | 'quiz' | 'presentation' | 'generic')}
                        >
                          <option value="assignment">Assignment</option>
                          <option value="exam">Exam</option>
                          <option value="quiz">Quiz Date</option>
                          <option value="presentation">Presentation</option>
                          <option value="generic">General Task</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Priority</label>
                        <select 
                          className="flex h-9 w-full rounded-lg border border-border/80 bg-secondary/35 px-3 py-1 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary focus-visible:bg-card transition-all text-foreground cursor-pointer"
                          value={priority}
                          onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                        >
                          <option value="low">Low Priority</option>
                          <option value="medium">Medium Priority</option>
                          <option value="high">High Priority</option>
                        </select>
                      </div>
                    </div>

                    <DialogFooter className="pt-4 border-t border-border/20 flex gap-2 justify-end">
                      <Button type="button" variant="outline" className="rounded-lg text-xs h-8 cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={loading} className="rounded-lg text-xs h-8 cursor-pointer font-medium bg-primary text-primary-foreground hover:bg-primary/95 transition-all">
                        {loading ? "Scheduling..." : "Save Reminder"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

        </div>

      </div>

      {/* Edit Form Dialog Modal */}
      <Dialog open={isEditOpen} onOpenChange={(open) => {
        if (!open) {
          setIsEditOpen(false);
          resetForm();
        }
      }}>
        <DialogContent className="sm:max-w-md rounded-xl bg-card border border-border/60 shadow-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-foreground uppercase tracking-wider">Edit Reminder & Alarm</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Modify custom dates, categories, priorities, or subject mappings.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 py-2 text-left">
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Task Title</label>
              <Input 
                value={title} 
                onChange={(e) => setTitle(e.target.value)}
                required
                className="rounded-lg border-border/80 bg-secondary/35 text-xs font-semibold focus-visible:ring-primary focus-visible:bg-card transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Description (Optional)</label>
              <textarea
                value={description} 
                onChange={(e) => setDescription(e.target.value)}
                className="flex min-h-[60px] w-full rounded-lg border border-border/80 bg-secondary/35 px-3 py-2 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary focus-visible:bg-card transition-all text-foreground"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Due Date & Time</label>
                <Input 
                  type="datetime-local" 
                  value={dueDate} 
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                  className="rounded-lg border-border/80 bg-secondary/35 text-xs focus-visible:ring-primary focus-visible:bg-card transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Course Subject</label>
                <select 
                  className="flex h-9 w-full rounded-lg border border-border/80 bg-secondary/35 px-3 py-1 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary focus-visible:bg-card transition-all text-foreground cursor-pointer"
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                >
                  <option value="">General Study</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Category</label>
                <select 
                  className="flex h-9 w-full rounded-lg border border-border/80 bg-secondary/35 px-3 py-1 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary focus-visible:bg-card transition-all text-foreground cursor-pointer"
                  value={type}
                  onChange={(e) => setType(e.target.value as 'assignment' | 'exam' | 'quiz' | 'presentation' | 'generic')}
                >
                  <option value="assignment">Assignment</option>
                  <option value="exam">Exam</option>
                  <option value="quiz">Quiz Date</option>
                  <option value="presentation">Presentation</option>
                  <option value="generic">General Task</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Priority</label>
                <select 
                  className="flex h-9 w-full rounded-lg border border-border/80 bg-secondary/35 px-3 py-1 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary focus-visible:bg-card transition-all text-foreground cursor-pointer"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-border/20 flex gap-2 justify-end">
              <Button type="button" variant="outline" className="rounded-lg text-xs h-8 cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => setIsEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading} className="rounded-lg text-xs h-8 cursor-pointer font-medium bg-primary text-primary-foreground hover:bg-primary/95 transition-all">
                {loading ? "Saving Changes..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
