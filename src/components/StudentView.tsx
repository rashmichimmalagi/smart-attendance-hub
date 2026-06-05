/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle, 
  MapPin, 
  Clock, 
  QrCode, 
  BookOpen, 
  Download, 
  ExternalLink, 
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
  Award
} from 'lucide-react';
import StudentReportView from './StudentReportView';
import { 
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
  debounce
} from '../supabase';
import { 
  Session, 
  AttendanceRecord, 
  Assignment, 
  AssignmentSubmission, 
  SessionSummary, 
  Profile, 
  AppNotification,
  AttendanceToken
} from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { StudentQRPresenter } from './QRManager';
import { getAssignmentStatus } from '../utils/assignmentUtils';

interface StudentViewProps {
  studentProfile: Profile;
  onLogout: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export default function StudentView({ studentProfile, onLogout, showToast, theme, toggleTheme }: StudentViewProps) {
  // Guard clause for route protection - Block access if student is not Approved
  if (studentProfile.accountStatus !== 'Approved') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center font-sans p-4">
        <div className="glass-panel max-w-sm w-full p-6 text-center space-y-4 bg-slate-950 border border-slate-900 rounded-2xl">
          <p className="text-rose-400 font-bold font-display text-base">Access Denied</p>
          <p className="text-xs text-slate-400 font-sans leading-relaxed">You do not have permission to view this page. Approval status: {studentProfile.accountStatus || 'Pending'}</p>
          <button onClick={onLogout} className="px-4 py-2 bg-slate-900 border border-slate-800 text-xs text-slate-350 hover:text-white rounded-xl font-sans cursor-pointer transition-all">
            Logout
          </button>
        </div>
      </div>
    );
  }

  // State lists
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [summaries, setSummaries] = useState<SessionSummary[]>([]);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  // Navigation tab status
  const [activeTab, setActiveTabState] = useState<'verify' | 'history' | 'assignments' | 'feedback' | 'notifications' | 'profile' | 'report'>(() => {
    const path = window.location.pathname;
    if (path === '/attendance') return 'history';
    if (path === '/assignments') return 'assignments';
    if (path === '/feedback') return 'feedback';
    if (path === '/notifications') return 'notifications';
    if (path === '/profile') return 'profile';
    if (path === '/report') return 'report';
    return 'verify'; // /dashboard maps to verify
  });

  const setActiveTab = (tab: 'verify' | 'history' | 'assignments' | 'feedback' | 'notifications' | 'profile' | 'report') => {
    setActiveTabState(tab);
    let path = '/dashboard';
    if (tab === 'history') path = '/attendance';
    else if (tab === 'assignments') path = '/assignments';
    else if (tab === 'feedback') path = '/feedback';
    else if (tab === 'notifications') path = '/notifications';
    else if (tab === 'profile') path = '/profile';
    else if (tab === 'report') path = '/report';
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
  const [summaryForm, setSummaryForm] = useState({
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
  const [isSubmittingSummary, setIsSubmittingSummary] = useState(false);

  // Fetch client student data
  const loadStudentMetrics = async () => {
    try {
      setMetricsError(null);
      const sessList = await sessionService.getSessions();
      setSessions(sessList);

      const attList = await attendanceService.getAttendance();
      // Filter attendance records specific to this student's USN or profile ID
      setAttendance(attList.filter(a => a.studentUsn === studentProfile.usn || a.studentId === studentProfile.id));

      const assignList = await assignmentService.getAssignments();
      setAssignments(assignList);

      const subList = await assignmentService.getSubmissions();
      // Filter homework submissions of this user
      setSubmissions(subList.filter(s => s.studentUsn === studentProfile.usn || s.studentId === studentProfile.id));

      const sums = await summaryService.getSessionSummaries();
      setSummaries(sums.filter(s => s.studentUsn === studentProfile.usn || s.studentId === studentProfile.id));

      const notifs = await notificationService.getNotifications();
      const studentRole = 'student';
      const deletedKey = `student_deleted_notifs_${studentProfile.id}`;
      const deletedIds: string[] = JSON.parse(localStorage.getItem(deletedKey) || '[]');
      const readKey = `student_read_notifs_${studentProfile.id}`;
      const localReadIds: string[] = JSON.parse(localStorage.getItem(readKey) || '[]');

      const filteredNotifs = notifs
        .filter(n => n.roleTarget === 'student' || n.roleTarget === 'all')
        .filter(n => !deletedIds.includes(n.id))
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
    }
  };

  const loadStudentMetricsDebounced = useRef(
    debounce(() => {
      loadStudentMetrics();
    }, 1000)
  ).current;

  useEffect(() => {
    loadStudentMetrics();

    // Setup real-time Supabase subscriptions using specific listener helper
    // wrapped in debounced updates to prevent socket and database flooding!
    const cleanup = subscribeToDatabaseChanges(() => {
      console.log("[Supabase Realtime Event RECEIVED at Student] Reloading student metrics debounced...");
      loadStudentMetricsDebounced();
    });

    return () => {
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
      setNotifications([]);
      const currentNotifIds = notifications.map(n => n.id);
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
            type="button"
            onClick={onLogout}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-950 transition-all text-xs cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
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
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-left transition-all duration-200 flex items-center space-x-3 ${activeTab === 'verify' ? 'bg-cyan-500 text-slate-950 font-extrabold shadow-[0_0_15px_rgba(6,182,212,0.25)]' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
            >
              <QrCode className="h-4 w-4" />
              <span>Verify Attendance</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-left transition-all duration-200 flex items-center space-x-3 ${activeTab === 'history' ? 'bg-cyan-500 text-slate-950 font-extrabold shadow-[0_0_15px_rgba(6,182,212,0.25)]' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
            >
              <FileCheck className="h-4 w-4" />
              <span>Attendance History</span>
            </button>

            <button
              onClick={() => setActiveTab('assignments')}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-left transition-all duration-200 flex items-center space-x-3 ${activeTab === 'assignments' ? 'bg-cyan-500 text-slate-950 font-extrabold shadow-[0_0_15px_rgba(6,182,212,0.25)]' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
            >
              <BookOpen className="h-4 w-4" />
              <span>Assignments</span>
            </button>

            <button
              onClick={() => setActiveTab('feedback')}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-left transition-all duration-200 flex items-center space-x-3 ${activeTab === 'feedback' ? 'bg-cyan-500 text-slate-950 font-extrabold shadow-[0_0_15px_rgba(6,182,212,0.25)]' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
            >
              <Send className="h-4 w-4" />
              <span>Session Summaries & Feedback</span>
            </button>

            <button
              onClick={() => setActiveTab('notifications')}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-left transition-all duration-200 flex items-center space-x-3 ${activeTab === 'notifications' ? 'bg-cyan-500 text-slate-950 font-extrabold shadow-[0_0_15px_rgba(6,182,212,0.25)]' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
            >
              <Bell className="h-4 w-4" />
              <span>Notifications</span>
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-left transition-all duration-200 flex items-center space-x-3 ${activeTab === 'profile' ? 'bg-cyan-500 text-slate-950 font-extrabold shadow-[0_0_15px_rgba(6,182,212,0.25)]' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
            >
              <UserIcon className="h-4 w-4" />
              <span>Profile</span>
            </button>

            <button
              onClick={() => setActiveTab('report')}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-left transition-all duration-200 flex items-center space-x-3 ${activeTab === 'report' ? 'bg-cyan-500 text-slate-950 font-extrabold shadow-[0_0_15px_rgba(6,182,212,0.25)]' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
            >
              <FileText className="h-4 w-4" />
              <span>Progress Report</span>
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
                <div className="space-y-6">
                  {/* LIVE CARD */}
                  <div className="glass-panel p-6 rounded-2xl bg-slate-950 border border-slate-900 overflow-hidden space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-rose-500 font-bold animate-pulse text-sm">
                        <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                        <span>🔴 CURRENT LIVE SESSION</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-extrabold uppercase tracking-wider">
                        SESSION LIVE NOW
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
                            <span className="text-white font-mono text-sm block">{liveSession.endTime}</span>
                          </div>
                        </div>

                        {/* Status tracker */}
                        <div className="border-t border-slate-900 pt-4 mt-2">
                          {hasAttendanceForSession(liveSession.id) ? (
                            <div className="flex items-center space-x-2.5 text-emerald-400 font-semibold bg-emerald-500/5 px-4 py-3 rounded-xl border border-emerald-500/10">
                              <CheckCircle className="h-5 w-5 shrink-0" />
                              <span>Your presence is verified. Attendance has been successfully recorded in the admin database.</span>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2.5 text-amber-505 font-bold bg-amber-500/5 px-4 py-3 rounded-xl border border-amber-500/10 animate-pulse text-amber-400">
                              <Clock className="h-5 w-5 shrink-0" />
                              <span>Attendance pending in-person verification. Present your student QR code or copied token code to your instructor to register.</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Column: Secure Student Specific Attendance QR */}
                      <div className="md:col-span-12 lg:col-span-5 flex flex-col items-center justify-center bg-slate-950/65 border border-slate-900 p-5 rounded-2xl text-center space-y-4">
                        <div className="text-center">
                          <h4 className="font-display font-extrabold text-white text-xs tracking-wide uppercase">My Attendance QR</h4>
                          <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                            Instructors scan this QR code to confirm and record your attendance instantly.
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
                              Attendance Token: {studentToken}
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

              {attendance.length > 0 ? (
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
                              <td className="p-4 font-mono text-slate-400">{sessionObj?.date || 'N/A'}</td>
                              <td className="p-4 font-mono text-cyan-400">{new Date(a.checkInTime).toLocaleTimeString()}</td>
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

              {assignments.length > 0 ? (
                <div className="grid md:grid-cols-12 gap-6">
                  {/* Left Column: List */}
                  <div className="md:col-span-5 space-y-4">
                    <span className="text-xs font-bold tracking-widest text-slate-500 uppercase">Available Tasks</span>
                    <div className="space-y-2">
                      {assignments.map(assign => {
                        const submitted = hasSubmissionForAssignment(assign.id);
                        const statusInfo = getAssignmentStatus(assign.deadline);
                        return (
                          <div
                            key={assign.id}
                            onClick={() => {
                              setActiveAssignment(assign);
                              setSubmissionForm({ attachedFiles: [], attachedLinks: '' });
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
                              <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded ${submitted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-500'}`}>
                                {submitted ? 'Submitted' : 'Not Submitted'}
                              </span>
                            </div>
                            
                            <h4 className="font-display font-semibold text-sm text-white mb-2">{assign.title}</h4>
                            
                            <div className="flex justify-between items-center text-[10px] border-t border-slate-900/40 pt-2.5 mt-2">
                              <span className={`font-mono font-medium ${statusInfo.isClosed ? 'text-slate-500' : 'text-cyan-400'}`}>
                                {statusInfo.remainingTimeString}
                              </span>
                              <span className={`font-bold uppercase tracking-wider text-[9px] ${
                                statusInfo.status === 'Closed' ? 'text-rose-500' :
                                statusInfo.status === 'Due Soon' ? 'text-amber-500' :
                                'text-emerald-500'
                              }`}>
                                Status: {statusInfo.status}
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
                        const submitted = hasSubmissionForAssignment(activeAssignment.id);
                        return (
                          <div className="glass-panel p-5 rounded-2xl bg-slate-950/45 space-y-5 border-slate-900">
                            <div className="border-b border-slate-900/60 pb-3">
                              <span className="text-[10px] font-mono text-cyan-400 uppercase">TASK DETAIL SPECIFICATIONS</span>
                              <h3 className="font-display font-extrabold text-base text-white">{activeAssignment.title}</h3>
                              <p className="text-xs text-slate-400 leading-relaxed mt-1.5">{activeAssignment.description}</p>

                              {/* Rich Spec Grid */}
                              <div className="mt-4 grid grid-cols-2 gap-3 bg-slate-900/30 p-3 border border-slate-900 rounded-xl text-xs">
                                <div>
                                  <span className="text-slate-500 text-[10px] block font-mono uppercase">Due Date</span>
                                  <span className="font-semibold text-slate-300">{statusInfo.dueDateString}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500 text-[10px] block font-mono uppercase">Due Time</span>
                                  <span className="font-semibold text-slate-300">{statusInfo.dueTimeString}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500 text-[10px] block font-mono uppercase">Remaining Time</span>
                                  <span className={`font-mono font-bold ${statusInfo.isClosed ? 'text-rose-500' : 'text-cyan-400 animate-pulse'}`}>
                                    {statusInfo.remainingTimeString}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500 text-[10px] block font-mono uppercase">Deadline Status</span>
                                  <span className={`font-bold ${
                                    statusInfo.status === 'Closed' ? 'text-rose-500' :
                                    statusInfo.status === 'Due Soon' ? 'text-amber-500' :
                                    'text-emerald-500'
                                  }`}>{statusInfo.status}</span>
                                </div>
                              </div>

                              {(activeAssignment.attachedFiles.length > 0 || activeAssignment.attachedLinks.length > 0) && (
                                <div className="space-y-2 mt-3 pt-2 border-t border-slate-900/40">
                                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Class resources attached</span>
                                  <div className="grid grid-cols-2 gap-2">
                                    {activeAssignment.attachedFiles.map((file, idx) => (
                                      <button
                                        key={idx}
                                        type="button"
                                        onClick={async (e) => {
                                          e.preventDefault();
                                          await storageService.openFile(file.url, file.name);
                                        }}
                                        className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 hover:text-cyan-400 rounded-xl flex items-center space-x-1.5 truncate cursor-pointer w-full text-left"
                                      >
                                        <Download className="h-3.5 w-3.5 text-cyan-500 shrink-0" />
                                        <span className="truncate">{file.name}</span>
                                      </button>
                                    ))}

                                    {activeAssignment.attachedLinks.map((lnk, idx) => (
                                      <a
                                        key={idx}
                                        href={lnk}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 hover:text-purple-400 rounded-xl flex items-center space-x-1.5 truncate"
                                      >
                                        <ExternalLink className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                                        <span className="truncate">{lnk}</span>
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            {submitted ? (
                              <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl flex items-start space-x-3 text-xs text-emerald-400">
                                <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold">Assignment Submitted successfully.</span>
                                  <p className="text-[11px] text-slate-405 mt-0.5">Your files/links have been processed by the Smart Attendance repository dashboard.</p>
                                </div>
                              </div>
                            ) : statusInfo.isClosed ? (
                              <div className="bg-rose-500/5 border border-rose-500/10 p-4 rounded-xl flex items-start space-x-3 text-xs text-rose-400">
                                <Info className="h-5 w-5 shrink-0 mt-0.5 text-rose-500" />
                                <div>
                                  <span className="font-bold">Submissions Closed</span>
                                  <p className="text-[11px] text-slate-400 mt-0.5">The deadline has passed. Submissions are no longer accepted for this academic record.</p>
                                </div>
                              </div>
                            ) : (
                              <form onSubmit={handleSubmissionSubmit} className="space-y-4 pt-1">
                                <div>
                                  <label className="text-xs font-bold text-slate-400 uppercase">External links (Optional, Comma separated)</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. https://github.com/account/repo"
                                    value={submissionForm.attachedLinks}
                                    onChange={(e) => setSubmissionForm({...submissionForm, attachedLinks: e.target.value})}
                                    className="glass-input w-full p-2.5 rounded-xl text-xs mt-1 bg-slate-900 border border-slate-800 text-white"
                                  />
                                </div>

                                <div>
                                  <label className="text-xs font-bold text-slate-400 uppercase block mb-1.5">Attach Hand-in Files (PDF, ZIP, DOCX)</label>
                                  <div className="relative">
                                    <input
                                      type="file"
                                      multiple
                                      disabled={uploading || isSubmittingSubmission}
                                      onChange={handleSubmissionsFileUpload}
                                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                                    />
                                    <div className="glass-panel p-3 rounded-xl border border-dashed border-cyan-500/20 hover:border-cyan-500/50 flex flex-col items-center justify-center text-xs text-slate-400 transition-all">
                                      <div className="flex items-center">
                                        {uploading ? (
                                          <RefreshCw className="h-4 w-4 animate-spin mr-1.5" />
                                        ) : (
                                          <Plus className="h-4 w-4 text-cyan-400 mr-1.5" />
                                        )}
                                        <span>{uploading ? 'Transmitting academic data to cloud storage...' : 'Click or drop submission documents'}</span>
                                      </div>
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
                                    </div>
                                  </div>

                                  {submissionForm.attachedFiles.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                                      {submissionForm.attachedFiles.map((file, idx) => (
                                        <div key={idx} className="bg-slate-900 border border-slate-800 text-[10px] px-2 py-1 rounded-lg text-slate-300 flex items-center space-x-1">
                                          <span>{file.name}</span>
                                          <button 
                                            type="button" 
                                            onClick={() => {
                                              setSubmissionForm({
                                                ...submissionForm,
                                                attachedFiles: submissionForm.attachedFiles.filter((_, i) => i !== idx)
                                              });
                                            }}
                                            className="text-slate-500 hover:text-white"
                                          >
                                            &times;
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div className="pt-2">
                                  <button
                                    type="submit"
                                    disabled={uploading || isSubmittingSubmission}
                                    className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1.5"
                                  >
                                    {(uploading || isSubmittingSubmission) && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                                    <span>{isSubmittingSubmission ? 'Submitting homework archive...' : uploading ? 'Waiting for file uploads...' : 'Submit Assignment'}</span>
                                  </button>
                                </div>
                              </form>
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
                  <h3 className="font-semibold text-white text-sm">No Assignments Available</h3>
                  <p className="text-xs text-slate-450 mt-1">Assignments are assigned by course educators and administrators.</p>
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

              {attendance.length > 0 ? (
                <div className="grid md:grid-cols-12 gap-6">
                  {/* Left list */}
                  <div className="md:col-span-5 space-y-4">
                    <span className="text-xs font-bold tracking-widest text-slate-500 uppercase">Sessions Checked In</span>
                    <div className="space-y-2">
                      {attendance.map(a => {
                        const sessObj = sessions.find(s => s.id === a.sessionId);
                        if (!sessObj) return null;
                        const filled = hasSummaryForSession(sessObj.id);

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
                              <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded ${filled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-purple-500/10 text-purple-400'}`}>
                                {filled ? 'Reflected' : 'Reflect Now'}
                              </span>
                            </div>
                            <h4 className="font-bold text-xs text-white">{sessObj.name}</h4>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right form */}
                  <div className="md:col-span-7">
                    {activeSessionSummary ? (
                      <div className="glass-panel p-5 rounded-2xl bg-slate-950/45 border-slate-900 space-y-4">
                        <div className="border-b border-slate-900/60 pb-2">
                          <span className="text-[10px] font-mono text-cyan-400 uppercase">SESSION SURVEY FIELD</span>
                          <h3 className="font-display font-extrabold text-base text-white">{activeSessionSummary.name}</h3>
                          <p className="text-[11px] text-slate-450 mt-1">Character limits: Min 30 characters required under summary & learnings.</p>
                        </div>

                        {hasSummaryForSession(activeSessionSummary.id) ? (
                          <div className="bg-emerald-500/5 border border-emerald-500/10 p-5 rounded-xl text-xs space-y-2 text-emerald-400">
                            <CheckCircle className="h-5 w-5" />
                            <span className="font-bold block">Academic reflection registered!</span>
                            <p className="text-[11px] text-slate-400">Your notes and feedback have been compiled under the admin database reports.</p>
                          </div>
                        ) : (
                          <form onSubmit={handleSummarySubmit} className="space-y-4 pt-1">
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
                                <span>{isSubmittingSummary ? 'Filing evaluation in database...' : 'Submit Session Feedback'}</span>
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    ) : (
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

              {notifications.length > 0 ? (
                <div className="space-y-3">
                  {notifications.map(notif => {
                    const isRead = notif.readBy && notif.readBy.includes(studentProfile.id);
                    return (
                      <div key={notif.id} className={`glass-panel p-4 rounded-xl border flex space-x-3.5 items-start transition-all ${isRead ? 'bg-slate-950/45 border-slate-900 opacity-75' : 'bg-slate-900/30 border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.02)]'}`}>
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${isRead ? 'bg-slate-900 text-slate-500' : 'bg-cyan-500/10 text-cyan-400 animate-pulse'}`}>
                          <Info className="h-4 w-4" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-sm text-white">{notif.title}</h4>
                              {!isRead && (
                                <span className="inline-block h-2 w-2 rounded-full bg-cyan-400" title="Unread" />
                              )}
                            </div>
                            <span className="text-[10px] text-slate-550 font-mono">{new Date(notif.createdAt).toLocaleDateString()}</span>
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">{notif.message}</p>
                          
                          {/* Individual Actions */}
                          <div className="flex items-center space-x-2 pt-2">
                            {!isRead && (
                              <button
                                onClick={() => handleMarkIndividualAsRead(notif.id)}
                                className="text-[10px] text-cyan-400 border border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/15 font-semibold px-2 py-0.5 rounded transition-all cursor-pointer font-sans"
                              >
                                Mark as Read
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteIndividual(notif.id)}
                              className="text-[10px] text-slate-500 hover:text-rose-400 border border-transparent hover:border-rose-500/20 bg-transparent hover:bg-rose-500/5 px-2 py-0.5 rounded transition-all cursor-pointer flex items-center gap-1 font-sans"
                              title="Delete notification"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="glass-panel p-8 text-center flex flex-col items-center justify-center space-y-3 bg-slate-950/45 border-slate-900">
                  <div className="h-12 w-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
                    <Bell className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-white text-sm mt-1">No Notifications Available</h3>
                  <p className="text-xs text-slate-450 mt-1">Broadcaster streams will populate here index entries once they go live.</p>
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
            />
          )}

        </div>

      </div>

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

    </div>
  );
}
