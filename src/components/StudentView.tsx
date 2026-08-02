/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  CheckCircle, 
  MapPin, 
  Clock, 
  QrCode, 
  BookOpen, 
  Download, 
  ExternalLink, 
  Eye,
  Send, 
  Calendar, 
  FileCheck, 
  User as UserIcon, 
  LogOut, 
  Bell, 
  RefreshCw, 
  Plus, 
  Sun,
  Moon,
  Info,
  Copy,
  Trash2,
  Check,
  FileText,
  Star,
  Award,
  XCircle,
  AlertCircle,
  Lock,
  UserCheck,
  UploadCloud,
  AlertTriangle,
  Megaphone,
  Edit2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import StudentReportView from './StudentReportView';
import { 
  authService,
  sessionService, 
  attendanceService, 
  assignmentService, 
  summaryService, 
  notificationService, 
  storageService,
  attendanceTokenService,
  getSessionCalculatedState,
  isSupabaseConfigured,
  supabase,
  subscribeToDatabaseChanges,
  debounce,
  isStudentSpecificNotificationDeleted,
  absenceRequestService
} from '../supabase';
import Footer from './Footer';
import { 
  Session, 
  AttendanceRecord, 
  Assignment, 
  AssignmentSubmission, 
  SessionSummary, 
  Profile, 
  AppNotification,
  AttendanceToken,
  AbsenceRequest
} from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { StudentQRPresenter } from './QRManager';
import { getAssignmentStatus, getStudentAssignmentStatus } from '../utils/assignmentUtils';
import { getFeedbackWindowStatus } from '../utils/feedbackUtils';
import { formatReportDate, formatReportTime, formatReportDateTime } from '../utils/export';

const formatSessionEndTime = (timeStr?: string) => {
  if (!timeStr) return '';
  if (timeStr.toUpperCase().includes('AM') || timeStr.toUpperCase().includes('PM')) {
    return timeStr;
  }
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (!isNaN(hours) && !isNaN(minutes)) {
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 === 0 ? 12 : hours % 12;
      const displayHoursStr = String(displayHours).padStart(2, '0');
      const displayMinutesStr = String(minutes).padStart(2, '0');
      return `${displayHoursStr}:${displayMinutesStr} ${period}`;
    }
  }
  return timeStr;
};

interface CategoryInfo {
  icon: any;
  emoji: string;
  colorClass: string;
  dotColorClass: string;
  badgeBg: string;
  badgeText: string;
}

export function getFriendlyTimestamp(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return 'Unknown time';
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHrs = Math.floor(diffMin / 60);

  const isYesterday = () => {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return date.getDate() === yesterday.getDate() &&
           date.getMonth() === yesterday.getMonth() &&
           date.getFullYear() === yesterday.getFullYear();
  };

  if (diffSec < 0) {
    return formatFullDate(date);
  }

  if (diffSec < 60) {
    return 'Just now';
  } else if (diffMin < 60) {
    return diffMin === 1 ? '1 minute ago' : `${diffMin} minutes ago`;
  } else if (diffHrs < 24) {
    return diffHrs === 1 ? '1 hour ago' : `${diffHrs} hours ago`;
  } else if (isYesterday()) {
    return 'Yesterday';
  } else {
    return formatFullDate(date);
  }
}

function formatFullDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = date.getDate().toString().padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = (hours % 12 || 12).toString().padStart(2, '0');

  return `${day} ${month} ${year} • ${displayHours}:${minutes} ${ampm}`;
}

export function getNotificationCategoryInfo(title: string, message: string): CategoryInfo {
  const t = title.toLowerCase();
  const m = message.toLowerCase();

  if (t.includes('account approved') || t.includes('approved') && t.includes('account')) {
    return {
      icon: UserCheck,
      emoji: '🎉',
      colorClass: 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/20',
      dotColorClass: 'bg-emerald-500',
      badgeBg: 'bg-emerald-100 dark:bg-emerald-950/40',
      badgeText: 'text-emerald-700 dark:text-emerald-300'
    };
  }
  if (t.includes('assignment released') || t.includes('new assignment') || t.includes('assignment available')) {
    return {
      icon: BookOpen,
      emoji: '📚',
      colorClass: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
      dotColorClass: 'bg-cyan-500',
      badgeBg: 'bg-cyan-100 dark:bg-cyan-950/40',
      badgeText: 'text-cyan-700 dark:text-cyan-300'
    };
  }
  if (t.includes('session created') || t.includes('session scheduled') || t.includes('new session')) {
    return {
      icon: Calendar,
      emoji: '📅',
      colorClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
      dotColorClass: 'bg-indigo-500',
      badgeBg: 'bg-indigo-100 dark:bg-indigo-950/40',
      badgeText: 'text-indigo-700 dark:text-indigo-300'
    };
  }
  if (t.includes('attendance') || t.includes('check-in') || t.includes('attendance recorded')) {
    return {
      icon: CheckCircle,
      emoji: '✅',
      colorClass: 'bg-teal-500/10 text-teal-600 dark:text-teal-450 border-teal-500/20',
      dotColorClass: 'bg-teal-500',
      badgeBg: 'bg-teal-100 dark:bg-teal-950/40',
      badgeText: 'text-teal-700 dark:text-teal-300'
    };
  }
  if (t.includes('submitted') || t.includes('submission') && t.includes('success')) {
    return {
      icon: UploadCloud,
      emoji: '📤',
      colorClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
      dotColorClass: 'bg-purple-500',
      badgeBg: 'bg-purple-100 dark:bg-purple-950/40',
      badgeText: 'text-purple-700 dark:text-[#c084fc]'
    };
  }
  if (t.includes('reminder') || t.includes('due soon') && !t.includes('approaching')) {
    return {
      icon: Clock,
      emoji: '⏰',
      colorClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      dotColorClass: 'bg-amber-500',
      badgeBg: 'bg-amber-100 dark:bg-amber-950/40',
      badgeText: 'text-amber-700 dark:text-amber-300'
    };
  }
  if (t.includes('deadline') || t.includes('approaching') || t.includes('warning')) {
    return {
      icon: AlertTriangle,
      emoji: '⚠',
      colorClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-450 border-rose-500/20',
      dotColorClass: 'bg-rose-500',
      badgeBg: 'bg-rose-100 dark:bg-rose-950/40',
      badgeText: 'text-rose-700 dark:text-rose-300'
    };
  }
  if (t.includes('closed') || t.includes('locked')) {
    return {
      icon: XCircle,
      emoji: '❌',
      colorClass: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
      dotColorClass: 'bg-red-500',
      badgeBg: 'bg-red-100 dark:bg-red-950/40',
      badgeText: 'text-red-700 dark:text-red-300'
    };
  }
  if (t.includes('announcement') || t.includes('broadcast')) {
    return {
      icon: Megaphone,
      emoji: '📢',
      colorClass: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
      dotColorClass: 'bg-pink-500',
      badgeBg: 'bg-pink-100 dark:bg-pink-950/40',
      badgeText: 'text-pink-700 dark:text-pink-300'
    };
  }

  return {
    icon: Bell,
    emoji: '🔔',
    colorClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    dotColorClass: 'bg-blue-500',
    badgeBg: 'bg-blue-100 dark:bg-blue-950/40',
    badgeText: 'text-blue-700 dark:text-blue-300'
  };
}

const SkeletonLoader = () => (
  <div className="space-y-4 animate-pulse">
    {[1, 2, 3].map((n) => (
      <div key={n} className="glass-panel p-5 rounded-2xl border border-slate-900 bg-slate-950/20 space-y-3">
        <div className="flex justify-between items-center">
          <div className="h-4 bg-slate-800 rounded w-1/4" />
          <div className="h-4 bg-slate-800 rounded w-1/12" />
        </div>
        <div className="h-6 bg-slate-800 rounded w-1/2" />
        <div className="h-4 bg-slate-800 rounded w-3/4" />
      </div>
    ))}
  </div>
);

interface StudentViewProps {
  studentProfile: Profile;
  onLogout: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export default function StudentView({ studentProfile, onLogout, showToast, theme, toggleTheme }: StudentViewProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [metricsLoading, setMetricsLoading] = useState<boolean>(true);

  const handleSignOut = async () => {
    console.log('Sign Out clicked');
    if (isSigningOut) {
      console.log('[Auth Debug] StudentView logout already in progress');
      return;
    }
    setIsSigningOut(true);
    try {
      await onLogout();
    } catch (err) {
      console.error('[Auth Debug] Logout error in StudentView:', err);
    } finally {
      setIsSigningOut(false);
    }
  };

  // Guard clause for route protection - Block access if student is not Approved
  if (studentProfile.accountStatus !== 'Approved') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center font-sans p-4">
        <div className="glass-panel max-w-sm w-full p-6 text-center space-y-4 bg-slate-950 border border-slate-900 rounded-2xl">
          <p className="text-rose-400 font-bold font-display text-base">Access Denied</p>
          <p className="text-xs text-slate-400 font-sans leading-relaxed">You do not have permission to view this page. Approval status: {studentProfile.accountStatus || 'Pending'}</p>
          <button
            disabled={isSigningOut}
            onClick={handleSignOut}
            className="px-4 py-2 bg-slate-900 border border-slate-800 text-xs text-slate-350 hover:text-white rounded-xl font-sans cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 mx-auto"
          >
            {isSigningOut ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-rose-400" />
                <span>Signing Out...</span>
              </>
            ) : (
              <span>Logout</span>
            )}
          </button>
        </div>
      </div>
    );
  }
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [summaries, setSummaries] = useState<SessionSummary[]>([]);
  const [absenceRequests, setAbsenceRequests] = useState<AbsenceRequest[]>([]);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [isEditingFeedback, setIsEditingFeedback] = useState<boolean>(false);
  
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([]);
  const [allSummaries, setAllSummaries] = useState<SessionSummary[]>([]);
  const [sessionFeedbackCounts, setSessionFeedbackCounts] = useState<Record<string, number>>({});
  const [allStudentsCount, setAllStudentsCount] = useState<number>(60);

  const [activeReminderSession, setActiveReminderSession] = useState<Session | null>(null);
  const [reminderType, setReminderType] = useState<'upcoming' | 'started' | null>(null);

  // Periodic upcoming session reminders and start-time checking
  useEffect(() => {
    const checkSessions = () => {
      if (!sessions || sessions.length === 0) return;

      const now = new Date();
      const dismissedUpcomingKey = `student_dismissed_upcoming_${studentProfile.id}`;
      const dismissedStartedKey = `student_dismissed_started_${studentProfile.id}`;
      
      const dismissedUpcoming: string[] = JSON.parse(localStorage.getItem(dismissedUpcomingKey) || '[]');
      const dismissedStarted: string[] = JSON.parse(localStorage.getItem(dismissedStartedKey) || '[]');

      // 1. Find live sessions that aren't dismissed
      const liveSessions = sessions.filter(s => {
        const calcState = getSessionCalculatedState(s);
        if (calcState !== 'Live') return false;
        const key = s.id + "_" + (s.date || '') + "_" + (s.startTime || '');
        return !dismissedStarted.includes(key);
      });

      if (liveSessions.length > 0) {
        setActiveReminderSession(liveSessions[0]);
        setReminderType('started');
        return;
      }

      // 2. Find upcoming sessions within 15 minutes that aren't dismissed
      const upcomingCandidates = sessions.filter(s => {
        const calcState = getSessionCalculatedState(s);
        if (calcState !== 'Upcoming') return false;

        const rawS = s.startTime || '';
        const cleanTimeS = rawS.trim().substring(0, 5);
        const [year, month, day] = s.date.trim().split('-').map(Number);
        const [startH, startM] = cleanTimeS.split(':').map(Number);
        const startDate = new Date(year, month - 1, day, startH, startM, 0, 0);

        const diffMs = startDate.getTime() - now.getTime();
        const diffMins = Math.ceil(diffMs / (60 * 1000));

        if (diffMins > 0 && diffMins <= 15) {
          const key = s.id + "_" + (s.date || '') + "_" + (s.startTime || '');
          return !dismissedUpcoming.includes(key);
        }
        return false;
      });

      if (upcomingCandidates.length > 0) {
        const sorted = [...upcomingCandidates].sort((a, b) => {
          const cleanSa = (a.startTime || '').trim().substring(0, 5);
          const cleanSb = (b.startTime || '').trim().substring(0, 5);
          const [ya, ma, da] = a.date.trim().split('-').map(Number);
          const [yb, mb, db] = b.date.trim().split('-').map(Number);
          const [ha, m_a] = cleanSa.split(':').map(Number);
          const [hb, m_b] = cleanSb.split(':').map(Number);
          return new Date(ya, ma - 1, da, ha, m_a, 0, 0).getTime() - new Date(yb, mb - 1, db, hb, m_b, 0, 0).getTime();
        });

        setActiveReminderSession(sorted[0]);
        setReminderType('upcoming');
        return;
      }

      // If active session started, transition or close
      setActiveReminderSession(prev => {
        if (!prev) return null;
        const latestSess = sessions.find(s => s.id === prev.id);
        if (!latestSess) return null;

        const calcState = getSessionCalculatedState(latestSess);
        const key = latestSess.id + "_" + (latestSess.date || '') + "_" + (latestSess.startTime || '');
        if (calcState === 'Live' && !dismissedStarted.includes(key)) {
          setReminderType('started');
          return latestSess;
        } else if (calcState === 'Completed') {
          setReminderType(null);
          return null;
        } else if (calcState === 'Upcoming') {
          const rawS = latestSess.startTime || '';
          const cleanTimeS = rawS.trim().substring(0, 5);
          const [year, month, day] = latestSess.date.trim().split('-').map(Number);
          const [startH, startM] = cleanTimeS.split(':').map(Number);
          const startDate = new Date(year, month - 1, day, startH, startM, 0, 0);

          const diffMs = startDate.getTime() - now.getTime();
          const diffMins = Math.ceil(diffMs / (60 * 1000));

          if (diffMins > 0 && diffMins <= 15) {
            setReminderType('upcoming');
            return latestSess;
          } else {
            setReminderType(null);
            return null;
          }
        }
        return latestSess;
      });
    };

    checkSessions();

    const intervalId = setInterval(checkSessions, 60 * 1000);
    return () => clearInterval(intervalId);
  }, [sessions, studentProfile.id]);

  const dismissReminder = (session: Session, type: 'upcoming' | 'started') => {
    const sessionId = session.id + "_" + (session.date || '') + "_" + (session.startTime || '');
    if (type === 'upcoming') {
      const dismissedUpcomingKey = `student_dismissed_upcoming_${studentProfile.id}`;
      const dismissedUpcoming: string[] = JSON.parse(localStorage.getItem(dismissedUpcomingKey) || '[]');
      if (!dismissedUpcoming.includes(sessionId)) {
        dismissedUpcoming.push(sessionId);
        localStorage.setItem(dismissedUpcomingKey, JSON.stringify(dismissedUpcoming));
      }
    } else {
      const dismissedStartedKey = `student_dismissed_started_${studentProfile.id}`;
      const dismissedStarted: string[] = JSON.parse(localStorage.getItem(dismissedStartedKey) || '[]');
      if (!dismissedStarted.includes(sessionId)) {
        dismissedStarted.push(sessionId);
        localStorage.setItem(dismissedStartedKey, JSON.stringify(dismissedStarted));
      }
    }
    setActiveReminderSession(null);
    setReminderType(null);
  };

  const viewReminderSession = (session: Session, type: 'upcoming' | 'started') => {
    const sessionId = session.id + "_" + (session.date || '') + "_" + (session.startTime || '');
    const dismissedUpcomingKey = `student_dismissed_upcoming_${studentProfile.id}`;
    const dismissedUpcoming: string[] = JSON.parse(localStorage.getItem(dismissedUpcomingKey) || '[]');
    if (!dismissedUpcoming.includes(sessionId)) {
      dismissedUpcoming.push(sessionId);
      localStorage.setItem(dismissedUpcomingKey, JSON.stringify(dismissedUpcoming));
    }

    const dismissedStartedKey = `student_dismissed_started_${studentProfile.id}`;
    const dismissedStarted: string[] = JSON.parse(localStorage.getItem(dismissedStartedKey) || '[]');
    if (!dismissedStarted.includes(sessionId)) {
      dismissedStarted.push(sessionId);
      localStorage.setItem(dismissedStartedKey, JSON.stringify(dismissedStarted));
    }

    setActiveTab('verify');
    setActiveReminderSession(null);
    setReminderType(null);
  };

  const getCountdownText = (session: Session) => {
    const now = new Date();
    const rawS = session.startTime || '';
    const cleanTimeS = rawS.trim().substring(0, 5);
    const [year, month, day] = session.date.trim().split('-').map(Number);
    const [startH, startM] = cleanTimeS.split(':').map(Number);
    const startDate = new Date(year, month - 1, day, startH, startM, 0, 0);
    
    const diffMs = startDate.getTime() - now.getTime();
    const diffMins = Math.ceil(diffMs / (60 * 1000));
    
    if (diffMins <= 0) {
      return "Starts now";
    }
    return `Starts in ${diffMins} minute${diffMins > 1 ? 's' : ''}`;
  };

  // Navigation tab status
  const [activeTab, setActiveTabState] = useState<'verify' | 'history' | 'assignments' | 'feedback' | 'notifications' | 'profile' | 'report' | 'absence'>(() => {
    const path = window.location.pathname;
    if (path === '/attendance') return 'history';
    if (path === '/assignments') return 'assignments';
    if (path === '/feedback') return 'feedback';
    if (path === '/notifications') return 'notifications';
    if (path === '/profile') return 'profile';
    if (path === '/report') return 'report';
    if (path === '/absence') return 'absence';
    return 'verify'; // /dashboard maps to verify
  });

  const setActiveTab = (tab: 'verify' | 'history' | 'assignments' | 'feedback' | 'notifications' | 'profile' | 'report' | 'absence') => {
    setActiveTabState(tab);
    let path = '/dashboard';
    if (tab === 'history') path = '/attendance';
    else if (tab === 'assignments') path = '/assignments';
    else if (tab === 'feedback') path = '/feedback';
    else if (tab === 'notifications') path = '/notifications';
    else if (tab === 'profile') path = '/profile';
    else if (tab === 'report') path = '/report';
    else if (tab === 'absence') path = '/absence';
    window.history.pushState(null, '', path);
  };

  // Sync state with back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/attendance') setActiveTabState('history');
      else if (path === '/assignments') setActiveTabState('assignments');
      else if (path === '/feedback') setActiveTabState('feedback');
      else if (path === '/notifications') setActiveTabState('notifications');
      else if (path === '/profile') setActiveTabState('profile');
      else if (path === '/report') setActiveTabState('report');
      else if (path === '/absence') setActiveTabState('absence');
      else setActiveTabState('verify');
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Interactive states
  const [studentToken, setStudentToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState<boolean>(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [retrievedTokenSessionId, setRetrievedTokenSessionId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [toastShownForSession, setToastShownForSession] = useState<string | null>(null);
  const [showSessionDetailsModal, setShowSessionDetailsModal] = useState<boolean>(false);
  const lastFetchedSessionIdRef = useRef<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    title?: string;
    message?: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  // Auto-refresh tick to update states in real time
  useEffect(() => {
    const handleActivity = () => {
      setTick(t => t + 1);
      loadStudentMetrics();
    };
    window.addEventListener('focus', handleActivity);
    document.addEventListener('visibilitychange', handleActivity);

    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 60000);

    return () => {
      window.removeEventListener('focus', handleActivity);
      document.removeEventListener('visibilitychange', handleActivity);
      clearInterval(interval);
    };
  }, []);

  const liveSession = sessions.find(s => {
    return getSessionCalculatedState(s) === 'Live';
  });

  useEffect(() => {
    let active = true;

    if (!studentProfile) {
      setStudentToken(null);
      setTokenError("Student ID missing");
      setTokenLoading(false);
      lastFetchedSessionIdRef.current = null;
      return;
    }

    const liveSess = sessions.find(s => {
      return getSessionCalculatedState(s) === 'Live';
    });

    if (sessions.length === 0) {
      setStudentToken(null);
      setTokenError("No active session found");
      setTokenLoading(false);
      lastFetchedSessionIdRef.current = null;
      return;
    }

    if (!liveSess) {
      const inactiveSess = sessions.find(s => getSessionCalculatedState(s) === 'Upcoming');
      if (inactiveSess) {
        setStudentToken(null);
        setTokenError("Session inactive");
        setTokenLoading(false);
        lastFetchedSessionIdRef.current = null;
        return;
      }
      setStudentToken(null);
      setTokenError("No active session found");
      setTokenLoading(false);
      lastFetchedSessionIdRef.current = null;
      return;
    }

    if (!liveSess.id) {
      setStudentToken(null);
      setTokenError("Session ID missing");
      setTokenLoading(false);
      lastFetchedSessionIdRef.current = null;
      return;
    }

    // Skip if we already fetched for this session and have a token OR error,
    // UNLESS the error is currently cleared.
    if (lastFetchedSessionIdRef.current === liveSess.id && studentToken && !tokenError) {
      setTokenLoading(false);
      return;
    }

    if (lastFetchedSessionIdRef.current === liveSess.id && tokenError) {
      setTokenLoading(false);
      return;
    }

    setTokenLoading(true);
    lastFetchedSessionIdRef.current = liveSess.id;

    console.log("[Attendance Debug Audit - Start Fetch]", {
      activeSessionId: liveSess.id,
      studentId: studentProfile.id
    });

    attendanceTokenService.getStudentToken(liveSess.id, studentProfile.id)
      .then(res => {
        if (!active) {
          console.log("[Attendance Debug Audit - Fetch Ignored (cleanup already ran)]", {
            activeSessionId: liveSess.id,
            studentId: studentProfile.id
          });
          return;
        }
        setTokenLoading(false);
        setRetrievedTokenSessionId(liveSess.id);

        // Required exact diagnostic logs format: activeSessionId, studentId, tokenQueryResult, attendanceToken, expiresAt, qrPayload
        console.log("[Attendance Debug Audit - Token Fetched]", {
          activeSessionId: liveSess.id,
          studentId: studentProfile.id,
          tokenQueryResult: res,
          attendanceToken: res.data ? res.data.attendanceToken : null,
          expiresAt: res.data ? res.data.expiresAt : null,
          qrPayload: res.data ? res.data.attendanceToken : null
        });

        if (res.error) {
          console.error("[Token Retrieval Error Payload]", res.error);
          setTokenError(res.error);
          setStudentToken(null);
        } else {
          setStudentToken(res.data ? res.data.attendanceToken : null);
          setTokenError(null);
        }
      })
      .catch(err => {
        if (!active) return;
        setTokenLoading(false);
        setRetrievedTokenSessionId(liveSess.id);
        console.error("[Token Recovery Throw]", err);
        const errorMsg = err?.message || 'Failed to communicate with token server';
        setTokenError(errorMsg);
        setStudentToken(null);
      });

    return () => {
      // Protect from state change re-renders canceling active HTTP fetches:
      // only deactivate if the live session changes or component actually unmounts.
      const currentLiveSess = sessions.find(s => getSessionCalculatedState(s) === 'Live');
      if (!currentLiveSess || currentLiveSess.id !== liveSess.id) {
        active = false;
      }
    };
  }, [studentProfile, sessions]);

  useEffect(() => {
    if (liveSession && hasAttendanceForSession(liveSession.id)) {
      if (toastShownForSession !== liveSession.id) {
        showToast('Attendance Recorded Successfully', 'success');
        setToastShownForSession(liveSession.id);
      }
    } else if (!liveSession) {
      setToastShownForSession(null);
    }
  }, [liveSession, attendance, toastShownForSession, showToast]);

  // Student submission form fields
  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null);
  const [submissionForm, setSubmissionForm] = useState({
    attachedFiles: [] as Array<{name: string, url: string, size?: string}>,
    attachedLinks: ''
  });
  const [uploading, setUploadingOriginal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isSubmittingSubmission, setIsSubmittingSubmissionOriginal] = useState(false);

  const setUploading = (val: boolean) => {
    console.log("[STATE TRANSITION] uploading: change from", uploading, "to", val);
    setUploadingOriginal(val);
  };

  const setIsSubmittingSubmission = (val: boolean) => {
    console.log("[STATE TRANSITION] isSubmittingSubmission: change from", isSubmittingSubmission, "to", val);
    setIsSubmittingSubmissionOriginal(val);
  };

  // Dynamic Class Summaries feedback form fields
  const [activeSessionSummary, setActiveSessionSummary] = useState<Session | null>(null);

  // Refresh all summaries whenever activeSessionSummary changes
  useEffect(() => {
    if (activeSessionSummary?.id) {
      summaryService.getSessionSummaries().then(sums => {
        if (sums) {
          setAllSummaries(sums);
        }
      }).catch(err => {
        console.warn("Could not refresh summaries for session:", err);
      });
    }
  }, [activeSessionSummary?.id]);
  const [summaryForm, setSummaryForm] = useState(() => {
    const saved = localStorage.getItem('unsaved_feedback_form');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      summary: '',
      learnings: '',
      reflections: '',
      suggestions: '',
      feedback: '',
      rating: 0,
      contentQualityRating: 0,
      instructorRating: 0,
      relevanceRating: 0,
      engagementRating: 0,
      learningImpact: 'Significant Improvement',
      confidenceLevel: 'Intermediate'
    };
  });
  const [isSubmittingSummary, setIsSubmittingSummary] = useState(false);

  useEffect(() => {
    if (summaryForm.summary || summaryForm.feedback || summaryForm.rating) {
      localStorage.setItem('unsaved_feedback_form', JSON.stringify(summaryForm));
    } else {
      localStorage.removeItem('unsaved_feedback_form');
    }
  }, [summaryForm]);

  // Absence request upload state managers
  const [absenceReason, setAbsenceReason] = useState<string>(() => {
    return localStorage.getItem('unsaved_absence_reason') || '';
  });
  const [selectedAbsenceSession, setSelectedAbsenceSession] = useState<string>('');
  const [absenceFile, setAbsenceFile] = useState<{ name: string; url: string; path: string } | null>(null);
  const [absenceUploading, setAbsenceUploading] = useState<boolean>(false);
  const [absenceUploadProgress, setAbsenceUploadProgress] = useState<number | null>(null);
  const [absenceUploadError, setAbsenceUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (absenceReason) {
      localStorage.setItem('unsaved_absence_reason', absenceReason);
    } else {
      localStorage.removeItem('unsaved_absence_reason');
    }
  }, [absenceReason]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).inactivityTimeoutPaused = absenceUploading;
    }
    return () => {
      if (typeof window !== 'undefined') {
        (window as any).inactivityTimeoutPaused = false;
      }
    };
  }, [absenceUploading]);

  // Absence proof preview states
  const [previewFileUrl, setPreviewFileUrl] = useState<string | null>(null);
  const [previewFileType, setPreviewFileType] = useState<'pdf' | 'image' | 'unknown' | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string>('');
  const [previewFileLoading, setPreviewFileLoading] = useState<boolean>(false);

  const handleFilePreview = async (url: string, fileName: string) => {
    setPreviewFileName(fileName || 'Supporting Document');
    setPreviewFileLoading(true);

    const cleanFileName = (fileName || '').split('?')[0];
    const extension = cleanFileName.split('.').pop()?.toLowerCase() || '';
    const isPdf = ['pdf'].includes(extension) || (url && url.toLowerCase().includes('.pdf'));

    // Open blank tab synchronously BEFORE the async storage request to satisfy browser popup security policies
    let newTab: Window | null = null;
    if (isPdf) {
      try {
        newTab = window.open('about:blank', '_blank');
        if (newTab) {
          newTab.document.write(`
            <html>
              <head>
                <title>Loading PDF Document...</title>
                <style>
                  body {
                    background: #090d16;
                    color: #94a3b8;
                    font-family: system-ui, -apple-system, sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                  }
                  .loader {
                    text-align: center;
                    padding: 24px;
                    border-radius: 16px;
                    border: 1px solid #1e293b;
                    background: #030712;
                  }
                  h1 { color: #f8fafc; font-size: 18px; margin-bottom: 8px; margin-top: 0; }
                  p { font-size: 13px; color: #64748b; margin: 0; }
                </style>
              </head>
              <body>
                <div class="loader">
                  <h1>Securing Access Credentials</h1>
                  <p>Generating temporary secure read link for PDF document...</p>
                </div>
              </body>
            </html>
          `);
        }
      } catch (tabErr) {
        console.warn("Failed to prepare new tab synchronously:", tabErr);
      }
    }

    try {
      const safeUrl = await storageService.getSafePreviewUrl(url);
      if (!safeUrl) {
        throw new Error('Storage service returned an empty or invalid preview URL.');
      }
      
      const realIsPdf = isPdf || safeUrl.toLowerCase().includes('.pdf');

      let viewableUrl = safeUrl;
      if (safeUrl.startsWith('data:')) {
        try {
          const parts = safeUrl.split(',');
          const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
          const bstr = atob(parts[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          const blob = new Blob([u8arr], { type: mime });
          viewableUrl = URL.createObjectURL(blob);
        } catch (blobErr: any) {
          console.error("Failed to convert data URL to Blob:", blobErr);
          throw new Error(`Data conversion failed: ${blobErr.message}`);
        }
      }

      if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(extension) || safeUrl.startsWith('data:image/')) {
        if (newTab) {
          newTab.close();
          newTab = null;
        }
        setPreviewFileUrl(viewableUrl);
        setPreviewFileType('image');
      } else if (realIsPdf) {
        if (newTab) {
          newTab.location.href = viewableUrl;
          setPreviewFileUrl(null);
          setPreviewFileType(null);
          showToast('Opening PDF document in a new browser tab...', 'success');
        } else {
          // Fallback if popup blocker resolved to null
          setPreviewFileUrl(viewableUrl);
          setPreviewFileType('pdf');
          showToast('Displaying PDF document inline...', 'success');
        }
      } else {
        if (newTab) {
          newTab.close();
          newTab = null;
        }
        setPreviewFileUrl(viewableUrl);
        setPreviewFileType('unknown');
      }
    } catch (err: any) {
      if (newTab) {
        try {
          newTab.close();
        } catch (e) {}
      }
      console.error("Preview failed:", err);
      showToast(`Preview failed: ${err.message || err}`, 'error');
    } finally {
      setPreviewFileLoading(false);
    }
  };

  const handleAbsenceUpload = async (file: File) => {
    // Check file type: PDF, PNG, JPG, JPEG
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const isAllowedExtension = ['pdf', 'png', 'jpg', 'jpeg'].includes(fileExtension || '');
    
    if (!allowedTypes.includes(file.type) && !isAllowedExtension) {
      setAbsenceUploadError('Unsupported file type. Please upload PDF, PNG, or JPG/JPEG.');
      showToast('Unsupported file type. Please upload PDF, PNG, or JPG/JPEG.', 'error');
      return;
    }

    // Check file size: Max 5 MB (5 * 1024 * 1024 bytes)
    if (file.size > 5 * 1024 * 1024) {
      setAbsenceUploadError('File size exceeds the 5 MB limit. Please upload a smaller file.');
      showToast('File size exceeds the 5 MB limit. Please upload a smaller file.', 'error');
      return;
    }

    setAbsenceUploading(true);
    setAbsenceUploadProgress(20);
    setAbsenceUploadError(null);

    let timer: NodeJS.Timeout | null = null;
    try {
      // Simulate/Show upload progress linearly
      timer = setInterval(() => {
        setAbsenceUploadProgress(prev => {
          if (prev === null) return 20;
          if (prev >= 90) {
            if (timer) clearInterval(timer);
            return 90;
          }
          return prev + 15;
        });
      }, 100);

      const uploadRes = await storageService.uploadFile('absence-attachments', file);
      if (timer) clearInterval(timer);

      if (uploadRes.error) {
        setAbsenceUploadError(`Upload failed: ${uploadRes.error}`);
        showToast(`Upload failed: ${uploadRes.error}`, 'error');
      } else {
        setAbsenceFile({
          name: file.name,
          url: uploadRes.url,
          path: uploadRes.path || ''
        });
        setAbsenceUploadProgress(100);
        showToast(`File "${file.name}" uploaded successfully!`, 'success');
      }
    } catch (err: any) {
      if (timer) clearInterval(timer);
      setAbsenceUploadError(`Upload error: ${err.message || err}`);
      showToast(`Upload error: ${err.message || err}`, 'error');
    } finally {
      setAbsenceUploading(false);
    }
  };

  const handleDeleteAbsenceRequest = (req: AbsenceRequest) => {
    if (req.status === 'Approved' || req.status === 'Rejected') {
      showToast('Approved or rejected requests cannot be withdrawn.', 'error');
      return;
    }
    if (req.status !== 'Pending') {
      showToast('Only pending requests can be withdrawn.', 'error');
      return;
    }

    setDeleteConfirm({
      isOpen: true,
      title: 'Withdraw Absence Claim',
      message: `Are you sure you want to withdraw this absence request for session "${req.sessionName}"? This will permanently delete the request and its uploaded proof.`,
      onConfirm: async () => {
        console.log(`[Withdraw Claim Flow Start] Received request ID to withdraw: ${req.requestId}`);
        
        let storageDeleteOk = true;
        let storageErrorDetail = '';
        
        // 1. If contains attachmentUrl, delete file from storage
        if (req.attachmentUrl) {
          const details = storageService.getStorageDetailsFromUrl(req.attachmentUrl);
          if (details) {
            try {
              console.log(`[Storage Delete Execute] Attempting to delete attachment: bucket=${details.bucket}, path=${details.path}`);
              const deletedFile = await storageService.deleteFile(details.bucket, details.path);
              console.log(`[Storage Delete Result] File delete status: ${deletedFile}`);
              if (!deletedFile) {
                storageDeleteOk = false;
                storageErrorDetail = 'Storage delete API returned false.';
              }
            } catch (storageErr: any) {
              console.error('[Storage Delete Exception]', storageErr);
              storageDeleteOk = false;
              storageErrorDetail = storageErr.message || String(storageErr);
            }
          }
        }

        // 2. Delete database record
        try {
          console.log(`[DB Delete Execute] Attempting to delete absence request ID: ${req.requestId}`);
          const deleted = await absenceRequestService.deleteAbsenceRequest(req.requestId);
          console.log(`[DB Delete Result] Database delete status: ${deleted}`);
          
          if (!deleted) {
            throw new Error('Database delete action returned false. Row might not exist, or you lack permission.');
          }

          if (!storageDeleteOk && req.attachmentUrl) {
            console.warn(`[Withdraw Partial Success] Database record deleted, but proof file was not removed from storage bucket. Details: ${storageErrorDetail}`);
          }

          showToast('Request withdrawn successfully.', 'success');
          setAbsenceReason(''); // Automatically clear text area on withdraw!

          // 3. Notify admins that the request was withdrawn
          try {
            await notificationService.addNotification(
              'Absence Withdrawn ⚠️',
              `${studentProfile.fullName} (${studentProfile.usn || 'N/A'}) withdrew their absence request for "${req.sessionName}".`,
              'admin'
            );
          } catch (notifErr) {
            console.error('[Notification Send Failed] Could not send withdrawal notification', notifErr);
          }

          // 4. Refresh absence list
          console.log('[Refresh List Execute] Fetching updated absence requests...');
          const updated = await absenceRequestService.getAbsenceRequests(undefined, studentProfile.id);
          setAbsenceRequests(updated);
        } catch (dbErr: any) {
          console.error('[DB Delete Exception]', dbErr);
          showToast(`Withdrawal failed: ${dbErr.message || dbErr}`, 'error');
        }
      }
    });
  };

  const eligibleSessions = useMemo(() => {
    return sessions.filter(s => {
      // 1. Session completely ended check (using getSessionCalculatedState)
      const calcState = getSessionCalculatedState(s);
      if (calcState !== 'Completed') {
        return false;
      }

      // 2. Logged-in student was marked Absent check
      const isPresent = attendance.some(a => a.sessionId === s.id && (a.studentId === studentProfile.id || a.studentUsn === studentProfile.usn));
      if (isPresent) {
        return false;
      }

      // 3. No previous regularization request check
      const alreadyRequested = (absenceRequests || []).some(
        r => r.sessionId === s.id && r.studentId === studentProfile.id
      );
      if (alreadyRequested) {
        return false;
      }

      // 4. Regularization window check (if configured)
      if ((s as any).regularizationDeadline) {
        if (new Date() > new Date((s as any).regularizationDeadline)) {
          return false;
        }
      }
      if ((s as any).regularizationWindow) {
        const windowHours = Number((s as any).regularizationWindow);
        if (!isNaN(windowHours)) {
          const [year, month, day] = s.date.trim().split('-').map(Number);
          const cleanTime = (s.extendedEndTime || s.endTime || '').trim().substring(0, 5);
          const [hours, minutes] = cleanTime.split(':').map(Number);
          const endDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
          if (new Date().getTime() > endDateTime.getTime() + windowHours * 60 * 60 * 1000) {
            return false;
          }
        }
      }

      return true;
    });
  }, [sessions, attendance, absenceRequests, studentProfile.id, studentProfile.usn]);

  // Fetch client student data
  const loadStudentMetrics = async () => {
    try {
      setMetricsError(null);
      const sessList = await sessionService.getSessions();
      setSessions(sessList);

      try {
        const students = await authService.getStudentProfiles();
        setAllStudentsCount(students.length || 60);
      } catch (e) {
        console.warn("Could not load all students profiles for metrics:", e);
      }

      const attList = await attendanceService.getAttendance();
      setAllAttendance(attList);
      // Filter attendance records specific to this student's USN or profile ID
      setAttendance(attList.filter(a => a.studentUsn === studentProfile.usn || a.studentId === studentProfile.id));

      const assignList = await assignmentService.getAssignments();
      const activeAssigns = assignList.filter(a => !a.isArchived);
      setAssignments(activeAssigns);

      const subList = await assignmentService.getSubmissions();
      const userSubmissions = subList.filter(s => s.studentUsn === studentProfile.usn || s.studentId === studentProfile.id);
      setSubmissions(userSubmissions);

      // Evaluate assignment reminders (24h, 6h, 1h, due today, overdue)
      try {
        const now = new Date();
        for (const a of activeAssigns) {
          const hasSubmitted = userSubmissions.some(s => s.assignmentId === a.id);
          const deadlineDate = new Date(a.deadline);
          const diffMs = deadlineDate.getTime() - now.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);
          const isToday = deadlineDate.toDateString() === now.toDateString();

          if (!hasSubmitted) {
            if (diffMs < 0) {
              const key = `notif_sent_overdue_${studentProfile.id}_${a.id}`;
              if (!localStorage.getItem(key)) {
                await notificationService.addNotification(
                  "⚠️ Assignment Overdue",
                  `Your assignment ${a.title} is overdue. Please submit immediately if late submissions are allowed. [assignmentId:${a.id}]`,
                  "student"
                );
                localStorage.setItem(key, 'true');
              }
            } else if (diffHours <= 1 && diffHours > 0) {
              const key = `notif_sent_1h_${studentProfile.id}_${a.id}_${deadlineDate.getTime()}`;
              if (!localStorage.getItem(key)) {
                await notificationService.addNotification(
                  "⏰ Assignment Due Soon",
                  `${a.title} is due in 1 hour. [assignmentId:${a.id}]`,
                  "student"
                );
                localStorage.setItem(key, 'true');
              }
            } else if (diffHours <= 6 && diffHours > 1) {
              const key = `notif_sent_6h_${studentProfile.id}_${a.id}_${deadlineDate.getTime()}`;
              if (!localStorage.getItem(key)) {
                await notificationService.addNotification(
                  "⏰ Assignment Due Soon",
                  `${a.title} is due in 6 hours. [assignmentId:${a.id}]`,
                  "student"
                );
                localStorage.setItem(key, 'true');
              }
            } else if (diffHours <= 24 && diffHours > 6) {
              const key = `notif_sent_24h_${studentProfile.id}_${a.id}_${deadlineDate.getTime()}`;
              if (!localStorage.getItem(key)) {
                await notificationService.addNotification(
                  "⏰ Assignment Due Soon",
                  `${a.title} is due in 24 hours. [assignmentId:${a.id}]`,
                  "student"
                );
                localStorage.setItem(key, 'true');
              }
            } else if (isToday) {
              const key = `notif_sent_today_${studentProfile.id}_${a.id}_${deadlineDate.getTime()}`;
              if (!localStorage.getItem(key)) {
                await notificationService.addNotification(
                  "⏰ Assignment Due Today",
                  `${a.title} is due today. [assignmentId:${a.id}]`,
                  "student"
                );
                localStorage.setItem(key, 'true');
              }
            }
          }
        }
      } catch (err) {
        console.warn("Error evaluating assignment reminders:", err);
      }

      const sums = await summaryService.getSessionSummaries();
      setAllSummaries(sums);
      setSummaries(sums.filter(s => s.studentUsn === studentProfile.usn || s.studentId === studentProfile.id));

      try {
        const countsMap: Record<string, number> = {};
        await Promise.all(sessList.map(async (s) => {
          const count = await summaryService.getSessionFeedbackCount(s.id);
          countsMap[s.id] = count;
        }));
        setSessionFeedbackCounts(countsMap);
      } catch (err) {
        console.warn("Could not load session feedback counts:", err);
      }

      try {
        const absRequests = await absenceRequestService.getAbsenceRequests(undefined, studentProfile.id);
        setAbsenceRequests(absRequests);
      } catch (e) {
        console.warn("Could not load absence requests:", e);
      }

      const notifs = await notificationService.getNotifications('student', studentProfile);
      const studentRole = 'student';
      const deletedKey = `student_deleted_notifs_${studentProfile.id}`;
      const deletedIds: string[] = JSON.parse(localStorage.getItem(deletedKey) || '[]');
      const readKey = `student_read_notifs_${studentProfile.id}`;
      const localReadIds: string[] = JSON.parse(localStorage.getItem(readKey) || '[]');

      const filteredNotifs = notifs
        .filter(n => n.roleTarget === 'student' || n.roleTarget === 'all')
        .filter(n => !deletedIds.includes(n.id) && !isStudentSpecificNotificationDeleted(studentProfile.id, n.title, n.message))
        .map(n => {
          const isLocallyRead = localReadIds.includes(n.id);
          const readByArray = n.readBy || [];
          const updatedReadBy = isLocallyRead && !readByArray.includes(studentProfile.id)
            ? [...readByArray, studentProfile.id]
            : readByArray;
          return {
            ...n,
            readBy: updatedReadBy
          };
        });
      
      console.log("[Notification Debug Audit]", {
        studentRole,
        notificationCount: filteredNotifs.length,
        queryResult: notifs,
        roleTarget: 'student'
      });

      setNotifications(filteredNotifs);
    } catch (err: any) {
      console.error(err);
      setMetricsError(err?.message || 'Could not fetch student database profile.');
      showToast('Could not fetch student database profile.', 'error');
    } finally {
      setMetricsLoading(false);
    }
  };

  const loadStudentMetricsDebounced = useRef(
    debounce(() => {
      loadStudentMetrics();
    }, 1000)
  ).current;

  useEffect(() => {
    loadStudentMetrics();

    const handleSyncUpdate = () => {
      console.log("[Reactivity Sync Update Triggered at Student] Reloading metrics...");
      loadStudentMetricsDebounced();
    };
    window.addEventListener('storage_sync_update', handleSyncUpdate);

    // Setup real-time Supabase subscriptions using specific listener helper
    // wrapped in debounced updates to prevent socket and database flooding!
    const cleanup = subscribeToDatabaseChanges(() => {
      console.log("[Supabase Realtime Event RECEIVED at Student] Reloading student metrics debounced...");
      loadStudentMetricsDebounced();
    });

    // Periodic auto-refresh interval to keep student counts/dashboard updated in real-time
    const pollInterval = setInterval(() => {
      loadStudentMetricsDebounced();
    }, 15000);

    return () => {
      window.removeEventListener('storage_sync_update', handleSyncUpdate);
      clearInterval(pollInterval);
      cleanup();
    };
  }, [loadStudentMetricsDebounced]);

  // Time calculations
  const parseSessionTime = (dateStr: string, timeStr: string) => {
    const cleanTime = timeStr.trim().substring(0, 5);
    return new Date(`${dateStr.trim()}T${cleanTime}`);
  };

  const getSessionDateTimeRange = (session: Session) => {
    const startDate = parseSessionTime(session.date, session.startTime);
    const endDate = parseSessionTime(session.date, session.endTime);
    return { startDate, endDate };
  };

  const getSessionState = (session: Session) => {
    return getSessionCalculatedState(session);
  };

  // Student self-attendance functions are removed as registration is now administrator-controlled.

  const handleMarkAllAsRead = async () => {
    try {
      // 1. Optimistic UI update
      setNotifications(prev => prev.map(n => ({ ...n, readBy: [...(n.readBy || []), studentProfile.id] })));
      
      // 2. Persist to local fallback storage
      const readKey = `student_read_notifs_${studentProfile.id}`;
      const localReadIds: string[] = JSON.parse(localStorage.getItem(readKey) || '[]');
      notifications.forEach(n => {
        if (!localReadIds.includes(n.id)) {
          localReadIds.push(n.id);
        }
      });
      localStorage.setItem(readKey, JSON.stringify(localReadIds));

      // 3. Update database
      await notificationService.markAllAsRead(studentProfile.id, 'student');
      showToast('All notifications marked as read', 'success');
      await loadStudentMetrics();
    } catch (err) {
      console.error("Failed to mark notifications as read:", err);
      showToast('Failed to mark notifications as read', 'error');
    }
  };

  const handleClearAll = async () => {
    console.log("CLEAR ALL CLICKED");
    try {
      const currentNotifIds = notifications.map(n => n.id);
      setNotifications([]);
      await notificationService.clearAllNotificationsForStudent(studentProfile.id, currentNotifIds);
      showToast('Notifications list cleared', 'success');
      setShowClearConfirm(false);
      loadStudentMetrics();
    } catch (err) {
      showToast('Failed to clear notifications', 'error');
    }
  };

  const handleDeleteIndividual = async (id: string) => {
    console.log("DELETE CLICKED", id);
    try {
      setNotifications(prev => prev.filter(n => n.id !== id));
      await notificationService.deleteNotificationForStudent(id, studentProfile.id);
      showToast('Notification deleted.', 'success');
      loadStudentMetrics();
    } catch (err) {
      showToast('Unable to delete notification.', 'error');
    }
  };

  const handleMarkIndividualAsRead = async (id: string) => {
    try {
      // Diagnostic Logging
      const notifObj = notifications.find(n => n.id === id);
      console.log("MARK READ CLICKED");
      console.log(`Notification ID: ${id}`);
      console.log(`Student ID: ${studentProfile.id}`);
      console.log(`Notification Type: ${notifObj?.title || 'System Notification'}`);
      console.log(`Current State: unread`);

      // 1. Optimistic UI update
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, readBy: [...(n.readBy || []), studentProfile.id] } : n));
      
      // 2. Persist to local fallback storage
      const readKey = `student_read_notifs_${studentProfile.id}`;
      const localReadIds: string[] = JSON.parse(localStorage.getItem(readKey) || '[]');
      if (!localReadIds.includes(id)) {
        localReadIds.push(id);
        localStorage.setItem(readKey, JSON.stringify(localReadIds));
      }

      // 3. Update database
      const success = await notificationService.markAsRead(id, studentProfile.id);
      
      console.log(`Update Result: ${success ? 'success' : 'failed'}`);
      showToast('Notification marked as read', 'success');
      await loadStudentMetrics();
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
      showToast('Failed to mark notification as read', 'error');
    }
  };

  // Submit student assignment
  const handleSubmissionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAssignment) return;

    if (submissionForm.attachedFiles.length === 0 && !submissionForm.attachedLinks.trim()) {
      showToast('Validation Failed: Provide at least one valid submission file or external link.', 'info');
      return;
    }

    if (new Date(activeAssignment.deadline) < new Date()) {
      showToast('Submission Closed: Deadline has already passed.', 'error');
      return;
    }

    const cleanLinks = submissionForm.attachedLinks
      .split(',')
      .map(k => k.trim())
      .filter(k => k !== '');

    setIsSubmittingSubmission(true);
    // Log SUBMISSION INSERT
    console.log("SUBMISSION INSERT", {
      assignmentId: activeAssignment.id,
      studentId: studentProfile.id,
      filesSubmittedCount: submissionForm.attachedFiles.length
    });

    try {
      const success = await assignmentService.submitAssignment({
        assignmentId: activeAssignment.id,
        studentId: studentProfile.id,
        studentName: studentProfile.fullName,
        studentUsn: studentProfile.usn || '',
        attachedFiles: submissionForm.attachedFiles,
        attachedLinks: cleanLinks
      });

      if (success) {
        // Log SUBMISSION SUCCESS
        console.log("SUBMISSION SUCCESS", {
          assignmentId: activeAssignment.id,
          studentId: studentProfile.id
        });
        showToast('Assignment submitted successfully!', 'success');
        setActiveAssignment(null);
        setSubmissionForm({ attachedFiles: [], attachedLinks: '' });
        loadStudentMetrics();
      } else {
        // Log SUBMISSION FAILURE
        console.error("SUBMISSION FAILURE", "Database insert of submission record failed.");
        showToast('Database insert failed: Error filing academic submission records.', 'error');
      }
    } catch (err: any) {
      // Log SUBMISSION FAILURE
      console.error("SUBMISSION FAILURE", err);
      showToast(`Assignment submission failed: ${err.message || err}`, 'error');
    } finally {
      setIsSubmittingSubmission(false);
      setUploading(false); // Guarantee both states recovery on submit completion/failure
    }
  };

  const handleSubmissionsFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // 1. Log UPLOAD START
    console.log("UPLOAD START", { filesCount: files.length });

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log("UPLOAD SESSION", session);

        const { data: { user } } = await supabase.auth.getUser();
        console.log("UPLOAD USER", user);

        console.log("[StudentView Upload Session Verification Status - sessionStatus]", {
          currentSession: session,
          currentUser: session?.user || null,
          userId: session?.user?.id || null,
          userEmail: session?.user?.email || null
        });

        // Explicit logs
        console.log("Current Session:", session);
        console.log("Current User:", session?.user || null);
        console.log("User ID:", session?.user?.id || null);
        console.log("User Email:", session?.user?.email || null);

        if (!session || !session.user) {
          showToast('Session expired. Please login again.', 'error');
          showToast('Your login session has expired. Please login again.', 'error');
          return;
        }
      } catch (err: any) {
        console.error("Session lookup exception during precheck:", err);
        showToast('Session validation failed. Please try again or re-authenticate.', 'error');
        return;
      }
    }

    const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'zip'];

    // 2. Log FILE VALIDATION
    console.log("FILE VALIDATION", { files: (Array.from(files) as File[]).map(f => ({ name: f.name, size: f.size })) });

    setUploading(true);
    setUploadProgress(0);
    try {
      const results = [...submissionForm.attachedFiles];
      const bucketName = 'submissions';
      
      // 3. Log BUCKET NAME
      console.log("BUCKET NAME", bucketName);
      
      // Additional logs requested in bucket mismatch requirements 7 & 8
      console.log("BUCKET USED:", bucketName);

      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Explicit file size verification
        const MAX_SIZE_BYTES = 25 * 1024 * 1024;
        if (file.size > MAX_SIZE_BYTES) {
          showToast(`File exceeds size limit. "${file.name}" exceeds the maximum allowed size of 25 MB.`, 'error');
          failureCount++;
          continue;
        }

        const ext = file.name.split('.').pop()?.toLowerCase();
        if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
          showToast(`Unsupported file type: "${file.name}" is not permitted. Allowed types are: PDF, DOC, DOCX, PPT, PPTX, ZIP`, 'error');
          failureCount++;
          continue;
        }

        // Additional logs requested in bucket mismatch requirements 8
        console.log("fileName", file.name);
        console.log("fileSize", file.size);
        const anticipatedPath = `submissions/${file.name}`;
        console.log("uploadPath", anticipatedPath);

        // 4. Log UPLOAD ATTEMPT
        console.log("UPLOAD ATTEMPT", { fileName: file.name, fileSize: file.size, uploadPath: anticipatedPath });

        const res = await storageService.uploadFile(bucketName, file, (percent) => {
          setUploadProgress(percent);
        });
        
        if (res.error) {
          // 6. Log UPLOAD FAILURE
          console.error("UPLOAD FAILURE", { fileName: file.name, error: res.error });
          showToast(`Storage upload failed for "${file.name}": ${res.error}`, 'error');
          failureCount++;
        } else {
          // 5. Log UPLOAD SUCCESS
          console.log("UPLOAD SUCCESS", { fileName: file.name, url: res.url, uploadPath: res.path });
          const kb = Math.round(file.size / 1024);
          results.push({
            name: file.name,
            url: res.url,
            size: kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`
          });
          successCount++;
        }
      }
      setSubmissionForm({ ...submissionForm, attachedFiles: results });
      
      if (successCount > 0) {
        showToast(`Successfully uploaded ${successCount} academic files to repository.`, 'success');
      } else if (failureCount > 0) {
        showToast('Academic files upload failed. Clean up your choices and try again.', 'error');
      }
    } catch (err: any) {
      // 6. Log UPLOAD FAILURE
      console.error("UPLOAD FAILURE", err);
      showToast(`Storage upload failed: ${err.message || err}`, 'error');
    } finally {
      // 7. Log UPLOAD COMPLETE
      console.log("UPLOAD COMPLETE");
      setUploading(false);
      setIsSubmittingSubmission(false); // Guarantee resetting submit state too
      setUploadProgress(null);
    }
  };

  // Submit Summary Form
  const handleSummarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSessionSummary) return;

    if (summaryForm.rating === 0) {
      showToast('Overall Session Rating is required. Please select a star rating.', 'error');
      return;
    }

    setIsSubmittingSummary(true);
    try {
      const success = await summaryService.submitSessionSummary({
        sessionId: activeSessionSummary.id,
        studentId: studentProfile.id,
        studentName: studentProfile.fullName,
        studentUsn: studentProfile.usn || '',
        summary: "Class feedback filed via modern simplified rating system.",
        learnings: "Class feedback filed via modern simplified rating system.",
        reflections: 'Flipped learning session conducted.',
        suggestions: 'None.',
        feedback: summaryForm.feedback,
        rating: summaryForm.rating,
        contentQualityRating: summaryForm.contentQualityRating || summaryForm.rating,
        instructorRating: summaryForm.instructorRating || summaryForm.rating,
        relevanceRating: summaryForm.relevanceRating || summaryForm.rating,
        engagementRating: summaryForm.engagementRating || summaryForm.rating,
        learningImpact: summaryForm.learningImpact,
        confidenceLevel: summaryForm.confidenceLevel
      });

      if (success) {
        showToast('Feedback / Summary successfully filed! Thank you for your contribution.', 'success');
        localStorage.removeItem('unsaved_feedback_form');
        setIsEditingFeedback(false);
        setActiveSessionSummary(null);
        setSummaryForm({ 
          summary: '', 
          learnings: '', 
          reflections: '', 
          suggestions: '', 
          feedback: '',
          rating: 0,
          contentQualityRating: 0,
          instructorRating: 0,
          relevanceRating: 0,
          engagementRating: 0,
          learningImpact: 'Significant Improvement',
          confidenceLevel: 'Intermediate'
        });
        loadStudentMetrics();
      } else {
        showToast('Failed to file session summary metadata. Verify check-in of class.', 'error');
      }
    } catch (err: any) {
      showToast(`Session summary filing failed: ${err.message || err}`, 'error');
    } finally {
      setIsSubmittingSummary(false);
    }
  };

  const hasAttendanceForSession = (sessId: string) => {
    return attendance.some(a => a.sessionId === sessId);
  };

  const hasSubmissionForAssignment = (assignId: string) => {
    return submissions.some(s => s.assignmentId === assignId);
  };

  const hasSummaryForSession = (sessId: string) => {
    return summaries.some(s => s.sessionId === sessId);
  };

  const renderStarRating = (
    label: string,
    currentValue: number,
    setter: (val: number) => void,
    required: boolean = false
  ) => {
    const ratingTexts: Record<number, string> = {
      1: 'Poor (1/5)',
      2: 'Needs Improvement (2/5)',
      3: 'Good (3/5)',
      4: 'Very Good (4/5)',
      5: 'Excellent (5/5)'
    };
    return (
      <div className="space-y-1 bg-slate-900/40 p-3 rounded-xl border border-slate-900">
        <div className="flex justify-between items-center text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
          <span>{label} {required && <span className="text-red-400">*</span>}</span>
          <span className="font-mono text-[9.5px] text-cyan-400">
            {ratingTexts[currentValue] || 'Select stars'}
          </span>
        </div>
        <div className="flex items-center space-x-1.5 mt-1.5">
          {[1, 2, 3, 4, 5].map((star) => {
            const active = star <= currentValue;
            return (
              <button
                key={star}
                type="button"
                onClick={() => setter(star)}
                className="p-0.5 focus:outline-none transition-all duration-150 transform hover:scale-110 cursor-pointer"
              >
                <Star
                  className={`h-4.5 w-4.5 ${
                    active 
                      ? 'fill-cyan-400 text-cyan-400 drop-shadow-[0_0_4px_rgba(34,211,238,0.35)]' 
                      : 'text-slate-755 hover:text-slate-500'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSessionStatistics = (s: Session) => {
    const currentAttendance = allAttendance.filter(a => a.sessionId === s.id);
    const uniqueAttendees = currentAttendance.filter((item, index, self) =>
      self.findIndex(t => t.studentId === item.studentId) === index
    );
    const presentCount = uniqueAttendees.length;
    
    // Exclude approved excuse requests from registered count for this session
    const currentSessionAbsences = (absenceRequests || []).filter(r => r.sessionId === s.id && r.status === 'Approved').length;
    const registeredCount = Math.max(1, (allStudentsCount || 60) - currentSessionAbsences);
    const absentCount = Math.max(0, registeredCount - presentCount);
    const attendanceRate = registeredCount > 0 ? Math.round((presentCount / registeredCount) * 100) : 0;
    
    const currentFeedback = allSummaries.filter(su => su.sessionId === s.id);
    const uniqueFeedback = currentFeedback.filter((item, index, self) =>
      self.findIndex(t => 
        (t.studentUsn && item.studentUsn && t.studentUsn.trim().toLowerCase() === item.studentUsn.trim().toLowerCase()) ||
        (t.studentId && item.studentId && t.studentId === item.studentId)
      ) === index
    );
    const feedbackSubmitted = uniqueFeedback.length;
    const feedbackPending = Math.max(0, presentCount - feedbackSubmitted);
    
    const ownerName = s.hostedBy || 'System Creator';
    
    // Duration calculation
    let durationMins = 60;
    const endCalcTime = s.extendedEndTime || s.endTime;
    if (s.startTime && endCalcTime) {
      const [sh, sm] = s.startTime.split(':').map(Number);
      const [eh, em] = endCalcTime.split(':').map(Number);
      let diff = (eh * 60 + em) - (sh * 60 + sm);
      if (diff < 0) diff += 24 * 60;
      durationMins = diff;
    }
    const extensionsCount = s.extensionHistory?.length || 0;
    
    // Status check
    const now = new Date();
    const [eh, em] = (s.extendedEndTime || s.endTime || '23:59').split(':').map(Number);
    const sessionEndTimeStamp = new Date(s.date);
    sessionEndTimeStamp.setHours(eh, em, 0, 0);
    const hasEnded = now.getTime() > sessionEndTimeStamp.getTime();
    const displayStatus = s.status === 'live' && !hasEnded ? 'Live' : hasEnded ? 'Concluded' : 'Scheduled';

    // Determine correct Force Ended vs Normal status display
    const isForceEnded = s.status === 'expired' && !!s.actualEndTime;
    const endingTimeLabel = isForceEnded ? 'Session Ended At' : 'Session Ends At';
    const endingTimeValue = formatSessionEndTime(isForceEnded ? s.actualEndTime : (s.extendedEndTime || s.endTime));

    return (
      <div className="space-y-4 border-t border-slate-900/60 pt-4 mt-4 w-full text-left">
        <h5 className="text-[10.5px] uppercase font-bold text-slate-400 tracking-wider font-mono flex items-center gap-1.5 matches-the-spec">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
          Academic Statistics Dashboard
        </h5>
        
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Card 1: Attendance */}
          <div className="bg-slate-950/45 p-4 rounded-xl border border-slate-900 flex flex-col justify-center items-center text-center h-28 aspect-auto">
            <div className="text-2xl sm:text-3xl font-black text-cyan-400 tracking-tight">{attendanceRate}%</div>
            <span className="text-[10.0px] text-slate-400 font-bold uppercase mt-1.5 tracking-wider">Attendance Rate</span>
          </div>
          
          {/* Card 2: Present */}
          <div className="bg-slate-950/45 p-4 rounded-xl border border-slate-900 flex flex-col justify-center items-center text-center h-28 aspect-auto">
            <div className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight">{presentCount}</div>
            <span className="text-[10.0px] text-slate-400 font-bold uppercase mt-1.5 tracking-wider">Present</span>
          </div>

          {/* Card 3: Absent */}
          <div className="bg-slate-950/45 p-4 rounded-xl border border-slate-900 flex flex-col justify-center items-center text-center h-28 aspect-auto">
            <div className="text-2xl sm:text-3xl font-black text-rose-500 tracking-tight">{absentCount}</div>
            <span className="text-[10.0px] text-slate-400 font-bold uppercase mt-1.5 tracking-wider">Absent</span>
          </div>

          {/* Card 4: Timing */}
          <div className="bg-slate-950/45 p-4 rounded-xl border border-slate-900 flex flex-col justify-center items-center text-center h-28 aspect-auto">
            <div className="text-xl sm:text-2xl font-black text-white tracking-tight">{endingTimeValue}</div>
            <span className="text-[10.0px] text-slate-400 font-bold uppercase mt-1.5 tracking-wider">{endingTimeLabel}</span>
          </div>
        </div>
        
        {/* Detailed Meta Rails */}
        <div className="bg-slate-950/30 p-2.5 rounded-xl border border-slate-900 text-[10px] text-slate-400">
          <div className="flex justify-between items-center text-[9px] font-mono text-slate-500">
            <span>STATUS: <strong className="text-cyan-400 uppercase">{displayStatus}</strong></span>
            <span>EXTENSIONS APPROVED: <strong className="text-white">{extensionsCount}</strong></span>
          </div>
        </div>
      </div>
    );
  };

  const isStudentVerified = liveSession ? hasAttendanceForSession(liveSession.id) : false;
  const activeAttendance = liveSession ? attendance.find(a => a.sessionId === liveSession.id) : undefined;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* HUD HEADER */}
      <header className="border-b border-cyan-500/10 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-4 md:px-8 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-cyan-500 to-purple-650 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            <QrCode className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-display font-extrabold text-lg text-white tracking-tight">Smart Attendance Hub</div>
            <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest flex items-center">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse mr-1.5" />
              Student: {studentProfile.fullName} {studentProfile.usn ? `(${studentProfile.usn})` : ''}
            </div>
          </div>
        </div>

        {/* Top bar alerts context */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all cursor-pointer flex items-center justify-center"
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4 text-amber-400" />}
          </button>

          <button
            id="btn-student-signout"
            type="button"
            disabled={isSigningOut}
            onClick={handleSignOut}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-950 transition-all text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSigningOut ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-rose-400" />
                <span>Signing Out...</span>
              </>
            ) : (
              <>
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Container Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 grid md:grid-cols-12 gap-8">
        
        {/* Navigation panel */}
        <div className="md:col-span-3 flex flex-col space-y-4">
          
          <div className="glass-panel p-4 rounded-2xl flex flex-col space-y-2 bg-slate-950/45">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-2">Student Dashboard Menu</span>
            
            <button
              onClick={() => setActiveTab('verify')}
              data-active={activeTab === 'verify'}
              className={`sidebar-nav-btn ${activeTab === 'verify' ? 'active bg-cyan-500 text-white font-bold shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'text-slate-400 hover:text-white hover:bg-slate-900/80'}`}
            >
              <QrCode className={`h-4 w-4 shrink-0 ${activeTab === 'verify' ? 'text-white' : 'text-slate-400'}`} />
              <span>Verify Attendance</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              data-active={activeTab === 'history'}
              className={`sidebar-nav-btn ${activeTab === 'history' ? 'active bg-cyan-500 text-white font-bold shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'text-slate-400 hover:text-white hover:bg-slate-900/80'}`}
            >
              <FileCheck className={`h-4 w-4 shrink-0 ${activeTab === 'history' ? 'text-white' : 'text-slate-400'}`} />
              <span>Attendance History</span>
            </button>

            <button
              onClick={() => setActiveTab('assignments')}
              data-active={activeTab === 'assignments'}
              className={`sidebar-nav-btn ${activeTab === 'assignments' ? 'active bg-cyan-500 text-white font-bold shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'text-slate-400 hover:text-white hover:bg-slate-900/80'}`}
            >
              <BookOpen className={`h-4 w-4 shrink-0 ${activeTab === 'assignments' ? 'text-white' : 'text-slate-400'}`} />
              <span>Assignments</span>
            </button>

            <button
              onClick={() => setActiveTab('feedback')}
              data-active={activeTab === 'feedback'}
              className={`sidebar-nav-btn ${activeTab === 'feedback' ? 'active bg-cyan-500 text-white font-bold shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'text-slate-400 hover:text-white hover:bg-slate-900/80'}`}
            >
              <Send className={`h-4 w-4 shrink-0 ${activeTab === 'feedback' ? 'text-white' : 'text-slate-400'}`} />
              <span>Session Summaries & Feedback</span>
            </button>

            <button
              onClick={() => setActiveTab('notifications')}
              data-active={activeTab === 'notifications'}
              className={`sidebar-nav-btn ${activeTab === 'notifications' ? 'active bg-cyan-500 text-white font-bold shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'text-slate-400 hover:text-white hover:bg-slate-900/80'}`}
            >
              <Bell className={`h-4 w-4 shrink-0 ${activeTab === 'notifications' ? 'text-white' : 'text-slate-400'}`} />
              <span>Notifications</span>
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              data-active={activeTab === 'profile'}
              className={`sidebar-nav-btn ${activeTab === 'profile' ? 'active bg-cyan-500 text-white font-bold shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'text-slate-400 hover:text-white hover:bg-slate-900/80'}`}
            >
              <UserIcon className={`h-4 w-4 shrink-0 ${activeTab === 'profile' ? 'text-white' : 'text-slate-400'}`} />
              <span>Profile</span>
            </button>

            <button
              onClick={() => setActiveTab('report')}
              data-active={activeTab === 'report'}
              className={`sidebar-nav-btn ${activeTab === 'report' ? 'active bg-cyan-500 text-white font-bold shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'text-slate-400 hover:text-white hover:bg-slate-900/80'}`}
            >
              <FileText className={`h-4 w-4 shrink-0 ${activeTab === 'report' ? 'text-white' : 'text-slate-400'}`} />
              <span>Progress Report</span>
            </button>

            <button
              onClick={() => setActiveTab('absence')}
              data-active={activeTab === 'absence'}
              className={`sidebar-nav-btn ${activeTab === 'absence' ? 'active bg-cyan-500 text-white font-bold shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'text-slate-400 hover:text-white hover:bg-slate-900/80'}`}
            >
              <AlertCircle className={`h-4 w-4 shrink-0 ${activeTab === 'absence' ? 'text-white' : 'text-slate-400'}`} />
              <span>Absence Regularization</span>
            </button>
          </div>

          {/* Clean minimal indicator */}
          <div className="p-3 bg-slate-900/10 border border-slate-800/20 rounded-xl text-[10px] text-slate-500 text-center font-mono uppercase tracking-wider">
            Connected to Live Supabase
          </div>

        </div>

        {/* Right Active tab workspace content */}
        <div className="md:col-span-9 space-y-6">

          {metricsError && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-455 p-4 rounded-xl text-xs flex flex-col space-y-1.5 animate-pulse">
              <span className="font-extrabold text-[11px] block uppercase tracking-wider text-rose-400">⚠️ Database Sync Error</span>
              <p className="text-slate-300 leading-relaxed font-mono">{metricsError}</p>
            </div>
          )}

          {/* 1. VERIFY ATTENDANCE TAB */}
          {activeTab === 'verify' && (
            <div className="space-y-6">
              
              <div>
                <h2 className="font-display text-2xl font-bold text-white flex items-center">
                  <QrCode className="h-5.5 w-5.5 text-cyan-400 mr-2" />
                  Verify Attendance
                </h2>
                <p className="text-slate-400 text-xs">Verify your presence in active classes dynamically using QR Code or short code tags.</p>
              </div>

              {liveSession ? (
                isStudentVerified ? (
                  /* Attendance Confirmation Screen */
                  <div className="space-y-6 animate-fade-in">
                    {/* Success Header Card */}
                    <div className="glass-panel p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center space-x-4 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                      <div className="h-12 w-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                        <CheckCircle className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-display font-extrabold text-sm text-white uppercase tracking-wider">✅ Attendance Recorded Successfully</h3>
                        <p className="text-slate-300 text-xs mt-0.5">Your presence is verified. Attendance has been successfully recorded in the admin database.</p>
                      </div>
                    </div>

                    {/* ✅ ATTENDANCE CONFIRMATION CARD */}
                    <div className="glass-panel p-6 md:p-8 rounded-2xl bg-slate-950 border border-slate-900 space-y-6">
                      <div className="border-b border-slate-900 pb-4">
                        <h4 className="font-display font-extrabold text-sm tracking-wider text-slate-400 uppercase">✅ Attendance Confirmation</h4>
                        <p className="text-[11px] text-slate-500 mt-1">Verified registration record for the active session.</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 text-xs">
                        {/* Session Name */}
                        <div className="flex flex-col md:col-span-2 py-2 border-b border-slate-900/60 space-y-1">
                          <span className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider">Session Name</span>
                          <span className="text-white text-sm font-extrabold">{liveSession.name}</span>
                        </div>

                        {/* Topic */}
                        <div className="flex flex-col md:col-span-2 py-2 border-b border-slate-900/60 space-y-1">
                          <span className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider">Topic</span>
                          <span className="text-slate-300 leading-relaxed font-medium">
                            {liveSession.description
                              ? liveSession.description
                                  .replace(/\n\[feedback:(optional|mandatory)\]/g, '')
                                  .replace(/\[feedback:(optional|mandatory)\]/g, '')
                              : 'No topic specified'}
                          </span>
                        </div>

                        {/* Hosted By */}
                        <div className="flex justify-between items-center py-2 border-b border-slate-900/60">
                          <span className="text-slate-400 font-semibold">Hosted By</span>
                          <span className="text-white font-semibold">{liveSession.hostedBy || 'Administrator'}</span>
                        </div>

                        {/* Venue */}
                        <div className="flex justify-between items-center py-2 border-b border-slate-900/60">
                          <span className="text-slate-400 font-semibold">Venue</span>
                          <span className="text-white font-semibold">{liveSession.venue || 'Unspecified Room'}</span>
                        </div>

                        {/* Attendance Status */}
                        <div className="flex justify-between items-center py-2 border-b border-slate-900/60">
                          <span className="text-slate-400 font-semibold">Attendance Status</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Present
                          </span>
                        </div>

                        {/* Verification Method */}
                        <div className="flex justify-between items-center py-2 border-b border-slate-900/60">
                          <span className="text-slate-400 font-semibold">Verification Method</span>
                          <span className="text-white font-semibold">
                            {activeAttendance?.method === 'qr' ? 'QR Code' : 'Session Code'}
                          </span>
                        </div>

                        {/* Marked At */}
                        <div className="flex justify-between items-center py-2 border-b border-slate-900/60">
                          <span className="text-slate-400 font-semibold">Marked At</span>
                          <span className="text-cyan-400 font-mono font-bold">
                            {activeAttendance ? formatReportTime(activeAttendance.checkInTime) : formatReportTime(new Date())}
                          </span>
                        </div>

                        {/* Session Duration */}
                        <div className="flex flex-col md:col-span-2 py-2 border-b border-slate-900/60 space-y-1">
                          <span className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider">🕒 Session Duration</span>
                          <span className="text-cyan-400 font-mono font-bold text-sm">
                            {formatSessionEndTime(liveSession.startTime)} → {formatSessionEndTime(liveSession.extendedEndTime || liveSession.endTime)}
                          </span>
                        </div>
                      </div>

                      {/* Success notice */}
                      <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl text-center space-y-1">
                        <p className="text-xs text-emerald-400 font-extrabold tracking-wide uppercase">
                          ✅ Attendance Recorded Successfully
                        </p>
                        <p className="text-xs text-slate-300">
                          Your attendance has already been recorded for this session.
                        </p>
                        <p className="text-xs text-slate-400">
                          No further action is required.
                        </p>
                      </div>

                      {/* Buttons */}
                      <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowSessionDetailsModal(true)}
                          className="flex-1 py-2.5 px-4 rounded-xl border border-slate-800 hover:bg-slate-900 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer flex items-center justify-center space-x-1.5"
                        >
                          <BookOpen className="h-4 w-4" />
                          <span>View Session Details</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('history')}
                          className="flex-1 py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1.5 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                        >
                          <span>← Back to Dashboard</span>
                        </button>
                      </div>
                    </div>

                    {/* Duplicate protection warning card */}
                    <div className="glass-panel p-4 rounded-2xl bg-slate-950/40 border border-slate-900/60 flex items-start space-x-3 text-left">
                      <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                      <div className="space-y-1 text-xs">
                        <h5 className="font-bold text-white">⚠ Attendance Already Recorded</h5>
                        <p className="text-slate-400 text-[11px] leading-relaxed">
                          Your attendance has already been verified for this session. Duplicate attendance is not allowed. Do NOT allow another attendance record.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Standard QR & Token Screen */
                  <div className="space-y-6">
                    {/* LIVE CARD */}
                    <div className="glass-panel p-6 rounded-2xl bg-slate-950 border border-slate-900 overflow-hidden space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-rose-500 font-bold animate-pulse text-sm">
                          <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                          <span>🔴 CURRENT LIVE SESSION</span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-extrabold uppercase tracking-wider">
                          {liveSession.extendedEndTime ? '🏆 SESSION EXTENDED LIVE' : 'SESSION LIVE NOW'}
                        </span>
                      </div>
   
                      <div className="grid md:grid-cols-12 gap-6">
                        {/* Left Column: Details */}
                        <div className="md:col-span-7 space-y-4 text-xs">
                          <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                              <span className="text-slate-400 block font-semibold mb-0.5">Session Name:</span>
                              <span className="text-white text-sm font-extrabold block">{liveSession.name}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block font-semibold mb-0.5">Venue:</span>
                              <span className="text-white text-sm font-semibold block">{liveSession.venue}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block font-semibold mb-0.5">Hosted By:</span>
                              <span className="text-white text-sm font-semibold block">{liveSession.hostedBy}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block font-semibold mb-0.5">Resource Person:</span>
                              <span className="text-white text-sm font-semibold block">{liveSession.resourcePerson}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block font-semibold mb-0.5">Start Time:</span>
                              <span className="text-white font-mono text-sm block">{liveSession.startTime}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block font-semibold mb-0.5">End Time:</span>
                              <span className="text-white font-mono text-sm block">
                                {liveSession.extendedEndTime || liveSession.endTime}
                                {liveSession.extendedEndTime && (
                                  <span className="text-cyan-400 text-[10px] font-bold block mt-0.5">
                                    (EXTENDED from {liveSession.originalEndTime || liveSession.endTime})
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>

                          {/* Status tracker */}
                          <div className="border-t border-slate-900 pt-4 mt-2">
                            <div className="flex items-center space-x-2.5 text-amber-505 font-bold bg-amber-500/5 px-4 py-3 rounded-xl border border-amber-500/10 animate-pulse text-amber-400">
                              <Clock className="h-5 w-5 shrink-0" />
                              <span>Attendance pending in-person verification. Present your student QR code or copied token code to your instructor to register.</span>
                            </div>
                          </div>
                        </div>

                        {/* Right Column: Secure Student Specific Attendance QR */}
                        <div className="md:col-span-12 lg:col-span-5 flex flex-col items-center justify-center bg-slate-950/65 border border-slate-900 p-5 rounded-2xl text-center space-y-4">
                          <div className="text-center">
                            <h4 className="font-display font-extrabold text-white text-xs tracking-wide uppercase font-sans">Verify Attendance</h4>
                            <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                              Scan QR Code or present your Session Code to your instructor to verify attendance.
                            </p>
                          </div>

                          <div className="bg-white p-3.5 rounded-xl shadow-lg relative transform hover:scale-[1.01] transition-all flex items-center justify-center min-h-[178px] min-w-[178px]">
                            {studentToken ? (
                              <QRCodeSVG 
                                value={studentToken}
                                size={150}
                                level="H"
                                includeMargin={false}
                              />
                            ) : tokenLoading ? (
                              <div className="w-[150px] h-[150px] flex flex-col items-center justify-center text-slate-800 font-bold text-[10px] bg-slate-100 rounded-lg p-4 animate-pulse">
                                <span className="text-center text-slate-700">Generating dynamic attendance token...</span>
                              </div>
                            ) : tokenError ? (
                              <div className="w-[150px] h-[150px] flex flex-col items-center justify-center text-rose-600 font-bold text-[9px] bg-rose-50 rounded-lg p-2.5 overflow-hidden select-text text-center border border-rose-300">
                                <span className="uppercase text-[9px] tracking-wider text-rose-700 font-black mb-1 leading-tight">{tokenError}</span>
                                <p className="text-[7.5px] text-slate-500 mt-1 mb-2 leading-tight">
                                  Click below to try loading the token again.
                                </p>
                                <button
                                  id="retry-token-btn"
                                  onClick={() => {
                                    setTokenError(null);
                                    setRetrievedTokenSessionId(null);
                                    lastFetchedSessionIdRef.current = null;
                                    setTick(t => t + 1);
                                  }}
                                  className="mt-1 px-3 py-1.5 text-[8.5px] bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors cursor-pointer uppercase font-black tracking-wider border-none outline-none font-sans"
                                >
                                  Retry
                                </button>
                              </div>
                            ) : (
                              <div className="w-[150px] h-[150px] flex flex-col items-center justify-center text-slate-800 font-bold text-[10px] bg-slate-100 rounded-lg p-4 text-center">
                                <span className="text-slate-600">No token loaded</span>
                                <button
                                  id="retry-token-btn-none"
                                  onClick={() => {
                                    setTokenError(null);
                                    setRetrievedTokenSessionId(null);
                                    lastFetchedSessionIdRef.current = null;
                                    setTick(t => t + 1);
                                  }}
                                  className="mt-2 px-2.5 py-1 text-[8px] bg-slate-800 text-white rounded cursor-pointer font-sans"
                                >
                                  Load Token
                                </button>
                              </div>
                            )}
                          </div>

                          {tokenError && (
                            <div className="w-full text-left bg-rose-950/20 border border-rose-500/15 rounded-xl p-3 text-[10px] font-mono select-text space-y-1.5 animate-fadeIn">
                              <span className="text-rose-400 font-extrabold block text-[10px]">🧰 RLS Policy Troubleshooting Guide</span>
                              <p className="text-slate-400 text-[9px] leading-relaxed">
                                If you see an RLS violation error, run this SQL migration query inside the <b>SQL Editor</b> in your <b>Supabase Dashboard</b> to enable row-level permissions for student tokens:
                              </p>
                              <pre className="bg-slate-900 border border-rose-950 p-2 rounded-lg text-rose-300 overflow-x-auto text-[8px] leading-tight select-all">
{`ALTER TABLE public.attendance_tokens ENABLE ROW LEVEL SECURITY;

-- Approved students SELECT policy
DROP POLICY IF EXISTS "Only approved students can read their own attendance tokens" ON public.attendance_tokens;
CREATE POLICY "Only approved students can read their own attendance tokens"
ON public.attendance_tokens FOR SELECT TO authenticated
USING (
  student_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE public.profiles.id = auth.uid() AND public.profiles.account_status = 'Approved'
  )
);

-- Approved students INSERT policy
DROP POLICY IF EXISTS "Only approved students can insert their own attendance tokens" ON public.attendance_tokens;
CREATE POLICY "Only approved students can insert their own attendance tokens"
ON public.attendance_tokens FOR INSERT TO authenticated
WITH CHECK (
  student_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE public.profiles.id = auth.uid() AND public.profiles.account_status = 'Approved'
  )
);`}
                              </pre>
                              <p className="text-cyan-400 text-[8px] leading-relaxed">
                                After executing the SQL statement, click the <b>Retry</b> button above or refresh the page to generate your active QR code.
                              </p>
                            </div>
                          )}

                          {studentToken && (
                            <div className="w-full space-y-2.5">
                              <div className="text-[10px] font-mono text-cyan-400 bg-cyan-950/20 px-3 py-1.5 rounded-lg border border-cyan-800/20 font-black break-all select-all">
                                Session Code: {studentToken}
                              </div>
                              
                              <button
                                id="copy-token-btn"
                                onClick={() => {
                                  navigator.clipboard.writeText(studentToken);
                                  showToast('Attendance token copied to clipboard!', 'success');
                                }}
                                className="w-full py-2 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[11px] transition-all cursor-pointer flex items-center justify-center space-x-1.5"
                              >
                                <Copy className="h-3.5 w-3.5" />
                                <span>Copy Token</span>
                              </button>
                            </div>
                          )}

                          <span className="text-[10px] text-slate-500 block max-w-[180px] leading-relaxed select-none">
                            "Your QR and Token are valid only until the session ends."
                          </span>
                        </div>
                      </div>

                    </div>
                  </div>
                )
              ) : (
                <div className="glass-panel p-8 text-center flex flex-col items-center justify-center space-y-3.5 bg-slate-950/45 border-slate-900">
                  <div className="h-12 w-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-black text-lg text-white">No Active Session Available</h3>
                    <p className="text-xs text-rose-450 mt-1.5 font-semibold uppercase tracking-wider">No Session Live Currently</p>
                    <p className="text-xs text-slate-400 mt-1">There are currently no active attendance sessions.</p>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* 2. ATTENDANCE HISTORY TAB */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              
              <div>
                <h2 className="font-display text-2xl font-bold text-white flex items-center">
                  <FileCheck className="h-5.5 w-5.5 text-cyan-400 mr-2" />
                  Attendance History
                </h2>
                <p className="text-slate-400 text-xs">Verify logs database confirming student check-ins archives.</p>
              </div>

              {metricsLoading ? (
                <SkeletonLoader />
              ) : attendance.length > 0 ? (
                <div className="glass-panel rounded-2xl overflow-hidden bg-slate-950/45 border-slate-900">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-900/40 text-[10px] uppercase font-bold tracking-widest text-slate-500 border-b border-slate-905">
                          <th className="p-4">Session Name</th>
                          <th className="p-4">Date</th>
                          <th className="p-4">Time logged</th>
                          <th className="p-4">Venue Room</th>
                          <th className="p-4 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs divide-y divide-slate-900/45">
                        {attendance.map(a => {
                          const sessionObj = sessions.find(s => s.id === a.sessionId);
                          return (
                            <tr key={a.id} className="hover:bg-slate-900/10 transition-colors">
                              <td className="p-4 font-semibold text-white">{sessionObj?.name || 'Class Session'}</td>
                              <td className="p-4 font-mono text-slate-400">{sessionObj ? formatReportDate(sessionObj.date) : 'N/A'}</td>
                              <td className="p-4 font-mono text-cyan-400">{formatReportTime(a.checkInTime)}</td>
                              <td className="p-4 text-slate-400">{sessionObj?.venue || 'N/A'}</td>
                              <td className="p-4 text-center">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  VERIFIED ✓
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="glass-panel p-8 text-center flex flex-col items-center justify-center space-y-3 bg-slate-950/45 border-slate-900">
                  <div className="h-12 w-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
                    <FileCheck className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-white text-sm">No Attendance Records Found</h3>
                  <p className="text-xs text-slate-450">Attend active live lectures to populate your check-in register records.</p>
                </div>
              )}

            </div>
          )}

          {/* 3. ASSIGNMENTS TAB */}
          {activeTab === 'assignments' && (
            <div className="space-y-4">
              
              <div>
                <h2 className="font-display text-2xl font-bold text-white flex items-center">
                  <BookOpen className="h-5.5 w-5.5 text-cyan-400 mr-2" />
                  Assignments
                </h2>
                <p className="text-slate-400 text-xs">Examine reading resource materials and upload assignment solutions.</p>
              </div>

              {metricsLoading ? (
                <SkeletonLoader />
              ) : assignments.length > 0 ? (
                <div className="grid md:grid-cols-12 gap-6">
                  {/* Left Column: List */}
                  <div className="md:col-span-5 space-y-4">
                    <span className="text-xs font-bold tracking-widest text-slate-500 uppercase">Available Tasks</span>
                    <div className="space-y-2">
                      {assignments.map(assign => {
                        const sub = submissions.find(s => s.assignmentId === assign.id);
                        const studentStatus = getStudentAssignmentStatus(assign.deadline, sub?.submittedAt);
                        const statusInfo = getAssignmentStatus(assign.deadline);
                        return (
                          <div
                            key={assign.id}
                            onClick={() => {
                              setActiveAssignment(assign);
                              const existingSub = submissions.find(s => s.assignmentId === assign.id);
                              if (existingSub) {
                                setSubmissionForm({
                                  attachedFiles: existingSub.attachedFiles || [],
                                  attachedLinks: (existingSub.attachedLinks || []).join(', ')
                                });
                              } else {
                                setSubmissionForm({ attachedFiles: [], attachedLinks: '' });
                              }
                            }}
                            className={`glass-panel p-4 rounded-xl cursor-pointer transition-all border bg-slate-950/45 ${activeAssignment?.id === assign.id ? 'border-cyan-500 bg-cyan-950/10' : 'border-slate-900 hover:bg-slate-900/10'}`}
                          >
                            <div className="flex justify-between items-start mb-2.5">
                              <div>
                                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">Deadline:</span>
                                <span className="text-[11px] font-bold text-slate-300">
                                  {statusInfo.dueDateString} • {statusInfo.dueTimeString}
                                </span>
                              </div>
                              <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded ${
                                studentStatus === 'Submitted'
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : studentStatus === 'Late Submission'
                                  ? 'bg-amber-500/10 text-amber-500'
                                  : studentStatus === 'Closed'
                                  ? 'bg-rose-500/10 text-rose-450 font-bold'
                                  : 'bg-blue-500/10 text-blue-400'
                              }`}>
                                {studentStatus}
                              </span>
                            </div>
                            
                            <h4 className="font-display font-semibold text-sm text-white mb-2">{assign.title}</h4>
                            
                            <div className="flex justify-between items-center text-[10px] border-t border-slate-900/40 pt-2.5 mt-2">
                              <span className={`font-mono font-medium ${statusInfo.isClosed ? 'text-slate-500' : 'text-cyan-400'}`}>
                                {statusInfo.remainingTimeString}
                              </span>
                              <span className={`font-bold uppercase tracking-wider text-[9px] ${
                                studentStatus === 'Submitted' ? 'text-emerald-400' :
                                studentStatus === 'Late Submission' ? 'text-amber-500' :
                                studentStatus === 'Closed' ? 'text-rose-500' :
                                'text-blue-400'
                              }`}>
                                Status: {studentStatus}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {/* Right Column: Submission Form */}
                  <div className="md:col-span-7">
                    {activeAssignment ? (
                      (() => {
                        const statusInfo = getAssignmentStatus(activeAssignment.deadline);
                        const userSub = submissions.find(s => s.assignmentId === activeAssignment.id);
                        const studentStatus = getStudentAssignmentStatus(activeAssignment.deadline, userSub?.submittedAt);
                        
                        const getCleanLinkLabel = (urlStr: string): string => {
                          try {
                            const url = new URL(urlStr);
                            let host = url.hostname.replace('www.', '');
                            host = host.charAt(0).toUpperCase() + host.slice(1);
                            const pathSegments = url.pathname.split('/').filter(Boolean);
                            if (pathSegments.length > 0) {
                              let lastSegment = pathSegments[pathSegments.length - 1];
                              lastSegment = lastSegment.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
                              if (lastSegment.length > 2) {
                                const cleanSeg = lastSegment.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                                return `${host} – ${cleanSeg}`;
                              }
                            }
                            return `${host} Resource`;
                          } catch (_) {
                            return urlStr;
                          }
                        };

                        const linkedSession = sessions.find(s => s.id === activeAssignment.sessionId);
                        const creatorName = (() => {
                          const creatorId = activeAssignment.createdBy;
                          const cName = activeAssignment.createdByName;
                          const isPlaceholder = (n: string | undefined | null) => {
                            if (!n) return true;
                            const clean = n.trim().toLowerCase();
                            return clean === 'administrator' || clean === 'admin' || clean === 'faculty' || clean === 'user role' || clean === 'system creator' || clean === 'unknown creator' || clean === 'unknown user';
                          };
                          if (cName && !isPlaceholder(cName)) return cName;
                          if (creatorId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(creatorId)) {
                            if (creatorId.trim() && !isPlaceholder(creatorId)) return creatorId;
                          }
                          return 'Administrator';
                        })();

                        const lastUpdatedBy = (() => {
                          const modifierId = activeAssignment.lastModifiedBy;
                          const modifierName = activeAssignment.lastModifiedByName;
                          const creatorName = activeAssignment.createdByName;
                          const isPlaceholder = (n: string | undefined | null) => {
                            if (!n) return true;
                            const clean = n.trim().toLowerCase();
                            return clean === 'administrator' || clean === 'admin' || clean === 'faculty' || clean === 'user role' || clean === 'system creator' || clean === 'unknown creator' || clean === 'unknown user';
                          };
                          if (modifierName && !isPlaceholder(modifierName)) return modifierName;
                          if (modifierId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(modifierId)) {
                            if (modifierId.trim() && !isPlaceholder(modifierId)) return modifierId;
                          }
                          if (creatorName && !isPlaceholder(creatorName)) return creatorName;
                          return 'Administrator';
                        })();

                        const submissionFormat = activeAssignment.attachedLinks && activeAssignment.attachedLinks.length > 0 
                          ? "PDF Document & External Links" 
                          : "PDF / Digital Upload";

                        const systemMessage = userSub
                          ? "Assignment submitted successfully."
                          : statusInfo.isClosed
                          ? "Submission deadline has passed."
                          : "Waiting for student submission.";

                        const submissionDisplayStatus = userSub
                          ? (studentStatus === 'Late Submission' ? 'Submitted (Late)' : 'Submitted Successfully')
                          : statusInfo.isClosed
                          ? 'Submission Closed'
                          : 'Pending Submission';
                        return (
                          <div className="space-y-6">
                            
                            {/* CARD 1: Assignment Overview */}
                            <div className="glass-panel p-5 rounded-2xl bg-slate-950/45 border-slate-900 transition-all duration-300 hover:translate-y-[-2px] hover:shadow-xl text-left">
                              <div className="flex items-center space-x-2 border-b border-slate-900/60 pb-3 mb-4">
                                <span className="text-lg">📘</span>
                                <h3 className="font-display font-bold text-sm sm:text-base text-white">Assignment Overview</h3>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-5 gap-x-8 text-xs text-slate-350">
                                {/* Subject */}
                                <div>
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Subject</span>
                                  <div className="flex items-center space-x-2 text-sm text-slate-200">
                                    <span className="text-base shrink-0">📚</span>
                                    <span className="font-semibold">{activeAssignment.title}</span>
                                  </div>
                                </div>
                                
                                {/* Assignment Status */}
                                <div>
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Assignment Status</span>
                                  <div className="flex items-center space-x-2 text-sm text-slate-200">
                                    <span className="text-sm shrink-0">{statusInfo.status === 'Closed' ? '🔴' : statusInfo.status === 'Due Soon' ? '🟡' : '🟢'}</span>
                                    <span className={`font-semibold ${
                                      statusInfo.status === 'Closed' ? 'text-rose-400' :
                                      statusInfo.status === 'Due Soon' ? 'text-amber-500' :
                                      'text-emerald-400'
                                    }`}>{statusInfo.status}</span>
                                  </div>
                                </div>

                                {/* Submission Status */}
                                <div>
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Submission Status</span>
                                  <div className="flex items-center space-x-2 text-sm text-slate-200">
                                    <span className="text-sm shrink-0">{userSub ? '🟢' : statusInfo.isClosed ? '🔴' : '🔵'}</span>
                                    <span className={`font-semibold ${
                                      userSub ? 'text-emerald-400' :
                                      statusInfo.isClosed ? 'text-rose-400' :
                                      'text-cyan-400'
                                    }`}>
                                      {userSub ? 'Submitted Successfully' : statusInfo.isClosed ? 'Submission Closed' : 'Pending Submission'}
                                    </span>
                                  </div>
                                </div>

                                {/* Due Date */}
                                <div>
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Due Date</span>
                                  <div className="flex items-center space-x-2 text-sm text-slate-200">
                                    <span className="text-base shrink-0">📅</span>
                                    <span className="font-semibold text-slate-200">{statusInfo.dueDateString}</span>
                                  </div>
                                </div>

                                {/* Due Time */}
                                <div>
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Due Time</span>
                                  <div className="flex items-center space-x-2 text-sm text-slate-200">
                                    <span className="text-base shrink-0">🕐</span>
                                    <span className="font-semibold text-slate-200">{statusInfo.dueTimeString}</span>
                                  </div>
                                </div>

                                {/* Remaining Time */}
                                <div>
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Remaining Time</span>
                                  <div className="flex items-center space-x-2 text-sm text-slate-200">
                                    <span className="text-base shrink-0">⏰</span>
                                    <span className={`font-mono font-semibold ${statusInfo.isClosed ? 'text-rose-400' : 'text-cyan-400'}`}>
                                      {statusInfo.isClosed ? 'Closed' : statusInfo.remainingTimeString}
                                    </span>
                                  </div>
                                </div>

                                {/* Assigned By */}
                                <div>
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Assigned By</span>
                                  <div className="flex items-center space-x-2 text-sm text-slate-200">
                                    <span className="text-base shrink-0">👨‍🏫</span>
                                    <span className="font-semibold text-slate-200">{creatorName}</span>
                                  </div>
                                </div>

                                {/* Last Updated By */}
                                <div>
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Last Updated By</span>
                                  <div className="flex items-center space-x-2 text-sm text-slate-200">
                                    <span className="text-base shrink-0">👤</span>
                                    <span className="font-semibold text-slate-200">{lastUpdatedBy}</span>
                                  </div>
                                </div>

                                {/* Linked Session */}
                                <div>
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Linked Session</span>
                                  <div className="flex items-center space-x-2 text-sm text-slate-200">
                                    <span className="text-base shrink-0">📍</span>
                                    <span className="font-semibold text-slate-200">
                                      {linkedSession ? `${linkedSession.name} (${linkedSession.venue})` : 'No Linked Session'}
                                    </span>
                                  </div>
                                </div>

                                {/* Accepted Submission Methods */}
                                <div>
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Accepted Submission Methods</span>
                                  <div className="flex items-center space-x-2 text-sm text-slate-200">
                                    <span className="text-base shrink-0">📤</span>
                                    <span className="font-semibold text-slate-200">PDF • DOCX • ZIP • External Link</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* CARD 2: Assignment Description */}
                            <div className="glass-panel p-5 rounded-2xl bg-slate-950/45 border-slate-900 transition-all duration-300 hover:translate-y-[-2px] hover:shadow-xl text-left">
                              <div className="flex items-center space-x-2 border-b border-slate-900/60 pb-3 mb-4">
                                <span className="text-lg">📖</span>
                                <h3 className="font-display font-bold text-sm sm:text-base text-white">Assignment Description</h3>
                              </div>
                              <div className="text-sm sm:text-base text-slate-300 leading-relaxed font-sans whitespace-pre-wrap break-words">
                                {activeAssignment.description}
                              </div>
                            </div>

                            {/* CARD 3: Reference Resources */}
                            {((activeAssignment.attachedFiles && activeAssignment.attachedFiles.length > 0) || 
                              (activeAssignment.attachedLinks && activeAssignment.attachedLinks.length > 0)) && (
                              <div className="glass-panel p-5 rounded-2xl bg-slate-950/45 border-slate-900 transition-all duration-300 hover:translate-y-[-2px] hover:shadow-xl text-left space-y-4">
                                <div className="flex items-center space-x-2 border-b border-slate-900/60 pb-3">
                                  <span className="text-lg">📚</span>
                                  <h3 className="font-display font-bold text-sm sm:text-base text-white">Reference Resources</h3>
                                </div>
                                
                                <div className="space-y-2.5">
                                  {/* Attached Files */}
                                  {activeAssignment.attachedFiles && activeAssignment.attachedFiles.map((file, idx) => (
                                    <div key={`file-${idx}`} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-900/40 hover:bg-slate-900/70 border border-slate-800 rounded-xl transition-all gap-3">
                                      <div className="flex items-center space-x-2.5 truncate">
                                        <span className="text-base shrink-0">📄</span>
                                        <div className="truncate text-left">
                                          <p className="text-xs font-semibold text-white truncate">{file.name}</p>
                                          <p className="text-[10px] text-slate-500 font-mono">PDF Document {file.size ? `• ${file.size}` : ''}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center space-x-2 shrink-0 justify-end">
                                        <button
                                          onClick={() => storageService.openFile(file.url, file.name)}
                                          className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 hover:text-white rounded-lg flex items-center space-x-1 cursor-pointer transition-all"
                                        >
                                          <Eye className="h-3 w-3 text-slate-400" />
                                          <span>View</span>
                                        </button>
                                        <button
                                          onClick={() => storageService.openFile(file.url, file.name)}
                                          className="px-2.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-[11px] text-cyan-400 hover:text-cyan-300 rounded-lg flex items-center space-x-1 cursor-pointer transition-all"
                                        >
                                          <Download className="h-3 w-3" />
                                          <span>Download</span>
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                  
                                  {/* Attached Links */}
                                  {activeAssignment.attachedLinks && activeAssignment.attachedLinks.map((lnk, idx) => (
                                    <div key={`link-${idx}`} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-900/40 hover:bg-slate-900/70 border border-slate-800 rounded-xl transition-all gap-3">
                                      <div className="flex items-center space-x-2.5 truncate">
                                        <span className="text-base shrink-0">🌐</span>
                                        <div className="truncate text-left">
                                          <p className="text-xs font-semibold text-white truncate">{getCleanLinkLabel(lnk)}</p>
                                          <p className="text-[10px] text-slate-500 truncate font-mono">{lnk}</p>
                                        </div>
                                      </div>
                                      <a
                                        href={lnk}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-2.5 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-[11px] text-purple-400 hover:text-purple-300 rounded-lg flex items-center space-x-1 cursor-pointer transition-all shrink-0 text-center justify-center"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                        <span>Open Resource</span>
                                      </a>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* CARD 4: Submission Status */}
                            <div className="glass-panel p-5 rounded-2xl bg-slate-950/45 border-slate-900 transition-all duration-300 hover:translate-y-[-2px] hover:shadow-xl text-left space-y-4">
                              <div className="flex items-center space-x-2 border-b border-slate-900/60 pb-3">
                                <span className="text-lg">📤</span>
                                <h3 className="font-display font-bold text-sm sm:text-base text-white">Submission Status</h3>
                              </div>

                              <div className="space-y-4 text-xs text-slate-350">
                                {userSub ? (
                                  <div className="space-y-3">
                                    <div className="flex items-center space-x-2 text-sm font-bold text-emerald-400">
                                      <span>🟢</span>
                                      <span>{studentStatus === 'Late Submission' ? 'Submitted (Late)' : 'Submitted Successfully'}</span>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-900/20 p-4 border border-slate-900/85 rounded-xl">
                                      <div>
                                        <span className="text-[10px] text-slate-500 block font-mono uppercase tracking-wider mb-0.5">Submitted On</span>
                                        <span className="font-semibold text-slate-200">
                                          {new Date(userSub.submittedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}{' '}
                                          {new Date(userSub.submittedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-[10px] text-slate-500 block font-mono uppercase tracking-wider mb-0.5">Submission Type</span>
                                        <span className="font-semibold text-slate-200">
                                          {userSub.attachedFiles && userSub.attachedFiles.length > 0 && userSub.attachedLinks && userSub.attachedLinks.length > 0
                                            ? 'PDF & Links'
                                            : userSub.attachedFiles && userSub.attachedFiles.length > 0
                                            ? 'PDF'
                                            : 'Web Link'}
                                        </span>
                                      </div>
                                      <div className="sm:col-span-2">
                                        <span className="text-[10px] text-slate-500 block font-mono uppercase tracking-wider mb-0.5">Current Status</span>
                                        <span className="font-semibold text-slate-200">Submitted</span>
                                      </div>
                                    </div>
                                  </div>
                                ) : statusInfo.isClosed ? (
                                  <div className="space-y-2">
                                    <div className="flex items-center space-x-2 text-sm font-bold text-rose-450">
                                      <span>🔴</span>
                                      <span>Submission Closed</span>
                                    </div>
                                    <p className="text-slate-400 leading-relaxed text-xs">
                                      The submission deadline has passed. Submissions are no longer accepted.
                                    </p>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    <div className="flex items-center space-x-2 text-sm font-bold text-cyan-400">
                                      <span>🔵</span>
                                      <span>Pending Submission</span>
                                    </div>
                                    <p className="text-slate-400 leading-relaxed text-xs">
                                      Please upload your files or links below to submit your assignment.
                                    </p>
                                  </div>
                                )}

                                {/* Submission Form (ONLY if open) */}
                                {!statusInfo.isClosed && (
                                  <form onSubmit={handleSubmissionSubmit} className="space-y-4 pt-4 border-t border-slate-900/50">
                                    {userSub && (
                                      <div className="bg-cyan-500/5 border border-cyan-500/10 p-3 rounded-xl text-[11px] text-cyan-400">
                                        <span>💡 Live Editing: You have already submitted. Making changes below and submitting will replace previous details and update your active version.</span>
                                      </div>
                                    )}

                                    <div>
                                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">External links (Optional, Comma separated)</label>
                                      <input
                                        type="text"
                                        placeholder="e.g. https://github.com/account/repo"
                                        value={submissionForm.attachedLinks}
                                        onChange={(e) => setSubmissionForm({...submissionForm, attachedLinks: e.target.value})}
                                        className="w-full px-3 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-900 focus:border-cyan-500 text-white rounded-xl text-xs transition-all duration-200 outline-none"
                                      />
                                    </div>

                                    <div>
                                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Attach Hand-in Files (PDF, ZIP, DOCX)</label>
                                      <div className="relative">
                                        <input
                                          type="file"
                                          multiple
                                          disabled={uploading || isSubmittingSubmission}
                                          onChange={handleSubmissionsFileUpload}
                                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                                        />
                                        <div className="p-4 bg-slate-950/50 hover:bg-slate-900/50 border border-dashed border-slate-800 hover:border-cyan-500/40 rounded-xl flex flex-col items-center justify-center text-xs text-slate-400 transition-all cursor-pointer">
                                          {uploading ? (
                                            <RefreshCw className="h-5 w-5 animate-spin text-cyan-400 mb-1.5" />
                                          ) : (
                                            <Plus className="h-5 w-5 text-cyan-400 mb-1.5" />
                                          )}
                                          <span className="text-center text-[11px]">{uploading ? 'Transmitting academic data to cloud storage...' : 'Click or drop submission documents'}</span>
                                        </div>
                                      </div>

                                      {/* Upload Progress */}
                                      {uploading && (
                                        <div className="w-full flex flex-col items-center space-y-1 mt-2.5">
                                          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
                                            <div 
                                              className="bg-cyan-500 h-1.5 rounded-full transition-all duration-300" 
                                              style={{ width: `${uploadProgress ?? 0}%` }}
                                            />
                                          </div>
                                          <span className="text-[10px] text-cyan-400 font-mono font-bold animate-pulse">
                                            Uploading... {uploadProgress ?? 0}%
                                          </span>
                                        </div>
                                      )}

                                      {/* Attached Files List */}
                                      {submissionForm.attachedFiles.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                                          {submissionForm.attachedFiles.map((file, idx) => (
                                            <div key={idx} className="bg-slate-900 border border-slate-800 text-[10px] px-2 py-1 rounded-lg text-slate-300 flex items-center space-x-1">
                                              <span className="truncate max-w-[120px]">{file.name}</span>
                                              <button 
                                                type="button" 
                                                onClick={() => {
                                                  setSubmissionForm({
                                                    ...submissionForm,
                                                    attachedFiles: submissionForm.attachedFiles.filter((_, i) => i !== idx)
                                                  });
                                                }}
                                                className="text-slate-500 hover:text-white font-bold"
                                              >
                                                &times;
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    <button
                                      type="submit"
                                      disabled={uploading || isSubmittingSubmission}
                                      className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1.5"
                                    >
                                      {(uploading || isSubmittingSubmission) && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                                      <span>{isSubmittingSubmission ? 'Submitting homework archive...' : uploading ? 'Waiting for file uploads...' : userSub ? 'Update & Resubmit Assignment (v' + ((userSub.version || 1) + 1) + ')' : 'Submit Assignment'}</span>
                                    </button>
                                  </form>
                                )}
                              </div>
                            </div>

                            {/* CARD 5: Submitted Files */}
                            {userSub && ((userSub.attachedFiles && userSub.attachedFiles.length > 0) || (userSub.attachedLinks && userSub.attachedLinks.length > 0)) && (
                              <div className="glass-panel p-5 rounded-2xl bg-slate-950/45 border-slate-900 transition-all duration-300 hover:translate-y-[-2px] hover:shadow-xl text-left space-y-4">
                                <div className="flex items-center space-x-2 border-b border-slate-900/60 pb-3">
                                  <span className="text-lg">📄</span>
                                  <h3 className="font-display font-bold text-sm sm:text-base text-white">Submitted Files</h3>
                                </div>

                                <div className="space-y-2.5">
                                  {/* Submitted Files */}
                                  {userSub.attachedFiles && userSub.attachedFiles.map((file, idx) => (
                                    <div key={`sub-file-${idx}`} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-900/40 hover:bg-slate-900/70 border border-slate-800 rounded-xl transition-all gap-3">
                                      <div className="flex items-center space-x-2.5 truncate">
                                        <span className="text-base shrink-0">📄</span>
                                        <div className="truncate text-left">
                                          <p className="text-xs font-semibold text-white truncate">{file.name}</p>
                                          <p className="text-[10px] text-slate-500 font-mono">PDF Document {file.size ? `• ${file.size}` : ''}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center space-x-2 shrink-0 justify-end">
                                        <button
                                          onClick={() => storageService.openFile(file.url, file.name)}
                                          className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 hover:text-white rounded-lg flex items-center space-x-1 cursor-pointer transition-all"
                                        >
                                          <Eye className="h-3 w-3 text-slate-400" />
                                          <span>View</span>
                                        </button>
                                        <button
                                          onClick={() => storageService.openFile(file.url, file.name)}
                                          className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-[11px] text-emerald-400 hover:text-emerald-300 rounded-lg flex items-center space-x-1 cursor-pointer transition-all"
                                        >
                                          <Download className="h-3 w-3" />
                                          <span>Download</span>
                                        </button>
                                      </div>
                                    </div>
                                  ))}

                                  {/* Submitted Links */}
                                  {userSub.attachedLinks && userSub.attachedLinks.map((lnk, idx) => (
                                    <div key={`sub-lnk-${idx}`} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-900/40 hover:bg-slate-900/70 border border-slate-800 rounded-xl transition-all gap-3">
                                      <div className="flex items-center space-x-2.5 truncate">
                                        <span className="text-base shrink-0">🌐</span>
                                        <div className="truncate text-left">
                                          <p className="text-xs font-semibold text-white truncate">{getCleanLinkLabel(lnk)}</p>
                                          <p className="text-[10px] text-slate-500 truncate font-mono">{lnk}</p>
                                        </div>
                                      </div>
                                      <a
                                        href={lnk}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-2.5 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-[11px] text-purple-400 hover:text-purple-300 rounded-lg flex items-center space-x-1 cursor-pointer transition-all shrink-0 text-center justify-center"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                        <span>Open Link</span>
                                      </a>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ) : (
                      <div className="glass-panel p-6 rounded-2xl text-center text-slate-500 text-xs bg-slate-950/45 border-slate-900">
                        Choose a task target from the assignment list to write solutions.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="glass-panel p-8 text-center flex flex-col items-center justify-center space-y-3 bg-slate-950/45 border-slate-900">
                  <div className="h-12 w-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-white text-sm">No Assignments</h3>
                  <p className="text-xs text-slate-450 mt-1">Assignments will appear here.</p>
                </div>
              )}

            </div>
          )}

          {/* 4. SESSION SUMMARIES & FEEDBACK TAB */}
          {activeTab === 'feedback' && (
            <div className="space-y-4">
              
              <div>
                <h2 className="font-display text-2xl font-bold text-white flex items-center">
                  <Send className="h-5.5 w-5.5 text-cyan-400 mr-2" />
                  Session Summaries & Feedback
                </h2>
                <p className="text-slate-400 text-xs">File academic summaries, learnings, and performance surveys for lectures.</p>
              </div>

              {metricsLoading ? (
                <SkeletonLoader />
              ) : attendance.length > 0 ? (
                <div className="grid md:grid-cols-12 gap-6">
                  {/* Left list */}
                  <div className="md:col-span-5 space-y-4">
                    <span className="text-xs font-bold tracking-widest text-slate-500 uppercase">Sessions Checked In</span>
                    <div className="space-y-2">
                      {attendance.map(a => {
                        const sessObj = sessions.find(s => s.id === a.sessionId);
                        if (!sessObj) return null;
                        const filled = hasSummaryForSession(sessObj.id);
                        const windowStatus = getFeedbackWindowStatus(sessObj);

                        return (
                          <div
                            key={sessObj.id}
                            onClick={() => {
                              setActiveSessionSummary(sessObj);
                              setSummaryForm({ 
                                summary: '', 
                                learnings: '', 
                                reflections: '', 
                                suggestions: '', 
                                feedback: '',
                                rating: 0,
                                contentQualityRating: 0,
                                instructorRating: 0,
                                relevanceRating: 0,
                                engagementRating: 0,
                                learningImpact: 'Significant Improvement',
                                confidenceLevel: 'Intermediate'
                              });
                            }}
                            className={`glass-panel p-4 rounded-xl cursor-pointer border transition-all bg-slate-950/45 ${activeSessionSummary?.id === sessObj.id ? 'border-cyan-500 bg-cyan-950/10' : 'border-slate-900 hover:bg-slate-900/10'}`}
                          >
                            <div className="flex justify-between items-start mb-1.5">
                              <span className="text-[10px] font-mono text-slate-400">{sessObj.date}</span>
                              <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded ${
                                filled 
                                  ? 'bg-emerald-500/10 text-emerald-400' 
                                  : windowStatus.isLocked
                                  ? 'bg-slate-900 text-slate-500 border border-slate-800'
                                  : windowStatus.isExpired 
                                  ? 'bg-rose-500/10 text-rose-450 border border-rose-500/10' 
                                  : windowStatus.isReopened
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-purple-500/10 text-purple-400'
                              }`}>
                                {filled ? 'Reflected' : windowStatus.isLocked ? 'Ongoing 🔒' : windowStatus.isExpired ? 'Expired' : windowStatus.isReopened ? 'Reopened' : 'Reflect Now'}
                              </span>
                            </div>
                            <h4 className="font-bold text-xs text-white">{sessObj.name}</h4>
                            
                            {/* Deadline display */}
                            {!filled && (
                              <div className="flex items-center space-x-1 mt-2 text-[9.5px]">
                                <Clock className={`h-3 w-3 ${windowStatus.isLocked ? 'text-slate-500' : windowStatus.isExpired ? 'text-rose-400' : 'text-cyan-400'}`} />
                                <span className={windowStatus.isLocked ? 'text-slate-500 font-medium' : windowStatus.isExpired ? 'text-rose-400 font-bold' : 'text-cyan-400 font-bold'}>
                                  {windowStatus.isLocked ? 'Unlocks when class ends' : windowStatus.remainingText}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right form */}
                  <div className="md:col-span-7">
                    {activeSessionSummary ? (() => {
                      const windowStatus = getFeedbackWindowStatus(activeSessionSummary);
                      const isExpired = windowStatus.isExpired;
                      const isSubmitted = hasSummaryForSession(activeSessionSummary.id);
                      const existingSummary = summaries.find(s => s.sessionId === activeSessionSummary.id);

                      return (
                        <div className="glass-panel p-5 rounded-2xl bg-slate-950/45 border-slate-900 space-y-4">
                          <div className="border-b border-slate-900/60 pb-2 flex justify-between items-start gap-4">
                            <div>
                              <span className="text-[10px] font-mono text-cyan-400 uppercase">SESSION SURVEY FIELD</span>
                              <h3 className="font-display font-extrabold text-base text-white">{activeSessionSummary.name}</h3>
                              <p className="text-[11px] text-slate-450 mt-1">Character limits: Min 30 characters required under summary & learnings.</p>
                            </div>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-extrabold shrink-0 ${windowStatus.badgeClass}`}>
                              {windowStatus.statusText}
                            </span>
                          </div>

                          {isSubmitted && !isEditingFeedback ? (
                            <div className="bg-emerald-500/5 border border-emerald-500/10 p-5 rounded-xl text-xs space-y-3">
                              <div className="flex items-center space-x-2 text-emerald-400">
                                <CheckCircle className="h-5 w-5 text-emerald-400" />
                                <span className="font-extrabold text-sm text-emerald-400">✓ Feedback Submitted</span>
                              </div>
                              {existingSummary?.submittedAt && (
                                <p className="text-[11px] text-slate-400 font-mono">
                                  Submitted At: {new Date(existingSummary.submittedAt).toLocaleString('en-US', {
                                    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
                                  })}
                                </p>
                              )}
                              <p className="text-[11px] text-slate-400 leading-relaxed">
                                Your class feedback and evaluation ratings have been recorded in the database.
                              </p>

                              {!isExpired ? (
                                <div className="pt-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (existingSummary) {
                                        setSummaryForm({
                                          summary: existingSummary.summary || "Class feedback filed via rating system.",
                                          learnings: existingSummary.learnings || "Class feedback filed via rating system.",
                                          reflections: existingSummary.reflections || "Flipped learning session conducted.",
                                          suggestions: existingSummary.suggestions || "None.",
                                          feedback: existingSummary.feedback || "",
                                          rating: existingSummary.rating || 5,
                                          contentQualityRating: existingSummary.contentQualityRating || existingSummary.rating || 5,
                                          instructorRating: existingSummary.instructorRating || existingSummary.rating || 5,
                                          relevanceRating: existingSummary.relevanceRating || existingSummary.rating || 5,
                                          engagementRating: existingSummary.engagementRating || existingSummary.rating || 5,
                                          learningImpact: existingSummary.learningImpact || "Significant Improvement",
                                          confidenceLevel: existingSummary.confidenceLevel || "Intermediate"
                                        });
                                        setIsEditingFeedback(true);
                                      }
                                    }}
                                    className="px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-400 text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                    <span>Edit Feedback</span>
                                  </button>
                                </div>
                              ) : (
                                <div className="bg-rose-500/5 border border-rose-500/10 p-3 rounded-xl text-xs text-rose-400 mt-2 space-y-1">
                                  <div className="flex items-center space-x-1.5 font-bold">
                                    <Lock className="h-4 w-4" />
                                    <span>🔒 Feedback Closed</span>
                                  </div>
                                  <p className="text-[11px] text-slate-400">
                                    Feedback can no longer be edited because the submission window has expired.
                                  </p>
                                </div>
                              )}
                            </div>
                          ) : windowStatus.isLocked ? (
                            <div className="bg-slate-900/10 border border-slate-800 p-6 rounded-xl text-xs text-center space-y-4">
                              <Lock className="h-10 w-10 text-slate-500 mx-auto animate-pulse" />
                              <div className="space-y-1.5">
                                <span className="font-extrabold text-sm block text-slate-300">Feedback Form Locked 🔒</span>
                                <p className="text-[11px] text-slate-400 leading-relaxed max-w-sm mx-auto">
                                  This session is currently active/running. The feedback submission form will automatically unlock on <strong>{windowStatus.endDateTime.toLocaleDateString()}</strong> at <strong>{windowStatus.endDateTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</strong> when the class completely concludes.
                                </p>
                              </div>
                            </div>
                          ) : isExpired && !isEditingFeedback ? (
                            <div className="bg-rose-500/5 border border-rose-500/10 p-5 rounded-xl text-xs space-y-4 text-center">
                              <XCircle className="h-10 w-10 text-rose-500 mx-auto" />
                              <div>
                                <span className="font-extrabold text-sm block text-rose-400">Feedback submission has closed.</span>
                                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                                  The feedback window for this session closed on {windowStatus.deadline.toLocaleDateString()} at {windowStatus.deadline.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}.
                                </p>
                              </div>
                            </div>
                          ) : (
                            <form onSubmit={handleSummarySubmit} className="space-y-4 pt-1">
                              {isEditingFeedback && (
                                <div className="flex items-center justify-between bg-cyan-500/10 border border-cyan-500/20 p-3 rounded-xl text-xs">
                                  <div className="flex items-center space-x-2 text-cyan-400 font-bold">
                                    <Edit2 className="h-4 w-4" />
                                    <span>Editing Submitted Feedback</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setIsEditingFeedback(false)}
                                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-[11px] font-bold cursor-pointer"
                                  >
                                    Cancel Edit
                                  </button>
                                </div>
                              )}

                              {/* Display remaining countdown in form */}
                              <div className="flex items-center space-x-1.5 p-2 bg-cyan-950/10 border border-cyan-900/40 rounded-xl text-[11px]">
                                <Clock className="h-4 w-4 text-cyan-400" />
                                <span className="text-white font-bold">Feedback Deadline in:</span>
                                <span className="font-mono text-cyan-400 font-black tracking-wide ml-1">{windowStatus.remainingText}</span>
                              </div>

                              {/* Star Ratings Row */}
                              <div className="grid sm:grid-cols-2 gap-3">
                                {renderStarRating('Overall Session Rating', summaryForm.rating, (v) => setSummaryForm(prev => ({ ...prev, rating: v })), true)}
                                {renderStarRating('⭐ Content Quality', summaryForm.contentQualityRating, (v) => setSummaryForm(prev => ({ ...prev, contentQualityRating: v })))}
                                {renderStarRating('⭐ Instructor Explanation', summaryForm.instructorRating, (v) => setSummaryForm(prev => ({ ...prev, instructorRating: v })))}
                                {renderStarRating('⭐ Practical Relevance', summaryForm.relevanceRating, (v) => setSummaryForm(prev => ({ ...prev, relevanceRating: v })))}
                              </div>
                            <div className="grid grid-cols-1">
                              {renderStarRating('⭐ Engagement & Interaction', summaryForm.engagementRating, (v) => setSummaryForm(prev => ({ ...prev, engagementRating: v })))}
                            </div>

                            {/* Optional Comments */}
                            <div>
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center">
                                <span>💡 Additional Comments (Optional)</span>
                              </label>
                              <textarea
                                placeholder="Share any additional feedback, suggestions, or observations."
                                value={summaryForm.feedback}
                                onChange={(e) => setSummaryForm({...summaryForm, feedback: e.target.value})}
                                className="glass-input w-full p-2.5 rounded-xl text-xs mt-1.5 h-20 bg-slate-900 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
                              />
                            </div>

                            {/* 📈 Learning Impact */}
                            <div className="space-y-1.5 bg-slate-900/40 p-3 rounded-xl border border-slate-900">
                              <div className="flex items-center space-x-1.5 text-slate-300 font-bold text-[11px] uppercase tracking-wider">
                                <Award className="h-3.5 w-3.5 text-cyan-400" />
                                <span>📈 Learning Impact</span>
                              </div>
                              <p className="text-[10.5px] text-slate-400">How much did this session improve your understanding of the topic?</p>
                              <div className="grid grid-cols-2 gap-2 mt-1.5">
                                {['Significant Improvement', 'Moderate Improvement', 'Slight Improvement', 'No Improvement'].map((opt) => (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => setSummaryForm(prev => ({ ...prev, learningImpact: opt }))}
                                    className={`px-2.5 py-1.5 rounded-lg text-left text-[11.5px] border transition-all duration-150 cursor-pointer ${
                                      summaryForm.learningImpact === opt
                                        ? 'bg-cyan-500/10 border-cyan-500 text-white'
                                        : 'bg-slate-950 border-slate-800 text-slate-450 hover:bg-slate-905'
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* 🚀 Confidence Level */}
                            <div className="space-y-1.5 bg-slate-900/40 p-3 rounded-xl border border-slate-900">
                              <div className="flex items-center space-x-1.5 text-slate-300 font-bold text-[11px] uppercase tracking-wider">
                                <Award className="h-3.5 w-3.5 text-cyan-400" />
                                <span>🚀 Confidence Level After Session</span>
                              </div>
                              <p className="text-[10.5px] text-slate-400">After attending this session, how confident do you feel about the topic?</p>
                              <div className="grid grid-cols-3 gap-2 mt-1.5">
                                {['Beginner', 'Intermediate', 'Advanced'].map((opt) => (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => setSummaryForm(prev => ({ ...prev, confidenceLevel: opt }))}
                                    className={`px-2.5 py-1.5 rounded-lg text-center text-[11.5px] border transition-all duration-150 cursor-pointer ${
                                      summaryForm.confidenceLevel === opt
                                        ? 'bg-cyan-500/10 border-cyan-500 text-white font-bold'
                                        : 'bg-slate-950 border-slate-800 text-slate-450 hover:bg-slate-905'
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            </div>

                             <div className="pt-2">
                              <button
                                type="submit"
                                disabled={isSubmittingSummary}
                                className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1.5"
                              >
                                {isSubmittingSummary && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                                <span>{isSubmittingSummary ? 'Filing evaluation in database...' : isEditingFeedback ? 'Update Session Feedback' : 'Submit Session Feedback'}</span>
                              </button>
                            </div>
                            </form>
                          )}

                          {!windowStatus.isLocked && renderSessionStatistics(activeSessionSummary)}
                        </div>
                      );
                    })() : (
                      <div className="glass-panel p-6 rounded-2xl text-center text-slate-500 text-xs bg-slate-950/45 border-slate-900">
                        Select a class on the left timeline list to give feedback.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="glass-panel p-8 text-center flex flex-col items-center justify-center space-y-3 bg-slate-950/45 border-slate-900">
                  <div className="h-12 w-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
                    <Send className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-white text-sm block">No Session Summaries Available</h3>
                  <span className="font-semibold text-slate-500 text-xs block">No Feedback Submitted</span>
                  <p className="text-xs text-slate-450 mt-1">Please register checks for live courses first to be eligible to post feedback logs.</p>
                </div>
              )}

            </div>
          )}

          {/* 5. NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <div className="space-y-4">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-bold text-white flex items-center">
                    <Bell className="h-5.5 w-5.5 text-cyan-400 mr-2" />
                    Notifications
                  </h2>
                  <p className="text-slate-400 text-xs">Official academic notifications and news broadcasted by event administrators.</p>
                </div>

                {notifications.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <button
                      id="student-mark-all-btn"
                      onClick={handleMarkAllAsRead}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/30 text-slate-300 hover:text-cyan-400 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Mark All As Read</span>
                    </button>
                    <button
                      id="student-clear-all-btn"
                      onClick={() => setShowClearConfirm(true)}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/30 text-slate-300 hover:text-amber-400 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Clear All</span>
                    </button>
                  </div>
                )}
              </div>

              {metricsLoading ? (
                <SkeletonLoader />
              ) : notifications.length > 0 ? (
                <div className="space-y-4">
                  <AnimatePresence initial={false}>
                    {notifications.map(notif => {
                      const isRead = notif.readBy && notif.readBy.includes(studentProfile.id);
                      const { icon: CategoryIcon, emoji, colorClass, badgeBg, badgeText } = getNotificationCategoryInfo(notif.title, notif.message);

                      let displayTitle = notif.title;
                      let displayMessage = notif.message;
                      if (notif.title.toLowerCase().includes('account approved') || notif.message.toLowerCase().includes('your account has been approved')) {
                        displayTitle = '🎉 Account Approved';
                        displayMessage = `Congratulations!\nYour account has been approved successfully.\nYou now have full access to Smart Attendance Hub.\nEnjoy exploring attendance, assignments, sessions, reports, and all available student features.`;
                      } else if (!displayTitle.includes(emoji) && emoji !== '🔔') {
                        displayTitle = `${emoji} ${displayTitle}`;
                      }

                      if (notif.title.toLowerCase().includes('feedback deadline extended') || notif.title.toLowerCase().includes('feedback extended')) {
                        const hasSubmitted = summaries.some(s => s.studentId === studentProfile.id || s.studentUsn === studentProfile.usn);
                        if (hasSubmitted) {
                          if (!displayMessage.includes("You may edit your feedback")) {
                            displayMessage += "\n\nYou may edit your feedback until the new deadline.";
                          }
                        } else {
                          if (!displayMessage.includes("You can still submit your feedback")) {
                            displayMessage += "\n\nYou can still submit your feedback before the new deadline.";
                          }
                        }
                      }

                      const isFeedbackNotif = notif.title.toLowerCase().includes('feedback') || notif.message.toLowerCase().includes('feedback');
                      const isAssignmentNotif = notif.title.toLowerCase().includes('assignment') || notif.message.toLowerCase().includes('assignment');

                      return (
                        <motion.div
                          key={notif.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.96, x: -15 }}
                          transition={{ duration: 0.25, ease: "easeOut" }}
                          onClick={() => {
                            if (!isRead) handleMarkIndividualAsRead(notif.id);
                            if (isFeedbackNotif) setActiveTab('feedback');
                            if (isAssignmentNotif) setActiveTab('assignments');
                          }}
                          className={`p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col md:flex-row gap-4 items-start ${
                            (isFeedbackNotif || isAssignmentNotif) ? 'cursor-pointer' : ''
                          } ${
                            theme === 'dark'
                              ? (isRead 
                                  ? 'bg-slate-950/40 border-slate-900/60 hover:bg-slate-900/30 shadow-sm opacity-80' 
                                  : 'bg-slate-900 border-slate-800/85 hover:bg-slate-850/90 shadow-[0_4px_20px_rgba(6,182,212,0.05)]')
                              : (isRead 
                                  ? 'bg-slate-50/70 border-slate-200 shadow-sm opacity-90 hover:bg-slate-100/50' 
                                  : 'bg-blue-500/5 border-blue-200/50 hover:bg-blue-500/10 shadow-[0_4px_16px_rgba(59,130,246,0.02)]')
                          }`}
                        >
                          {/* Unread Indicator Dot */}
                          {!isRead && (
                            <div className="absolute top-4 right-4 flex items-center">
                              <motion.span 
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0 }}
                                className="h-2.5 w-2.5 rounded-full bg-blue-500 dark:bg-cyan-450 shadow-[0_0_8px_rgba(6,182,212,0.6)]" 
                                title="Unread" 
                              />
                            </div>
                          )}

                          {/* Category Icon Badge */}
                          <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-300 ${
                            theme === 'dark'
                              ? (isRead 
                                  ? 'bg-slate-950 border-slate-900 text-slate-500' 
                                  : `${badgeBg} ${badgeText} ${colorClass}`)
                              : (isRead 
                                  ? 'bg-slate-100 border-slate-200 text-slate-400' 
                                  : `${badgeBg} ${badgeText} ${colorClass}`)
                          }`}>
                            <CategoryIcon className="h-5.5 w-5.5" />
                          </div>

                          {/* Content */}
                          <div className="flex-1 space-y-2 min-w-0 w-full text-left">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                              <h4 className={`text-sm sm:text-base tracking-tight font-sans transition-all duration-300 ${
                                theme === 'dark'
                                  ? (isRead ? 'font-medium text-slate-400' : 'font-bold text-white')
                                  : (isRead ? 'font-medium text-slate-600' : 'font-bold text-slate-900')
                              }`}>
                                {displayTitle}
                              </h4>
                            </div>

                            <p className={`text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap font-sans transition-all duration-300 ${
                              theme === 'dark'
                                ? (isRead ? 'text-slate-500' : 'text-slate-200')
                                : (isRead ? 'text-slate-500' : 'text-slate-700')
                            }`}>
                              {displayMessage}
                            </p>

                            {/* Footer block with Timestamp & Actions */}
                            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t mt-2 ${
                              theme === 'dark' ? 'border-slate-900/60' : 'border-slate-200/50'
                            }`}>
                              <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-450 dark:text-slate-500">
                                <Clock className="h-3.5 w-3.5" />
                                <span>{getFriendlyTimestamp(notif.createdAt)}</span>
                              </div>

                              <div className="flex items-center gap-2">
                                {isFeedbackNotif && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!isRead) handleMarkIndividualAsRead(notif.id);
                                      setActiveTab('feedback');
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs font-bold transition-all cursor-pointer font-sans"
                                  >
                                    <span>Go to Feedback →</span>
                                  </button>
                                )}
                                {isAssignmentNotif && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!isRead) handleMarkIndividualAsRead(notif.id);
                                      setActiveTab('assignments');
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs font-bold transition-all cursor-pointer font-sans"
                                  >
                                    <span>View Assignment →</span>
                                  </button>
                                )}
                                {!isRead && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMarkIndividualAsRead(notif.id);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-cyan-500/20 bg-blue-500/10 dark:bg-cyan-500/5 hover:bg-blue-500/20 dark:hover:bg-cyan-500/10 text-blue-600 dark:text-cyan-400 hover:text-blue-700 dark:hover:text-cyan-300 text-xs font-bold transition-all cursor-pointer font-sans"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                    <span>Mark as Read</span>
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteIndividual(notif.id);
                                  }}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-transparent text-xs transition-all cursor-pointer font-sans ${
                                    theme === 'dark'
                                      ? 'text-rose-400/80 hover:text-rose-400 hover:border-rose-500/20 hover:bg-rose-500/5'
                                      : 'text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-500/5'
                                  }`}
                                  title="Delete notification"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="glass-panel p-8 text-center flex flex-col items-center justify-center space-y-3 bg-slate-950/45 border-slate-900">
                  <div className="h-12 w-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
                    <Bell className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-white text-sm mt-1">No Notifications</h3>
                  <p className="text-xs text-slate-450 mt-1">You're all caught up.</p>
                </div>
              )}

            </div>
          )}

          {/* 6. PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              
              <div>
                <h2 className="font-display text-2xl font-bold text-white flex items-center">
                  <UserIcon className="h-5.5 w-5.5 text-cyan-400 mr-2" />
                  Profile Details
                </h2>
                <p className="text-slate-400 text-xs">Official student registry and unique identifiers assigned to your account database entry.</p>
              </div>

              <div className="glass-panel p-6 rounded-2xl bg-slate-950/45 border-slate-900 space-y-6">
                <div className="flex items-center space-x-4">
                  <div className="h-14 w-14 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl uppercase">
                    {studentProfile.fullName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-display font-black text-lg text-white">{studentProfile.fullName}</h3>
                    <p className="text-xs text-slate-400">Student Account Profile</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6 border-t border-slate-900/60 pt-6 text-xs">
                  <div className="space-y-1">
                    <span className="text-slate-500 font-bold uppercase tracking-wider block">Full Name:</span>
                    <span className="text-white text-sm font-semibold">{studentProfile.fullName}</span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-500 font-bold uppercase tracking-wider block">University Serial Number (USN):</span>
                    <span className="text-white text-sm font-semibold font-mono">{studentProfile.usn || 'N/A'}</span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-500 font-bold uppercase tracking-wider block">E-Mail Address:</span>
                    <span className="text-white text-sm font-semibold">{studentProfile.email}</span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-500 font-bold uppercase tracking-wider block">Department:</span>
                    <span className="text-white text-sm font-semibold">{studentProfile.department || 'N/A'}</span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-500 font-bold uppercase tracking-wider block">Account status:</span>
                    <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold mt-1 ${studentProfile.accountStatus === 'Approved' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-500'}`}>
                      {studentProfile.accountStatus || 'Pending Verification'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-500 font-bold uppercase tracking-wider block">Created at:</span>
                    <span className="text-white text-sm font-semibold font-mono">
                      {new Date(studentProfile.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* 7. PROGRESS REPORT TAB */}
          {activeTab === 'report' && (
            <StudentReportView
              profile={studentProfile}
              sessions={sessions}
              attendance={attendance}
              assignments={assignments}
              submissions={submissions}
              summaries={summaries}
              isAdminMode={false}
              absenceRequests={absenceRequests}
            />
          )}

          {/* 8. ABSENCE REGULARIZATION TAB */}
          {activeTab === 'absence' && (
            <div className="space-y-6">
              
              {/* Stats overview row */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="glass-panel p-4 rounded-xl border border-slate-900 bg-slate-950/45 text-center">
                  <div className="text-2xl font-black text-cyan-400 font-mono">{absenceRequests.length}</div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Requests</span>
                </div>
                <div className="glass-panel p-4 rounded-xl border border-slate-900 bg-slate-950/45 text-center">
                  <div className="text-2xl font-black text-amber-400 font-mono">{absenceRequests.filter(r => r.status === 'Pending').length}</div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pending Review</span>
                </div>
                <div className="glass-panel p-4 rounded-xl border border-slate-900 bg-slate-950/45 text-center">
                  <div className="text-2xl font-black text-emerald-400 font-mono">{absenceRequests.filter(r => r.status === 'Approved').length}</div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Approved Requests</span>
                </div>
                <div className="glass-panel p-4 rounded-xl border border-slate-900 bg-slate-950/45 text-center">
                  <div className="text-2xl font-black text-rose-500 font-mono">{absenceRequests.filter(r => r.status === 'Rejected').length}</div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Rejected Requests</span>
                </div>
              </div>

              {/* Form and History Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Submit Absence request form */}
                <div className="lg:col-span-5 bg-slate-950/45 border border-slate-900 p-5 rounded-2xl flex flex-col space-y-4">
                  <div className="border-b border-slate-900 pb-3 flex items-center space-x-2">
                    <AlertCircle className="h-4 w-4 text-cyan-400" />
                    <h3 className="font-display font-extrabold text-xs text-white uppercase tracking-wider">Submit Absence Request</h3>
                  </div>

                  {/* Informational Message if there are any sessions that have not yet ended */}
                  {sessions.some(s => getSessionCalculatedState(s) !== 'Completed') && (
                    <div className="p-3 bg-cyan-950/20 border border-cyan-900/30 rounded-xl text-[11px] text-slate-300 flex items-start space-x-2">
                      <Info className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                      <span>Absence regularization is available only after the session has ended.</span>
                    </div>
                  )}

                   <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!selectedAbsenceSession) {
                      showToast('Please select a session.', 'error');
                      return;
                    }
                    if (!absenceReason.trim()) {
                      showToast('Please enter a reason for your absence.', 'error');
                      return;
                    }
                    const sess = sessions.find(s => s.id === selectedAbsenceSession);
                    if (!sess) return;

                    // Only allow absence regularization after the session has completely ended
                    const calcState = getSessionCalculatedState(sess);
                    if (calcState !== 'Completed') {
                      showToast('Absence regularization is available only after the session has ended.', 'error');
                      return;
                    }

                    // Check if a request already exists for this session
                    const duplicateExists = (absenceRequests || []).some(
                      r => r.sessionId === sess.id && r.studentId === studentProfile.id
                    );
                    if (duplicateExists) {
                      showToast('An absence request has already been submitted for this session.', 'error');
                      return;
                    }

                    const mockReq = {
                      studentId: studentProfile.id,
                      studentName: studentProfile.fullName,
                      studentUsn: studentProfile.usn || 'N/A',
                      sessionId: sess.id,
                      sessionName: sess.name,
                      reason: absenceReason.trim(),
                      attachmentUrl: absenceFile ? absenceFile.url : undefined
                    };

                    try {
                      const result = await absenceRequestService.createAbsenceRequest(mockReq);
                      if (result) {
                        showToast('Absence request submitted successfully.', 'success');
                        setSelectedAbsenceSession('');
                        setAbsenceReason(''); // Automatically clear text area
                        setAbsenceFile(null);
                        setAbsenceUploadProgress(null);
                        setAbsenceUploadError(null);
                        
                        // Notify administrators of the new student absence request
                        try {
                          await notificationService.addNotification(
                            'Absence Regularization',
                            `New absence request submitted by ${studentProfile.fullName}.`,
                            'admin'
                          );
                        } catch (notifErr) {
                          console.error("Could not dispatch admin notifications for request.", notifErr);
                        }

                        // Update local list
                        const updated = await absenceRequestService.getAbsenceRequests(undefined, studentProfile.id);
                        setAbsenceRequests(updated);
                      } else {
                        showToast('Failed to submit absence request in the database.', 'error');
                      }
                    } catch (submitErr: any) {
                      console.error("Submission failed:", submitErr);
                      showToast(`Submission failed: ${submitErr.message || submitErr}`, 'error');
                    }
                  }} className="space-y-3.5 text-xs">
                    
                    {/* Session dropdown filtered securely to show only missed/absent items without duplicate requests */}
                    <div className="space-y-1.5">
                      <label htmlFor="sessionSelect" className="block text-[11px] font-mono text-slate-400 uppercase">Select Session</label>
                      <select
                        id="sessionSelect"
                        name="sessionSelect"
                        required
                        className="w-full bg-slate-950 border border-slate-900 p-2.5 rounded-xl text-slate-200 outline-none focus:border-cyan-500 font-sans disabled:opacity-40 disabled:cursor-not-allowed"
                        value={selectedAbsenceSession}
                        onChange={(e) => {
                          setSelectedAbsenceSession(e.target.value);
                          setAbsenceReason(''); // Automatically clear text area on session change
                        }}
                        disabled={eligibleSessions.length === 0}
                      >
                        <option value="">-- Select Session --</option>
                        {eligibleSessions.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.date}) [Missed / Absent]
                          </option>
                        ))}
                      </select>
                      {eligibleSessions.length === 0 && (
                        <p className="text-[10px] text-rose-450 font-mono italic">
                          You currently have no absent or missed sessions available for regularization.
                        </p>
                      )}
                    </div>

                    {/* Reason Text Area */}
                    <div className="space-y-1.5">
                      <label htmlFor="reasonText" className="block text-[11px] font-mono text-slate-400 uppercase">Reason (Mandatory)</label>
                      <textarea
                        id="reasonText"
                        name="reasonText"
                        required
                        rows={4}
                        placeholder="Please provide a brief reason for your absence."
                        className="w-full bg-slate-950 border border-slate-900 p-2.5 rounded-xl text-slate-200 outline-none focus:border-cyan-500 font-sans leading-relaxed resize-none disabled:opacity-45 disabled:cursor-not-allowed"
                        value={absenceReason}
                        onChange={(e) => setAbsenceReason(e.target.value)}
                        disabled={eligibleSessions.length === 0}
                      />
                    </div>

                    {/* Attachment Upload - custom with drag & drop or input with Preview/Remove/Replace support */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-mono text-slate-400 uppercase">Supporting Document (Optional)</label>
                      <div className="text-[10px] text-slate-400 leading-relaxed font-sans">
                        <span className="font-bold text-slate-300 block mb-0.5">Accepted:</span>
                        Medical Certificate, Official Duty Letter, Permission Letter, or Other Supporting Evidence.
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono">
                        (PDF, JPG, PNG | Max 5 MB)
                      </div>
                      
                      {absenceUploading && (
                        <div className="border border-slate-900 rounded-xl p-4 bg-slate-950/20 text-center space-y-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-cyan-400 font-mono animate-pulse">Uploading supporting file...</span>
                            <span className="text-slate-400 font-mono">{absenceUploadProgress ?? 20}%</span>
                          </div>
                          <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-900">
                            <div 
                              className="bg-cyan-500 h-full transition-all duration-300"
                              style={{ width: `${absenceUploadProgress ?? 20}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {!absenceUploading && !absenceFile && (
                        <div className={`relative border border-dashed border-slate-900 hover:border-cyan-500/50 rounded-xl p-4 flex flex-col items-center justify-center space-y-2 cursor-pointer bg-slate-950/20 text-center transition ${eligibleSessions.length === 0 ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}>
                          <input
                            type="file"
                            id="attachmentFile"
                            accept=".pdf,.png,.jpg,.jpeg"
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                            disabled={eligibleSessions.length === 0}
                            onChange={async (evt) => {
                              const file = evt.target.files?.[0];
                              if (!file) return;
                              await handleAbsenceUpload(file);
                              evt.target.value = '';
                            }}
                          />
                          <Download className="h-5 w-5 text-slate-400" />
                          <span className="text-slate-400 text-[10px] font-medium">Drag & Drop or Click to Select File</span>
                          <span className="text-slate-600 text-[9px] font-mono">Supported format: PDF, PNG, JPG, JPEG</span>
                          {absenceUploadError && (
                            <span className="text-rose-550 text-[9px] font-mono mt-1 block font-bold">{absenceUploadError}</span>
                          )}
                        </div>
                      )}

                      {!absenceUploading && absenceFile && (
                        <div className="border border-slate-900 bg-slate-950/40 p-3.5 rounded-xl flex flex-col space-y-2.5">
                          <div className="flex items-center space-x-2 text-emerald-400 text-xs">
                            <CheckCircle className="h-4 w-4 shrink-0" />
                            <span className="font-medium truncate flex-1 min-w-0" title={absenceFile.name}>
                              ✓ {absenceFile.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleFilePreview(absenceFile.url, absenceFile.name)}
                              className="flex-1 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-center text-[10px] font-bold text-slate-300 hover:text-white transition cursor-pointer flex items-center justify-center space-x-1"
                            >
                              <Eye className="h-3 w-3" />
                              <span>Preview</span>
                            </button>
                            
                            <button
                              type="button"
                              onClick={async () => {
                                const oldPath = absenceFile.path;
                                setAbsenceFile(null);
                                setAbsenceUploadProgress(null);
                                if (oldPath) {
                                  try {
                                    await storageService.deleteFile('absence-attachments', oldPath);
                                  } catch (e) {
                                    console.error("Cleanup path error", e);
                                  }
                                }
                                setTimeout(() => {
                                  const triggerInput = document.getElementById('absenceReplaceSelector') as HTMLInputElement;
                                  if (triggerInput) {
                                    triggerInput.click();
                                  }
                                }, 50);
                              }}
                              className="flex-1 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-center text-[10px] font-bold text-slate-300 hover:text-cyan-400 transition cursor-pointer flex items-center justify-center space-x-1"
                            >
                              <RefreshCw className="h-3 w-3 animate-pulse" />
                              <span>Replace File</span>
                            </button>

                            <button
                              type="button"
                              onClick={async () => {
                                const oldPath = absenceFile.path;
                                setAbsenceFile(null);
                                setAbsenceUploadProgress(null);
                                if (oldPath) {
                                  showToast('Deleting draft file from storage...', 'info');
                                  await storageService.deleteFile('absence-attachments', oldPath);
                                }
                                showToast('File attachment detached.', 'success');
                              }}
                              className="py-1.5 px-2 bg-slate-900 hover:bg-rose-950/20 text-rose-450 border border-slate-800 hover:border-rose-900/40 rounded-lg text-center text-[10px] font-bold transition cursor-pointer flex items-center justify-center"
                              title="Remove File"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>

                          {/* Hidden file selector used by "Replace File" button */}
                          <input
                            type="file"
                            id="absenceReplaceSelector"
                            accept=".pdf,.png,.jpg,.jpeg"
                            className="hidden"
                            onChange={async (evt) => {
                              const file = evt.target.files?.[0];
                              if (!file) return;
                              await handleAbsenceUpload(file);
                              evt.target.value = '';
                            }}
                          />
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={eligibleSessions.length === 0}
                      className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-600 active:scale-95 text-slate-950 text-xs font-black uppercase rounded-xl tracking-wider transition duration-150 shadow-[0_0_15px_rgba(6,182,212,0.15)] flex items-center justify-center space-x-2 border-none disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                    >
                      <span>Submit Request</span>
                    </button>
                  </form>
                </div>

                {/* History section */}
                <div className="lg:col-span-7 bg-slate-950/45 border border-slate-900 p-5 rounded-2xl flex flex-col space-y-4">
                  <div className="border-b border-slate-900 pb-3 flex items-center justify-between">
                    <h3 className="font-display font-extrabold text-xs text-white uppercase tracking-wider">Attendance Request Log</h3>
                    <span className="text-[10px] font-mono text-slate-500">{absenceRequests.length} logged</span>
                  </div>

                  {absenceRequests.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500 border border-dashed border-slate-900 rounded-xl min-h-[300px]">
                      <AlertCircle className="h-8 w-8 text-slate-500 mb-2" />
                      <p className="text-xs">No absence requests filed yet.</p>
                      <p className="text-[10px] text-slate-500 mt-1">Missed sessions can be regularized by submitting genuine remarks above.</p>
                    </div>
                  ) : (
                    <div className="space-y-3.5 max-h-[500px] overflow-y-auto scrollbar-thin pr-1">
                      {absenceRequests.map(req => (
                        <div key={req.requestId} className="p-4 bg-slate-950 rounded-2xl border border-slate-900 flex flex-col space-y-3.5">
                          {/* Session Name & Status Badges */}
                          <div className="flex items-start justify-between border-b border-slate-900 pb-2">
                            <div>
                              <h4 className="font-bold text-[13px] text-slate-100 leading-snug">{req.sessionName}</h4>
                              <span className="text-[9px] font-mono text-slate-500 uppercase block mt-0.5">
                                Submitted At: {new Date(req.createdAt).toLocaleString()}
                              </span>
                            </div>
                            
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[9px] font-mono uppercase font-black text-center ${
                              req.status === 'Approved' 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                : req.status === 'Rejected'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              {req.status}
                            </span>
                          </div>

                          {/* Reason: Read-only multiline text area */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Provide the reason:</label>
                            <textarea
                              readOnly
                              value={req.reason}
                              className="w-full h-24 bg-slate-950/80 border border-slate-900 text-slate-250 text-xs rounded-xl p-3 outline-none resize-none overflow-y-auto leading-relaxed font-sans"
                            />
                          </div>

                          {/* Proof File */}
                          <div className="flex items-center justify-between bg-slate-950/45 p-2.5 rounded-xl border border-slate-900/60">
                            <span className="text-[10px] text-slate-400 font-mono">Proof File:</span>
                            {req.attachmentUrl ? (
                              <button
                                type="button"
                                onClick={() => handleFilePreview(req.attachmentUrl!, req.attachmentUrl!.split('/').pop() || 'Proof File')}
                                className="inline-flex items-center space-x-1 px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500 hover:text-slate-950 text-cyan-400 text-[10px] font-bold font-mono uppercase rounded-lg transition border border-cyan-500/15 cursor-pointer"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                <span>Preview Document</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-550 font-mono italic">No attachment provided</span>
                            )}
                          </div>

                           {/* Timeline History Section */}
                          <div className="bg-slate-950/40 p-3.5 rounded-2xl border border-slate-900/60 space-y-3">
                            <span className="text-[9px] font-mono text-slate-450 uppercase tracking-widest font-black block">
                              Absence Claim Timeline
                            </span>
                            <div className="relative pl-4 border-l border-slate-900 space-y-3.5">
                              {/* Point 1: Submission */}
                              <div className="relative text-[10px] font-mono">
                                <span className="absolute -left-[20.5px] top-1 h-2 w-2 rounded-full bg-cyan-500 ring-4 ring-cyan-950/50"></span>
                                <div className="flex items-center justify-between text-slate-300">
                                  <span className="font-bold">Claim Submitted</span>
                                  <span className="text-slate-500 font-normal">{new Date(req.createdAt).toLocaleString()}</span>
                                </div>
                                <div className="text-slate-500 text-[9px] mt-0.5">Student requested excusal for: "{req.sessionName}"</div>
                              </div>

                              {/* Point 2: Current Status decision block */}
                              {req.status !== 'Pending' && (
                                <div className="relative text-[10px] font-mono">
                                  <span className={`absolute -left-[20.5px] top-1 h-2 w-2 rounded-full ring-4 ${
                                    req.status === 'Approved' 
                                      ? 'bg-emerald-500 ring-emerald-950/50' 
                                      : 'bg-rose-500 ring-rose-950/50'
                                  }`}></span>
                                  <div className="flex items-center justify-between text-slate-300">
                                    <span className={`font-bold uppercase tracking-wider ${
                                      req.status === 'Approved' ? 'text-emerald-400 font-black' : 'text-rose-400 font-black'
                                    }`}>
                                      {req.status === 'Approved' ? 'Claim Approved' : 'Claim Rejected'}
                                    </span>
                                    <span className="text-slate-500 font-normal">
                                      {req.approvedAt ? new Date(req.approvedAt).toLocaleString() : ''}
                                    </span>
                                  </div>
                                  <div className="text-slate-450 text-[9px] mt-1 space-y-0.5">
                                    <div>
                                      {req.status === 'Approved' ? (
                                        <>
                                          <span className="text-slate-550 uppercase text-[8px] font-bold">Approved By:</span> {req.approvedByName || 'System Creator'}
                                        </>
                                      ) : (
                                        <>
                                          <span className="text-slate-550 uppercase text-[8px] font-bold">Rejected By:</span> {req.approvedByName || 'System Creator'}
                                        </>
                                      )}
                                    </div>
                                    {req.adminRemarks && (
                                      <div className={`mt-1.5 p-2 rounded-xl border leading-relaxed ${
                                        req.status === 'Approved' 
                                          ? 'bg-emerald-950/10 text-emerald-350 border-emerald-950/20' 
                                          : 'bg-rose-950/10 text-rose-350 border-rose-950/20 font-sans'
                                      }`}>
                                        <span className="font-extrabold text-[8px] uppercase tracking-wider block mb-0.5 font-mono">
                                          {req.status === 'Approved' ? 'Remarks:' : 'Rejection Remarks:'}
                                        </span>
                                        "{req.adminRemarks}"
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Point 3: Pending state waiting */}
                              {req.status === 'Pending' && (
                                <div className="relative text-[10px] font-mono">
                                  <span className="absolute -left-[20.5px] top-1 h-2 w-2 rounded-full bg-amber-500 ring-4 ring-amber-950/50 animate-pulse"></span>
                                  <div className="flex items-center justify-between text-amber-400">
                                    <span className="font-bold uppercase tracking-wider">Awaiting Action</span>
                                    <span className="text-slate-550 italic text-[9px]">Review Pending</span>
                                  </div>
                                  <div className="text-slate-500 text-[9px] mt-0.5">Awaiting Administrator review and verification of proof.</div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Withdraw / Delete Request action if Pending */}
                          {req.status === 'Pending' && (
                            <div className="flex justify-end pt-1">
                              <button
                                type="button"
                                onClick={() => handleDeleteAbsenceRequest(req)}
                                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-600 text-rose-450 hover:text-white border border-rose-500/15 text-[10px] font-bold uppercase rounded-xl transition cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Withdraw claim</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
              
            </div>
          )}

        </div>

      </div>

      {/* SESSION DETAILS MODAL */}
      {showSessionDetailsModal && liveSession && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 font-sans text-slate-100 animate-fade-in animate-duration-200">
          <div className="glass-panel max-w-md w-full p-6 md:p-8 rounded-2xl relative flex flex-col bg-slate-950 border border-slate-900 space-y-5 text-left">
            <button 
              onClick={() => setShowSessionDetailsModal(false)}
              className="absolute top-4 right-4 p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
            
            <div className="flex items-center space-x-3 border-b border-slate-900 pb-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-white text-base">📋 Session Details</h3>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mt-0.5">Active live class metrics</p>
              </div>
            </div>

            <div className="space-y-4 text-xs text-slate-300">
              <div>
                <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Session Name</span>
                <span className="text-white font-extrabold text-sm block mt-1">{liveSession.name}</span>
              </div>
              
              <div>
                <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Topic</span>
                <p className="text-slate-200 leading-relaxed text-xs block mt-1">
                  {liveSession.description
                    ? liveSession.description
                        .replace(/\n\[feedback:(optional|mandatory)\]/g, '')
                        .replace(/\[feedback:(optional|mandatory)\]/g, '')
                    : 'No topic specified'}
                </p>
              </div>

              <div>
                <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Venue</span>
                <span className="text-white font-semibold block mt-1">{liveSession.venue || 'Unspecified Venue'}</span>
              </div>

              <div>
                <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Hosted By</span>
                <span className="text-white font-semibold block mt-1">{liveSession.hostedBy || 'Administrator'}</span>
              </div>

              <div>
                <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Date</span>
                <span className="text-white font-semibold block mt-1">{formatReportDate(liveSession.date)}</span>
              </div>

              <div>
                <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">🕒 Session Duration</span>
                <span className="text-cyan-400 font-mono font-bold text-sm block mt-1">
                  {formatSessionEndTime(liveSession.startTime)} → {formatSessionEndTime(liveSession.extendedEndTime || liveSession.endTime)}
                </span>
              </div>

              {liveSession.resourcePerson && liveSession.resourcePerson !== 'N/A' && liveSession.resourcePerson !== 'Unspecified' && (
                <div>
                  <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Resource Person</span>
                  <span className="text-white font-semibold block mt-1">{liveSession.resourcePerson}</span>
                </div>
              )}
            </div>
            
            <div className="pt-2">
              <button
                onClick={() => setShowSessionDetailsModal(false)}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-850 text-white text-xs font-semibold border border-slate-800 transition-all cursor-pointer text-center"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLEAR NOTIFICATIONS CONFIRMATION DIALOG */}
      {showClearConfirm && (
        <div id="clear-notifications-confirm-modal" className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 font-sans text-slate-100 animate-fade-in">
          <div className="glass-panel max-w-sm w-full p-6 md:p-8 rounded-2xl relative flex flex-col items-center bg-slate-950 border border-slate-900 text-center space-y-4">
            
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.15)] animate-pulse">
              <Bell className="h-6 w-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="font-display font-black text-white text-md">Clear All Notifications?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Are you sure you want to clear all notifications?
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3.5 w-full pt-1">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="py-2.5 rounded-xl border border-slate-800 hover:bg-slate-900 text-xs font-semibold text-slate-300 transition-all cursor-pointer font-sans"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)] cursor-pointer font-sans"
              >
                Clear All
              </button>
            </div>

          </div>
        </div>
      )}

      {/* GLOBAL UNIFIED DELETE CONFIRMATION MODAL (STUDENT) */}
      {deleteConfirm && deleteConfirm.isOpen && (
        <div id="unified-delete-confirm-modal" className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 font-sans text-slate-100 animate-fade-in animate-duration-200">
          <div className="glass-panel max-w-sm w-full p-6 md:p-8 rounded-2xl relative flex flex-col items-center bg-slate-950 border border-slate-900 text-center space-y-4">
            
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center shadow-[0_0_15px_rgba(244,63,94,0.15)] animate-pulse">
              <Trash2 className="h-6 w-6" />
            </div>

            <div className="space-y-1.5">
              <h3 id="delete-confirm-headline" className="font-display font-extrabold text-white text-base">Confirm Deletion</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {deleteConfirm.message || "Are you sure you want to delete this item?"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3.5 w-full pt-1">
              <button
                id="btn-delete-cancel"
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="py-2.5 rounded-xl border border-slate-800 hover:bg-slate-900 text-xs font-semibold text-slate-400 hover:text-white transition-all cursor-pointer font-sans"
              >
                Cancel
              </button>
              <button
                id="btn-delete-confirm"
                type="button"
                onClick={async () => {
                  const onConfirm = deleteConfirm.onConfirm;
                  setDeleteConfirm(null);
                  await onConfirm();
                }}
                className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(244,63,94,0.2)] cursor-pointer font-sans"
              >
                Delete
              </button>
            </div>

          </div>
        </div>
      )}

      {/* DOCUMENT HIGH-FIDELITY PREVIEW MODAL */}
      {previewFileUrl && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-50 p-4 font-sans text-slate-100">
          <div className="glass-panel max-w-4xl w-full h-[85vh] p-6 rounded-3xl relative flex flex-col space-y-4 bg-slate-950 border border-slate-900 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-900 pb-3">
              <div>
                <h3 className="font-display font-extrabold text-sm text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-cyan-400"></span>
                  <span>Document Preview</span>
                </h3>
                <p className="text-[10px] text-slate-450 font-mono mt-0.5 truncate max-w-md">{previewFileName}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPreviewFileUrl(null);
                  setPreviewFileType(null);
                }}
                className="p-1 px-3 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer border border-transparent hover:border-slate-800"
              >
                ✕ Close
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-slate-950/60 rounded-2xl border border-slate-900 flex items-center justify-center relative p-2 min-h-0">
              {previewFileLoading ? (
                <div className="text-center font-mono text-xs text-slate-450 animate-pulse">
                  Resolving files and generating secure temporary link...
                </div>
              ) : previewFileType === 'pdf' ? (
                <iframe
                  src={previewFileUrl}
                  className="w-full h-full rounded-xl border-none bg-white"
                  title="PDF Document Preview"
                  referrerPolicy="no-referrer"
                />
              ) : previewFileType === 'image' ? (
                <img
                  src={previewFileUrl}
                  alt={previewFileName}
                  className="max-w-full max-h-full rounded-xl object-contain shadow-lg"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="text-center space-y-3.5 max-w-sm p-6">
                  <Info className="h-10 w-10 text-cyan-400 mx-auto" />
                  <h4 className="font-bold text-sm text-slate-300">Alternate Preview Format</h4>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    This file is not directly viewable inside the quick inline panel. You can download or view it via our secure fallback:
                  </p>
                  <a
                    href={previewFileUrl}
                    target="_blank"
                    rel="noreferrer referrer"
                    className="inline-flex py-2 px-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl transition font-sans"
                  >
                    Open in Direct Browser Tab
                  </a>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-900">
              <span className="text-[10px] text-slate-500 font-mono italic">
                Note: Securing with temporary credentials.
              </span>
              <a
                href={previewFileUrl}
                target="_blank"
                rel="noreferrer referrer"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-850 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition flex items-center gap-1.5"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Open Direct View</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* IN-APP SESSION REMINDER AND STARTED POPUP MODAL */}
      {activeReminderSession && reminderType && (
        <div id="session-reminder-popup-modal" className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 font-sans text-slate-100 animate-fade-in">
          <div className="glass-panel max-w-sm w-full p-6 md:p-8 rounded-2xl relative flex flex-col items-center bg-slate-950 border border-slate-900 space-y-5 shadow-2xl">
            
            {reminderType === 'upcoming' ? (
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.15)] animate-pulse shrink-0">
                <Clock className="h-6 w-6" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.15)] animate-pulse shrink-0">
                <CheckCircle className="h-6 w-6" />
              </div>
            )}

            <div className="text-center space-y-1.5 w-full">
              <h3 className="font-display font-black text-white text-md tracking-tight">
                {reminderType === 'upcoming' ? 'Upcoming Session Reminder' : 'Session Started'}
              </h3>
              
              {reminderType === 'upcoming' ? (
                <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {getCountdownText(activeReminderSession)}
                </div>
              ) : (
                <div className="px-2.5 py-1.5 rounded-xl text-[10.5px] font-bold tracking-wide bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 leading-relaxed">
                  Session Started – Attendance is now open.
                </div>
              )}
            </div>

            {/* Session Details Box */}
            <div className="w-full bg-slate-950/45 border border-slate-900 rounded-xl p-4 space-y-3 text-xs text-left">
              <div>
                <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Subject:</span>
                <span className="text-slate-200 font-medium block leading-relaxed">{activeReminderSession.description || 'No Description Provided'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Session Name:</span>
                <span className="text-white font-extrabold block text-sm leading-snug">{activeReminderSession.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Venue:</span>
                  <span className="text-slate-200 font-semibold block">{activeReminderSession.venue || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Start Time:</span>
                  <span className="text-slate-200 font-semibold font-mono block">{activeReminderSession.startTime.substring(0, 5)}</span>
                </div>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Date:</span>
                <span className="text-slate-200 font-mono block">{activeReminderSession.date}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5 w-full pt-1.5">
              <button
                type="button"
                onClick={() => dismissReminder(activeReminderSession, reminderType)}
                className="py-2.5 rounded-xl border border-slate-800 hover:bg-slate-900 text-xs font-semibold text-slate-400 hover:text-white transition-all cursor-pointer font-sans"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => viewReminderSession(activeReminderSession, reminderType)}
                className="py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)] cursor-pointer font-sans"
              >
                View Session
              </button>
            </div>

          </div>
        </div>
      )}

      <Footer />

    </div>
  );
}
