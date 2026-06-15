import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SettingsState {
  // Profile
  username: string;
  bio: string;
  department: string;
  semester: string;
  studentId: string;
  country: string;
  timezone: string;
  language: string;

  // Appearance
  theme: "light" | "dark" | "system" | "neuron-dark" | "midnight-blue" | "academic-gray" | "ocean-blue" | "professional-black";
  accentColor: "violet" | "amber" | "emerald" | "blue" | "rose";
  sidebarStyle: "glass" | "solid" | "compact";
  density: "compact" | "comfortable";
  fontSize: "small" | "medium" | "large";
  animations: "enabled" | "reduced" | "disabled";

  // Notifications
  assignmentDeadlines: boolean;
  quizDeadlines: boolean;
  studySessions: boolean;
  examAlerts: boolean;
  aiRecommendations: boolean;
  leaderboardUpdates: boolean;
  studyRoomInvites: boolean;
  uploadProcessing: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  inAppNotifications: boolean;
  notificationSound: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;

  // Learning Preferences
  learningStyle: "visual" | "reading" | "practice" | "conceptual" | "mixed";
  studyGoal: "pass" | "gpa" | "exam_prep" | "competitive" | "deep_understanding";
  studySessionDuration: "30" | "45" | "60" | "90" | "custom";
  customSessionDuration: number;
  weeklyStudyHours: number;
  targetCourses: string;
  prioritySubjects: string;

  // AI Preferences
  aiPersonality: "tutor" | "coach" | "professor" | "mentor" | "trainer";
  responseStyle: "short" | "balanced" | "detailed" | "very_detailed";
  explanationDifficulty: "beginner" | "intermediate" | "advanced" | "adaptive";
  autoSummary: boolean;
  autoFlashcards: boolean;
  autoQuiz: boolean;
  autoNotes: boolean;
  rememberProgress: boolean;
  rememberWeakTopics: boolean;
  rememberHabits: boolean;

  // Study Planner
  preferredStudyTime: "morning" | "afternoon" | "evening" | "night";
  maxDailyStudyHours: number;
  breakDuration: number;
  pomodoroFocus: number;
  pomodoroShortBreak: number;
  pomodoroLongBreak: number;
  examCountdown: boolean;
  calendarIntegration: boolean;
  autoPlanGeneration: boolean;
  adaptiveStudyPlans: boolean;

  // Files & Storage
  defaultView: "grid" | "list" | "details" | "compact";
  defaultSort: "name" | "date" | "subject" | "size";
  recycleBinRetention: number;
  autoCategorization: boolean;
  autoSubjectDetection: boolean;
  autoAiProcessing: boolean;
  backgroundProcessing: boolean;

  // Privacy & Security
  twoFactorAuth: boolean;
  profileVisibility: "public" | "friends" | "private";
  statsVisibility: "public" | "private";
  leaderboardVisibility: boolean;
  roomPrivacy: "public" | "invite_only" | "private";
  aiDataUsage: boolean;

  // Accessibility
  highContrast: boolean;
  largerText: boolean;
  keyboardNavigation: boolean;
  screenReader: boolean;
  reducedMotion: boolean;
  colorBlindMode: "none" | "protanopia" | "deuteranopia" | "tritanopia" | "monochromacy";
  focusIndicators: boolean;

  // Actions
  updateSetting: <K extends keyof Omit<SettingsState, "updateSetting" | "updateSettings" | "resetSection" | "resetAll" | "importSettings" | "setTheme" | "setLanguage">>(
    key: K,
    value: SettingsState[K]
  ) => void;
  updateSettings: (settings: Partial<Omit<SettingsState, "updateSetting" | "updateSettings" | "resetSection" | "resetAll" | "importSettings" | "setTheme" | "setLanguage">>) => void;
  resetSection: (section: string) => void;
  resetAll: () => void;
  importSettings: (jsonStr: string) => boolean;

  // Legacy Compatibility (so other code calling setTheme or setLanguage doesn't break)
  setTheme: (theme: "light" | "dark" | "system") => void;
  setLanguage: (lang: string) => void;
}

const DEFAULT_SETTINGS = {
  // Profile
  username: "scholar_student",
  bio: "Passionate learner studying engineering and neural systems at university.",
  department: "Computer Science",
  semester: "4th Semester",
  studentId: "NR-2026-991A",
  country: "United States",
  timezone: "UTC-8 (Pacific Standard Time)",
  language: "en",

  // Appearance
  theme: "neuron-dark" as const,
  accentColor: "violet" as const,
  sidebarStyle: "glass" as const,
  density: "comfortable" as const,
  fontSize: "medium" as const,
  animations: "enabled" as const,

  // Notifications
  assignmentDeadlines: true,
  quizDeadlines: true,
  studySessions: true,
  examAlerts: true,
  aiRecommendations: true,
  leaderboardUpdates: false,
  studyRoomInvites: true,
  uploadProcessing: true,
  emailNotifications: true,
  pushNotifications: true,
  inAppNotifications: true,
  notificationSound: true,
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",

  // Learning Preferences
  learningStyle: "mixed" as const,
  studyGoal: "deep_understanding" as const,
  studySessionDuration: "60" as const,
  customSessionDuration: 60,
  weeklyStudyHours: 15,
  targetCourses: "CS-101, MATH-202",
  prioritySubjects: "Data Structures, Linear Algebra",

  // AI Preferences
  aiPersonality: "tutor" as const,
  responseStyle: "balanced" as const,
  explanationDifficulty: "adaptive" as const,
  autoSummary: true,
  autoFlashcards: false,
  autoQuiz: false,
  autoNotes: true,
  rememberProgress: true,
  rememberWeakTopics: true,
  rememberHabits: true,

  // Study Planner
  preferredStudyTime: "evening" as const,
  maxDailyStudyHours: 6,
  breakDuration: 10,
  pomodoroFocus: 25,
  pomodoroShortBreak: 5,
  pomodoroLongBreak: 15,
  examCountdown: true,
  calendarIntegration: false,
  autoPlanGeneration: true,
  adaptiveStudyPlans: true,

  // Files & Storage
  defaultView: "details" as const,
  defaultSort: "date" as const,
  recycleBinRetention: 30,
  autoCategorization: true,
  autoSubjectDetection: true,
  autoAiProcessing: true,
  backgroundProcessing: true,

  // Privacy & Security
  twoFactorAuth: false,
  profileVisibility: "friends" as const,
  statsVisibility: "public" as const,
  leaderboardVisibility: true,
  roomPrivacy: "invite_only" as const,
  aiDataUsage: true,

  // Accessibility
  highContrast: false,
  largerText: false,
  keyboardNavigation: true,
  screenReader: false,
  reducedMotion: false,
  colorBlindMode: "none" as const,
  focusIndicators: true,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,

      updateSetting: (key, value) => {
        set({ [key]: value } as any);
      },

      updateSettings: (newSettings) => {
        set(newSettings as any);
      },

      // Legacy support
      setTheme: (theme) => {
        set({ theme: theme as any });
      },
      setLanguage: (language) => {
        set({ language });
      },

      resetSection: (section) => {
        const resetData: any = {};
        switch (section) {
          case "profile":
            resetData.username = DEFAULT_SETTINGS.username;
            resetData.bio = DEFAULT_SETTINGS.bio;
            resetData.department = DEFAULT_SETTINGS.department;
            resetData.semester = DEFAULT_SETTINGS.semester;
            resetData.studentId = DEFAULT_SETTINGS.studentId;
            resetData.country = DEFAULT_SETTINGS.country;
            resetData.timezone = DEFAULT_SETTINGS.timezone;
            resetData.language = DEFAULT_SETTINGS.language;
            break;
          case "appearance":
            resetData.theme = DEFAULT_SETTINGS.theme;
            resetData.accentColor = DEFAULT_SETTINGS.accentColor;
            resetData.sidebarStyle = DEFAULT_SETTINGS.sidebarStyle;
            resetData.density = DEFAULT_SETTINGS.density;
            resetData.fontSize = DEFAULT_SETTINGS.fontSize;
            resetData.animations = DEFAULT_SETTINGS.animations;
            break;
          case "notifications":
            resetData.assignmentDeadlines = DEFAULT_SETTINGS.assignmentDeadlines;
            resetData.quizDeadlines = DEFAULT_SETTINGS.quizDeadlines;
            resetData.studySessions = DEFAULT_SETTINGS.studySessions;
            resetData.examAlerts = DEFAULT_SETTINGS.examAlerts;
            resetData.aiRecommendations = DEFAULT_SETTINGS.aiRecommendations;
            resetData.leaderboardUpdates = DEFAULT_SETTINGS.leaderboardUpdates;
            resetData.studyRoomInvites = DEFAULT_SETTINGS.studyRoomInvites;
            resetData.uploadProcessing = DEFAULT_SETTINGS.uploadProcessing;
            resetData.emailNotifications = DEFAULT_SETTINGS.emailNotifications;
            resetData.pushNotifications = DEFAULT_SETTINGS.pushNotifications;
            resetData.inAppNotifications = DEFAULT_SETTINGS.inAppNotifications;
            resetData.notificationSound = DEFAULT_SETTINGS.notificationSound;
            resetData.quietHoursEnabled = DEFAULT_SETTINGS.quietHoursEnabled;
            resetData.quietHoursStart = DEFAULT_SETTINGS.quietHoursStart;
            resetData.quietHoursEnd = DEFAULT_SETTINGS.quietHoursEnd;
            break;
          case "learning":
            resetData.learningStyle = DEFAULT_SETTINGS.learningStyle;
            resetData.studyGoal = DEFAULT_SETTINGS.studyGoal;
            resetData.studySessionDuration = DEFAULT_SETTINGS.studySessionDuration;
            resetData.customSessionDuration = DEFAULT_SETTINGS.customSessionDuration;
            resetData.weeklyStudyHours = DEFAULT_SETTINGS.weeklyStudyHours;
            resetData.targetCourses = DEFAULT_SETTINGS.targetCourses;
            resetData.prioritySubjects = DEFAULT_SETTINGS.prioritySubjects;
            break;
          case "ai":
            resetData.aiPersonality = DEFAULT_SETTINGS.aiPersonality;
            resetData.responseStyle = DEFAULT_SETTINGS.responseStyle;
            resetData.explanationDifficulty = DEFAULT_SETTINGS.explanationDifficulty;
            resetData.autoSummary = DEFAULT_SETTINGS.autoSummary;
            resetData.autoFlashcards = DEFAULT_SETTINGS.autoFlashcards;
            resetData.autoQuiz = DEFAULT_SETTINGS.autoQuiz;
            resetData.autoNotes = DEFAULT_SETTINGS.autoNotes;
            resetData.rememberProgress = DEFAULT_SETTINGS.rememberProgress;
            resetData.rememberWeakTopics = DEFAULT_SETTINGS.rememberWeakTopics;
            resetData.rememberHabits = DEFAULT_SETTINGS.rememberHabits;
            break;
          case "planner":
            resetData.preferredStudyTime = DEFAULT_SETTINGS.preferredStudyTime;
            resetData.maxDailyStudyHours = DEFAULT_SETTINGS.maxDailyStudyHours;
            resetData.breakDuration = DEFAULT_SETTINGS.breakDuration;
            resetData.pomodoroFocus = DEFAULT_SETTINGS.pomodoroFocus;
            resetData.pomodoroShortBreak = DEFAULT_SETTINGS.pomodoroShortBreak;
            resetData.pomodoroLongBreak = DEFAULT_SETTINGS.pomodoroLongBreak;
            resetData.examCountdown = DEFAULT_SETTINGS.examCountdown;
            resetData.calendarIntegration = DEFAULT_SETTINGS.calendarIntegration;
            resetData.autoPlanGeneration = DEFAULT_SETTINGS.autoPlanGeneration;
            resetData.adaptiveStudyPlans = DEFAULT_SETTINGS.adaptiveStudyPlans;
            break;
          case "files":
            resetData.defaultView = DEFAULT_SETTINGS.defaultView;
            resetData.defaultSort = DEFAULT_SETTINGS.defaultSort;
            resetData.recycleBinRetention = DEFAULT_SETTINGS.recycleBinRetention;
            resetData.autoCategorization = DEFAULT_SETTINGS.autoCategorization;
            resetData.autoSubjectDetection = DEFAULT_SETTINGS.autoSubjectDetection;
            resetData.autoAiProcessing = DEFAULT_SETTINGS.autoAiProcessing;
            resetData.backgroundProcessing = DEFAULT_SETTINGS.backgroundProcessing;
            break;
          case "privacy":
            resetData.twoFactorAuth = DEFAULT_SETTINGS.twoFactorAuth;
            resetData.profileVisibility = DEFAULT_SETTINGS.profileVisibility;
            resetData.statsVisibility = DEFAULT_SETTINGS.statsVisibility;
            resetData.leaderboardVisibility = DEFAULT_SETTINGS.leaderboardVisibility;
            resetData.roomPrivacy = DEFAULT_SETTINGS.roomPrivacy;
            resetData.aiDataUsage = DEFAULT_SETTINGS.aiDataUsage;
            break;
          case "accessibility":
            resetData.highContrast = DEFAULT_SETTINGS.highContrast;
            resetData.largerText = DEFAULT_SETTINGS.largerText;
            resetData.keyboardNavigation = DEFAULT_SETTINGS.keyboardNavigation;
            resetData.screenReader = DEFAULT_SETTINGS.screenReader;
            resetData.reducedMotion = DEFAULT_SETTINGS.reducedMotion;
            resetData.colorBlindMode = DEFAULT_SETTINGS.colorBlindMode;
            resetData.focusIndicators = DEFAULT_SETTINGS.focusIndicators;
            break;
        }
        set(resetData);
      },

      resetAll: () => {
        set(DEFAULT_SETTINGS as any);
      },

      importSettings: (jsonStr) => {
        try {
          const imported = JSON.parse(jsonStr);
          if (imported && typeof imported === "object") {
            const validated: any = {};
            // Basic key presence verification for security
            for (const key of Object.keys(DEFAULT_SETTINGS)) {
              if (key in imported) {
                validated[key] = imported[key];
              }
            }
            set(validated);
            return true;
          }
        } catch (e) {
          console.error("Failed to parse settings import:", e);
        }
        return false;
      },
    }),
    {
      name: "neuron-settings-storage",
    }
  )
);
