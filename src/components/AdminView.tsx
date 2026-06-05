/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Calendar, 
  MapPin, 
  User as UserIcon, 
  Users, 
  Clock, 
  Video, 
  QrCode, 
  Scan,
  TrendingUp, 
  CheckCircle, 
  Check,
  X, 
  Download, 
  Edit3, 
  Trash2, 
  BookOpen, 
  FileText, 
  Link as LinkIcon, 
  ExternalLink,
  Search,
  Bell,
  RefreshCw,
  LogOut,
  Sparkles,
  BarChart3,
  Award,
  Sun,
  Moon,
  XCircle,
  FileCheck,
  Star
} from 'lucide-react';
import StudentReportView from './StudentReportView';
import { 
  sessionService, 
  attendanceService, 
  assignmentService, 
  summaryService, 
  notificationService, 
  storageService,
  authService,
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
  AppNotification 
} from '../types';
import { exportToCSV, printFormattedReport } from '../utils/export';
import { QRScannerModal } from './QRManager';
import { getAssignmentStatus } from '../utils/assignmentUtils';
import { DEPARTMENT_OPTIONS, normalizeDepartmentName } from '../utils/departmentUtils';

interface AdminViewProps {
  adminProfile: Profile;
  onLogout: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export default function AdminView({ adminProfile, onLogout, showToast, theme, toggleTheme }: AdminViewProps) {
  // State lists
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [summaries, setSummaries] = useState<SessionSummary[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showAdminClearConfirm, setShowAdminClearConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    title?: string;
    message?: string;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [studentProfiles, setStudentProfiles] = useState<Profile[]>([]);
  const [selectedStudentReport, setSelectedStudentReport] = useState<Profile | null>(null);
  const [reportsSearch, setReportsSearch] = useState('');
  const [reportsDeptFilter, setReportsDeptFilter] = useState('');
  const [attendanceDeptFilter, setAttendanceDeptFilter] = useState('');

  // Use strictly the same department dropdown source to prevent future list divergence
  const dynamicDepartments = DEPARTMENT_OPTIONS;

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'sessions' | 'attendance' | 'assignments' | 'summaries' | 'analytics' | 'approvals' | 'reports'>('sessions');

  // Filter selections
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');

  // Modals & form fields state
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [sessionForm, setSessionForm] = useState({
    name: '',
    description: '',
    date: '',
    startTime: '',
    endTime: '',
    venue: '',
    hostedBy: '',
    resourcePerson: '',
    numberOfVolunteers: 0
  });

  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [assignmentForm, setAssignmentForm] = useState({
    title: '',
    description: '',
    resources: '',
    deadline: '',
    sessionId: '',
    attachedLinks: '',
    attachedFiles: [] as Array<{name: string, url: string, size?: string}>
  });

  // Manual check-in details
  const [showManualCheckInModal, setShowManualCheckInModal] = useState(false);
  const [manualCheckIn, setManualCheckIn] = useState({
    fullName: '',
    usn: '',
    department: '',
    sessionId: ''
  });

  // QR presentation modal
  const [activeQRSession, setActiveQRSession] = useState<Session | null>(null);
  const [showAdminScanner, setShowAdminScanner] = useState(false);
  const [scanningSessionId, setScanningSessionId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const loadAdminMetricsCountRef = useRef(0);

  const loadAdminMetricsDebounced = useRef(
    debounce(() => {
      loadAdminMetrics();
    }, 1000)
  ).current;

  // Auto-refresh tick to update states dynamically on the admin dashboard
  useEffect(() => {
    loadAdminMetrics();

    const handleActivity = () => {
      setTick(t => t + 1);
      loadAdminMetricsDebounced();
    };
    window.addEventListener('focus', handleActivity);
    window.addEventListener('visibilitychange', handleActivity);

    // Setup real-time Supabase subscriptions using specific listener helper
    // wrapped in debounced updates to prevent socket and database flooding!
    const cleanup = subscribeToDatabaseChanges(() => {
      console.log("[Supabase Realtime Event RECEIVED at Admin] Reloading admin metrics debounced...");
      loadAdminMetricsDebounced();
    });

    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 60000);

    return () => {
      window.removeEventListener('focus', handleActivity);
      window.removeEventListener('visibilitychange', handleActivity);
      clearInterval(interval);
      cleanup();
    };
  }, [loadAdminMetricsDebounced]);

  // File uploading states
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Search input
  const [searchQuery, setSearchQuery] = useState('');

  const [adminEnteredToken, setAdminEnteredToken] = useState('');
  const [isVerifyingAdminToken, setIsVerifyingAdminToken] = useState(false);

  const handleVerifyToken = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!adminEnteredToken.trim()) {
      showToast('Please enter an attendance token to verify.', 'info');
      return;
    }
    setIsVerifyingAdminToken(true);
    try {
      const res = await attendanceTokenService.verifyAndMarkAttendance(adminEnteredToken.trim());
      if (res.success) {
        showToast('Attendance Verified Successfully', 'success');
        setAdminEnteredToken('');
        loadAdminMetrics();
      } else {
        showToast(res.message || 'Invalid Token', 'error');
      }
    } catch (err: any) {
      showToast('Invalid Token', 'error');
    } finally {
      setIsVerifyingAdminToken(false);
    }
  };

  const handleAdminVerifyQR = async (tokenString: string): Promise<boolean> => {
    try {
      const result = await attendanceTokenService.verifyAndMarkAttendance(tokenString);
      if (result.success) {
        showToast('Attendance Verified Successfully', 'success');
        loadAdminMetrics();
        return true;
      } else {
        showToast(result.message || 'Invalid Token', 'error');
        return false;
      }
    } catch (err: any) {
      showToast('Invalid Token', 'error');
      return false;
    }
  };

  const handleAdminMarkAllAsRead = async () => {
    try {
      setNotifications(prev => prev.map(n => ({ ...n, readBy: [...(n.readBy || []), adminProfile.id] })));
      await notificationService.markAllAsRead(adminProfile.id, 'admin');
      showToast('All notifications marked as read', 'success');
      loadAdminMetrics();
    } catch (err) {
      showToast('Failed to mark notifications as read', 'error');
    }
  };

  const handleAdminClearAll = async () => {
    try {
      setNotifications([]);
      await notificationService.clearAllNotifications('admin');
      showToast('Notifications pipeline cleared successfully.', 'success');
      setShowAdminClearConfirm(false);
      loadAdminMetrics();
    } catch (err) {
      showToast('Failed to clear notifications roster.', 'error');
    }
  };

  const handleAdminDeleteIndividual = (id: string) => {
    setDeleteConfirm({
      isOpen: true,
      onConfirm: async () => {
        try {
          setNotifications(prev => prev.filter(n => n.id !== id));
          const success = await notificationService.deleteNotification(id);
          if (success) {
            showToast('Notification deleted successfully', 'success');
            loadAdminMetrics();
          } else {
            showToast('Unable to delete notification. Check permissions.', 'error');
          }
        } catch (err: any) {
          showToast(`Unable to delete notification: ${err.message || err}`, 'error');
        }
      }
    });
  };

  const handleAdminMarkIndividualAsRead = async (id: string) => {
    try {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, readBy: [...(n.readBy || []), adminProfile.id] } : n));
      await notificationService.markAsRead(id, adminProfile.id);
      showToast('Notification marked as read.', 'success');
      loadAdminMetrics();
    } catch (err) {
      showToast('Failed to change read status.', 'error');
    }
  };

  // Fetch all core admin metrics helper
  const loadAdminMetrics = async () => {
    loadAdminMetricsCountRef.current++;
    console.log(`[Admin Metrics Audit] loadAdminMetrics called (Count: ${loadAdminMetricsCountRef.current})`);
    // Isolate each API query so failures in individual modules do not block student profiles/approvals refreshing
    try {
      const sessList = await sessionService.getSessions();
      setSessions(sessList || []);
      if (sessList && sessList.length > 0 && !selectedSessionId) {
        setSelectedSessionId(sessList[0].id);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }

    try {
      const attList = await attendanceService.getAttendance();
      setAttendance(attList || []);
    } catch (err) {
      console.error('Failed to load attendance:', err);
    }

    try {
      const assignList = await assignmentService.getAssignments();
      setAssignments(assignList || []);
      if (assignList && assignList.length > 0 && !selectedAssignmentId) {
        setSelectedAssignmentId(assignList[0].id);
      }
    } catch (err) {
      console.error('Failed to load assignments:', err);
    }

    try {
      const subList = await assignmentService.getSubmissions();
      setSubmissions(subList || []);
    } catch (err) {
      console.error('Failed to load submissions:', err);
    }

    try {
      const sumList = await summaryService.getSessionSummaries();
      setSummaries(sumList || []);
    } catch (err) {
      console.error('Failed to load session summaries:', err);
    }

    try {
      const notifList = await notificationService.getNotifications();
      setNotifications(notifList || []);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }

    try {
      const profs = await authService.getStudentProfiles();
      setStudentProfiles(profs || []);
    } catch (errProfs) {
      console.error('Failed to load student profiles:', errProfs);
    }
  };

  // Selected session details loaded on-demand helper is managed via local template bindings

  // Handle Session Form Submission
  const handleSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. PAST DATE / TIME VALIDATION
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeNowStr = `${hours}:${minutes}`;
    
    if (sessionForm.date < todayStr) {
      showToast('Past dates are not allowed.', 'error');
      return;
    }

    if (sessionForm.date === todayStr && sessionForm.startTime < timeNowStr) {
      showToast('Selected session time has already passed.', 'error');
      return;
    }

    if (sessionForm.endTime <= sessionForm.startTime) {
      showToast('End time must be greater than start time.', 'error');
      return;
    }

    try {
      if (editingSession) {
        const success = await sessionService.updateSession(editingSession.id, {
          name: sessionForm.name,
          description: sessionForm.description,
          date: sessionForm.date,
          startTime: sessionForm.startTime,
          endTime: sessionForm.endTime,
          venue: sessionForm.venue,
          hostedBy: sessionForm.hostedBy,
          resourcePerson: sessionForm.resourcePerson,
          numberOfVolunteers: Number(sessionForm.numberOfVolunteers),
          volunteers: sessionForm.volunteers
        });
        if (success) {
          showToast(`Successfully updated session "${sessionForm.name}"`, 'success');
          setShowSessionModal(false);
          setEditingSession(null);
          loadAdminMetrics();
        } else {
          showToast('Failed to update session details', 'error');
        }
      } else {
        const result = await sessionService.createSession({
          name: sessionForm.name,
          description: sessionForm.description,
          date: sessionForm.date,
          startTime: sessionForm.startTime,
          endTime: sessionForm.endTime,
          venue: sessionForm.venue,
          hostedBy: sessionForm.hostedBy,
          resourcePerson: sessionForm.resourcePerson,
          numberOfVolunteers: Number(sessionForm.numberOfVolunteers),
          volunteers: sessionForm.volunteers
        });
        if (result) {
          showToast(`Published Live session: "${sessionForm.name}"`, 'success');
          setShowSessionModal(false);
          loadAdminMetrics();
        } else {
          showToast('Failed to create new session.', 'error');
        }
      }
    } catch (err: any) {
      console.error('Session creation failed:', err);
      showToast(err?.message || 'An architecture error occurred while compiling changes.', 'error');
    }
  };

  const startEditSession = (sess: Session) => {
    setEditingSession(sess);
    setSessionForm({
      name: sess.name,
      description: sess.description,
      date: sess.date,
      startTime: sess.startTime.substring(0, 5),
      endTime: sess.endTime.substring(0, 5),
      venue: sess.venue,
      hostedBy: sess.hostedBy,
      resourcePerson: sess.resourcePerson,
      numberOfVolunteers: sess.numberOfVolunteers
    });
    setShowSessionModal(true);
  };

  const deleteSession = (id: string) => {
    setDeleteConfirm({
      isOpen: true,
      onConfirm: async () => {
        try {
          const success = await sessionService.deleteSession(id);
          if (success) {
            showToast('Item deleted successfully.', 'success');
            loadAdminMetrics();
          } else {
            showToast('Unable to delete item. Please try again.', 'error');
          }
        } catch (err) {
          showToast('Unable to delete item. Please try again.', 'error');
        }
      }
    });
  };

  const startSessionLiveNow = async (id: string) => {
    const success = await sessionService.startSession(id);
    if (success) {
      showToast('Session is now LIVE! QR check-ins are enabled.', 'success');
      loadAdminMetrics();
    } else {
      showToast('Failed to broadcast live session signal.', 'error');
    }
  };

  const endSessionComplete = async (id: string) => {
    const success = await sessionService.endSession(id);
    if (success) {
      showToast('Session safely concluded. Assignment submission open.', 'success');
      loadAdminMetrics();
    } else {
      showToast('Failed to end event tracker.', 'error');
    }
  };

  // Manual Check-In Submit
  const handleManualCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSessionId = manualCheckIn.sessionId || selectedSessionId;
    const cleanUsn = manualCheckIn.usn.trim().toUpperCase();

    if (!cleanSessionId || !manualCheckIn.fullName || !cleanUsn) {
      showToast('Provide required student parameters for manual entry', 'info');
      return;
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(cleanSessionId)) {
      showToast('No valid session target found. Ensure a session is selected.', 'error');
      return;
    }

    // Try to locate user's authentic profile UUID from database via case-insensitive USN lookups
    let realStudentId = crypto.randomUUID();
    try {
      if (supabase) {
        const { data: profileRecord, error: profError } = await supabase
          .from('profiles')
          .select('id')
          .ilike('usn', cleanUsn)
          .maybeSingle();
        if (profileRecord?.id) {
          realStudentId = profileRecord.id;
          console.log("[Manual Check-In Success] Mapped USN to authentic Profile ID:", realStudentId);
        }
      }
    } catch (errLookup) {
      console.warn("User lookup error, falling back to a generated UUID:", errLookup);
    }

    const res = await attendanceService.markAttendance(
      cleanSessionId,
      {
        id: realStudentId,
        fullName: manualCheckIn.fullName,
        usn: cleanUsn,
        department: manualCheckIn.department || 'General'
      },
      'manual'
    );

    if (res.success) {
      showToast(`Checked in ${manualCheckIn.fullName} manually.`, 'success');
      setShowManualCheckInModal(false);
      setManualCheckIn({ fullName: '', usn: '', department: '', sessionId: '' });
      loadAdminMetrics();
    } else {
      showToast(res.error || 'Failed to complete physical check-in.', 'error');
    }
  };

  // Create or Edit Assignments
  const handleAssignmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // DEADLINE VALIDATION
    const deadlineVal = new Date(assignmentForm.deadline);
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    if (deadlineVal < todayMidnight) {
      showToast('Past dates are not allowed.', 'error');
      return;
    }

    if (deadlineVal < now) {
      showToast('Selected session time has already passed.', 'error');
      return;
    }

    const cleanLinks = assignmentForm.attachedLinks
      .split(',')
      .map(lnk => lnk.trim())
      .filter(lnk => lnk !== '');

    try {
      if (editingAssignment) {
        const success = await assignmentService.editAssignment(editingAssignment.id, {
          title: assignmentForm.title,
          description: assignmentForm.description,
          resources: assignmentForm.resources,
          attachedFiles: assignmentForm.attachedFiles,
          attachedLinks: cleanLinks,
          deadline: new Date(assignmentForm.deadline).toISOString(),
          sessionId: assignmentForm.sessionId || undefined
        });
        if (success) {
          showToast('Updated student assignment resources.', 'success');
          setShowAssignmentModal(false);
          setEditingAssignment(null);
          loadAdminMetrics();
        } else {
          showToast('Failed to rewrite homework profile.', 'error');
        }
      } else {
        const res = await assignmentService.createAssignment({
          title: assignmentForm.title,
          description: assignmentForm.description,
          resources: assignmentForm.resources,
          attachedFiles: assignmentForm.attachedFiles,
          attachedLinks: cleanLinks,
          deadline: new Date(assignmentForm.deadline).toISOString(),
          sessionId: assignmentForm.sessionId || undefined
        });
        if (res) {
          showToast('Assignment released to students.', 'success');
          setShowAssignmentModal(false);
          loadAdminMetrics();
        } else {
          showToast('Failed to create student task.', 'error');
        }
      }
    } catch (err: any) {
      console.error("[Assignment Submission Exception Handled]", err);
      showToast(err?.message || 'Assignment creation exception.', 'error');
    }
  };

  const startEditAssignment = (assign: Assignment) => {
    setEditingAssignment(assign);
    setAssignmentForm({
      title: assign.title,
      description: assign.description,
      resources: assign.resources || '',
      deadline: assign.deadline.substring(0, 16), // Format for datetime-local input
      sessionId: assign.sessionId || '',
      attachedLinks: assign.attachedLinks.join(', '),
      attachedFiles: assign.attachedFiles
    });
    setShowAssignmentModal(true);
  };

  const deleteAssignment = (id: string) => {
    setDeleteConfirm({
      isOpen: true,
      onConfirm: async () => {
        try {
          const res = await assignmentService.deleteAssignment(id);
          if (res) {
            showToast('Item deleted successfully.', 'success');
            loadAdminMetrics();
          } else {
            showToast('Unable to delete item. Please try again.', 'error');
          }
        } catch (err) {
          showToast('Unable to delete item. Please try again.', 'error');
        }
      }
    });
  };

  // Support actual mock uploads safely
  const handleResourceFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log("UPLOAD SESSION", session);

        const { data: { user } } = await supabase.auth.getUser();
        console.log("UPLOAD USER", user);

        console.log("[AdminView Upload Session Verification Status - sessionStatus]", {
          currentSession: session,
          currentUser: session?.user || null,
          userId: session?.user?.id || null,
          userEmail: session?.user?.email || null
        });

        // Explicit log lines requested in requirement 3
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

    setUploading(true);
    setUploadProgress(0);
    try {
      const results = [...assignmentForm.attachedFiles];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Explicit size verify (25MB limit)
        const MAX_SIZE_BYTES = 25 * 1024 * 1024;
        if (file.size > MAX_SIZE_BYTES) {
          showToast(`File exceeds size limit: "${file.name}" is over the 25 MB limit.`, 'error');
          continue;
        }

        const res = await storageService.uploadFile('resources', file, (percent) => {
          setUploadProgress(percent);
        });
        if (res.error) {
          showToast(`File upload failed: ${res.error}`, 'error');
        } else {
          const sizeKb = Math.round(file.size / 1024);
          results.push({
            name: file.name,
            url: res.url,
            size: sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`
          });
        }
      }
      setAssignmentForm({ ...assignmentForm, attachedFiles: results });
      showToast('Assets successfully bundled to resources.', 'success');
    } catch (err: any) {
      showToast(`Storage connection failed: ${err.message || err}`, 'error');
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  // Exports reports
  const exportAttendanceCSV = (sess: Session) => {
    const filtered = attendance.filter(a => a.sessionId === sess.id);
    const rows = filtered.map((a, i) => [
      String(i + 1),
      a.studentName,
      a.studentUsn,
      a.studentDept,
      new Date(a.checkInTime).toLocaleString(),
      a.method.toUpperCase()
    ]);
    exportToCSV(
      `Attendance_Report_${sess.name.replace(/\s+/g, '_')}`,
      ['Sl No', 'Full Name', 'University Seat Number (USN)', 'Department', 'Check-In Timestamp', 'Verification Method'],
      rows
    );
    showToast('Downloaded Attendance sheet as Excel CSV.', 'success');
  };

  const exportAttendancePDF = (sess: Session) => {
    const filtered = attendance.filter(a => a.sessionId === sess.id);
    const rows = filtered.map((a, i) => [
      String(i + 1),
      a.studentName,
      a.studentUsn,
      a.studentDept,
      new Date(a.checkInTime).toLocaleString(),
      a.method.toUpperCase()
    ]);

    const totalStudents = filtered.length;
    const qrCount = filtered.filter(a => a.method === 'qr').length;
    const manualCount = filtered.filter(a => a.method === 'manual').length;

    printFormattedReport(
      'Smart Attendance Hub Tracker',
      `Session Report: ${sess.name} (${sess.venue})`,
      ['Sl No', 'Student Name', 'USN ID', 'Branch / Department', 'Checked In Time', 'Origin Method'],
      rows,
      {
        'Total Check-Ins': totalStudents,
        'QR Scanned Count': qrCount,
        'Manual Entries': manualCount,
        'Hosting Body': sess.hostedBy
      }
    );
  };

  const getSubmissionsForAssignment = (assignId: string) => {
    return submissions.filter(s => s.assignmentId === assignId);
  };

  const getSummariesForSession = (sessId: string) => {
    return summaries.filter(s => s.sessionId === sessId);
  };

  const handleApproveStudent = async (studentId: string) => {
    // Capture snapshot of old state for robust rollback
    const rollbackProfiles = [...studentProfiles];
    
    // Update local state optimistically
    setStudentProfiles(prev => 
      prev.map(p => p.id === studentId ? { ...p, accountStatus: 'Approved' } : p)
    );

    console.log("[Student Approval Action - Approve Request]", {
      selected_student_id: studentId,
      updatePayload: { accountStatus: 'Approved' }
    });
    
    try {
      const result = await authService.updateStudentStatus(studentId, 'Approved');
      console.log("[Student Approval Action - Approve Result]", {
        selected_student_id: studentId,
        updateResult: result
      });

      if (result.success) {
        showToast('Student Approved successfully!', 'success');
        // Immediately trigger refresh of the query to align state with DB truth
        await loadAdminMetrics();
      } else {
        // Roll back original state on failure
        setStudentProfiles(rollbackProfiles);
        showToast(result.error || 'Failed to update student status.', 'error');
      }
    } catch (err: any) {
      console.error("[Student Approval Action - Approve Exception]", err);
      // Roll back original state on exception
      setStudentProfiles(rollbackProfiles);
      showToast('An error occurred during status update.', 'error');
    }
  };

  const handleRejectStudent = (studentId: string) => {
    setDeleteConfirm({
      isOpen: true,
      title: 'Reject Student Authorization',
      message: 'Are you sure you want to reject this student\'s account request? They will no longer be able to log in or mark attendance.',
      onConfirm: async () => {
        // Capture snapshot of old state for robust rollback
        const rollbackProfiles = [...studentProfiles];
        
        // Update local state optimistically
        setStudentProfiles(prev => 
          prev.map(p => p.id === studentId ? { ...p, accountStatus: 'Rejected' } : p)
        );

        console.log("[Student Approval Action - Reject Request]", {
          selected_student_id: studentId,
          updatePayload: { accountStatus: 'Rejected' }
        });
        
        try {
          const result = await authService.updateStudentStatus(studentId, 'Rejected');
          console.log("[Student Approval Action - Reject Result]", {
            selected_student_id: studentId,
            updateResult: result
          });

          if (result.success) {
            showToast('Student Rejected successfully!', 'success');
            // Immediately trigger refresh of the query to align state with DB truth
            await loadAdminMetrics();
          } else {
            // Roll back original state on failure
            setStudentProfiles(rollbackProfiles);
            showToast(result.error || 'Unable to update student status. Please try again.', 'error');
          }
        } catch (err: any) {
          console.error("[Student Approval Action - Reject Exception]", err);
          // Roll back original state on exception
          setStudentProfiles(rollbackProfiles);
          showToast(err?.message || 'Unable to update student status. Please try again.', 'error');
        }
      }
    });
  };

  // Time calculations for automatic state
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

  // Analytics Helpers
  const totalProfiles = attendance.map(a => a.studentUsn);
  const uniqueAttendees = Array.from(new Set(totalProfiles)).length;
  const liveSessionsCount = sessions.filter(s => getSessionState(s) === 'Live').length;
  const expiredSessionsCount = sessions.filter(s => getSessionState(s) === 'Completed').length;
  const pendingStudentsCount = studentProfiles.filter(p => !p.accountStatus || p.accountStatus === 'Pending').length;
  const approvedStudentsCount = studentProfiles.filter(p => p.accountStatus === 'Approved').length;
  const totalSessionsCount = sessions.length;
  const totalAssignmentsCount = assignments.length;
  
  const attendancePercentage = attendance.length > 0 && approvedStudentsCount > 0 && totalSessionsCount > 0 
    ? Math.min(Math.round((attendance.length / (totalSessionsCount * approvedStudentsCount)) * 100), 100)
    : 0;

  const getDepartmentStats = () => {
    if (attendance.length === 0) {
      return [];
    }
    const rawDepts = attendance.map(a => a.studentDept || 'Others');
    const normalizedDepts = rawDepts.map(d => normalizeDepartmentName(d));
    
    const counts: Record<string, number> = {};
    normalizedDepts.forEach(d => {
      counts[d] = (counts[d] || 0) + 1;
    });
    
    const total = normalizedDepts.length;
    const stats = Object.entries(counts)
      .map(([name, count]) => ({
        name,
        percentage: Math.round((count / total) * 100)
      }))
      .sort((a, b) => b.percentage - a.percentage);

    // Verification Logs for Requirement 6
    console.log("=== DEPARTMENT ANALYTICS INTEGRITY VERIFICATION LOG ===");
    console.log("Raw Department Values:", rawDepts);
    console.log("Normalized Department Values:", Array.from(new Set(normalizedDepts)));
    console.log("Grouped Analytics Output:", stats.map(s => `${s.name} -> ${s.percentage}%`));
    console.log("======================================================");

    return stats;
  };

  // Filter lists by Search query
  const filteredSessions = sessions.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.venue.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.resourcePerson.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Date and Time limits for form validations
  const nowForMin = new Date();
  const localToday = `${nowForMin.getFullYear()}-${String(nowForMin.getMonth() + 1).padStart(2, '0')}-${String(nowForMin.getDate()).padStart(2, '0')}`;
  const startMinTime = sessionForm.date === localToday
    ? `${String(nowForMin.getHours()).padStart(2, '0')}:${String(nowForMin.getMinutes()).padStart(2, '0')}`
    : undefined;
  
  const offset = nowForMin.getTimezoneOffset() * 60000;
  const localIsoNow = new Date(nowForMin.getTime() - offset).toISOString().slice(0, 16);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* CYBERPUNK HUD NAVBAR */}
      <header className="border-b border-cyan-500/10 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-4 md:px-8 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-display font-extrabold text-lg text-white tracking-tight">Smart Attendance Hub</div>
            <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest flex items-center">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse mr-1.5" />
              Admin Portal: {adminProfile.fullName} ({adminProfile.adminId})
            </div>
          </div>
        </div>

        {/* Global Search Interface */}
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search sessions or resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="glass-input w-full pl-9 pr-4 py-2 rounded-xl text-xs"
          />
        </div>

        {/* User context action */}
        <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
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
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-950 transition-all text-xs"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 grid md:grid-cols-12 gap-8">
        
        {/* Left hand Sidebar Navigation panel */}
        <div className="md:col-span-3 flex flex-col space-y-4">
          
          <div className="glass-panel p-4.5 rounded-2xl flex flex-col space-y-2">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-2">Workspace Navigation</span>
            
            <button
              onClick={() => setActiveTab('sessions')}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-left transition-all duration-200 flex items-center space-x-3 ${activeTab === 'sessions' ? 'bg-cyan-500 text-slate-950 font-extrabold shadow-[0_0_15px_rgba(6,182,212,0.25)]' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
            >
              <Calendar className="h-4 w-4" />
              <span>Session Management</span>
            </button>

            <button
              onClick={() => setActiveTab('attendance')}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-left transition-all duration-200 flex items-center space-x-3 ${activeTab === 'attendance' ? 'bg-cyan-500 text-slate-950 font-extrabold shadow-[0_0_15px_rgba(6,182,212,0.25)]' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
            >
              <Users className="h-4 w-4" />
              <span>Attendance Management</span>
            </button>

            <button
              onClick={() => setActiveTab('assignments')}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-left transition-all duration-200 flex items-center space-x-3 ${activeTab === 'assignments' ? 'bg-cyan-500 text-slate-950 font-extrabold shadow-[0_0_15px_rgba(6,182,212,0.25)]' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
            >
              <BookOpen className="h-4 w-4" />
              <span>Assignments</span>
            </button>

            <button
              onClick={() => setActiveTab('summaries')}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-left transition-all duration-200 flex items-center space-x-3 ${activeTab === 'summaries' ? 'bg-cyan-500 text-slate-950 font-extrabold shadow-[0_0_15px_rgba(6,182,212,0.25)]' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
            >
              <FileText className="h-4 w-4" />
              <span>Session Feedback</span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-left transition-all duration-200 flex items-center space-x-3 ${activeTab === 'analytics' ? 'bg-cyan-500 text-slate-950 font-extrabold shadow-[0_0_15px_rgba(6,182,212,0.25)]' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
            >
              <BarChart3 className="h-4 w-4" />
              <span>Reports & Analytics</span>
            </button>

            <button
              onClick={() => setActiveTab('approvals')}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-left transition-all duration-200 flex items-center space-x-3 ${activeTab === 'approvals' ? 'bg-cyan-500 text-slate-950 font-extrabold shadow-[0_0_15px_rgba(6,182,212,0.25)]' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
            >
              <Award className="h-4 w-4" />
              <span>Student Approvals</span>
            </button>

            <button
              onClick={() => setActiveTab('reports')}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-left transition-all duration-200 flex items-center space-x-3 ${activeTab === 'reports' ? 'bg-cyan-500 text-slate-950 font-extrabold shadow-[0_0_15px_rgba(6,182,212,0.25)]' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
            >
              <FileCheck className="h-4 w-4" />
              <span>Student Progress Cards</span>
            </button>
          </div>

          {/* Quick Hub Stats info */}
          <div id="hub-quick-metrics-panel" className="glass-panel p-4.5 rounded-2xl bg-slate-950/45 text-xs space-y-3">
            <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 block border-b border-slate-900/60 pb-1.5">Hub Quick-Metrics</span>
            <div className="grid grid-cols-2 gap-2.5">
              <div id="metric-approved-students" className="bg-slate-900/40 p-2 border border-slate-800/80 rounded-xl">
                <div className="text-slate-400 text-[8.5px] uppercase tracking-wider font-semibold">Total Approved</div>
                <div className="font-display font-black text-base text-white mt-0.5">{approvedStudentsCount}</div>
              </div>
              <div id="metric-pending-approvals" className="bg-slate-900/40 p-2 border border-slate-800/80 rounded-xl">
                <div className="text-slate-400 text-[8.5px] uppercase tracking-wider font-semibold">Pending Appr.</div>
                <div className="font-display font-black text-base text-amber-400 mt-0.5">{pendingStudentsCount}</div>
              </div>
              <div id="metric-total-sessions" className="bg-slate-900/40 p-2 border border-slate-800/80 rounded-xl">
                <div className="text-slate-400 text-[8.5px] uppercase tracking-wider font-semibold">Total Sessions</div>
                <div className="font-display font-black text-base text-white mt-0.5">{totalSessionsCount}</div>
              </div>
              <div id="metric-live-sessions" className="bg-slate-900/40 p-2 border border-slate-800/80 rounded-xl">
                <div className="text-slate-400 text-[8.5px] uppercase tracking-wider font-semibold">Live Sessions</div>
                <div className="font-display font-black text-base text-cyan-400 mt-0.5">{liveSessionsCount}</div>
              </div>
              <div id="metric-attendance-percentage" className="bg-slate-900/40 p-2 border border-slate-800/80 rounded-xl">
                <div className="text-slate-400 text-[8.5px] uppercase tracking-wider font-semibold">Attendance %</div>
                <div className="font-display font-black text-base text-emerald-400 mt-0.5">{attendancePercentage}%</div>
              </div>
              <div id="metric-assignments-count" className="bg-slate-900/40 p-2 border border-slate-800/80 rounded-xl">
                <div className="text-slate-400 text-[8.5px] uppercase tracking-wider font-semibold">Assignments</div>
                <div className="font-display font-black text-base text-purple-400 mt-0.5">{totalAssignmentsCount}</div>
              </div>
            </div>
          </div>

          {/* Dashboard Notifications */}
          <div className="glass-panel p-4 rounded-2xl bg-slate-950/40 text-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#a855f7] flex items-center">
                <Bell className="h-3.5 w-3.5 mr-1 text-[#a855f7]" />
                Broadcast Notifications
              </span>
              {notifications.length > 0 && (
                <button
                  id="admin-clear-notifs-btn"
                  onClick={() => setShowAdminClearConfirm(true)}
                  className="text-[9px] font-extrabold text-[#a855f7] hover:text-white uppercase transition-colors cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            {notifications.length > 0 && (
              <div className="flex items-center justify-end">
                <button
                  onClick={handleAdminMarkAllAsRead}
                  className="text-[9px] font-semibold text-slate-400 hover:text-white flex items-center gap-0.5 transition-colors cursor-pointer"
                >
                  <Check className="h-3 w-3" />
                  <span>Mark All Read</span>
                </button>
              </div>
            )}

            {notifications.length > 0 ? (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {notifications.map(notif => {
                  const isRead = notif.readBy && notif.readBy.includes(adminProfile.id);
                  return (
                    <div key={notif.id} className={`p-2.5 rounded border text-[11px] leading-snug space-y-1 transition-all ${isRead ? 'bg-slate-900/40 border-slate-900 opacity-70' : 'bg-slate-900/80 border-slate-800'}`}>
                      <div className="font-semibold text-white flex justify-between items-start gap-1">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <span className="truncate">{notif.title}</span>
                          {!isRead && (
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400 shrink-0" title="Unread" />
                          )}
                        </div>
                        <span className="text-[8px] text-slate-550 font-mono shrink-0">{new Date(notif.createdAt).toLocaleDateString()}</span>
                      </div>
                      
                      <p className="text-slate-400">{notif.message}</p>
                      
                      <div className="flex items-center justify-between border-t border-slate-900/50 pt-1 mt-1 text-[9px]">
                        {!isRead ? (
                          <button
                            onClick={() => handleAdminMarkIndividualAsRead(notif.id)}
                            className="text-[#a855f7] hover:text-[#c084fc] font-semibold cursor-pointer"
                          >
                            Mark Read
                          </button>
                        ) : (
                          <span className="text-slate-600 font-medium">Read</span>
                        )}
                        <button
                          onClick={() => handleAdminDeleteIndividual(notif.id)}
                          className="text-slate-500 hover:text-rose-400 flex items-center cursor-pointer"
                          title="Delete notification"
                        >
                          <Trash2 className="h-2.5 w-2.5 mr-0.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4 text-slate-500 italic text-[11px]">
                No Notifications Available
              </div>
            )}
          </div>

        </div>

        {/* Main Dashboard Screen Area */}
        <div className="md:col-span-9 space-y-6">

          {/* 1. SESSIONS TAB */}
          {activeTab === 'sessions' && (
            <div className="space-y-4">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-bold text-white flex items-center">
                    <Calendar className="h-5.5 w-5.5 text-cyan-400 mr-2" />
                    Session Management
                  </h2>
                  <p className="text-slate-400 text-xs">Create, schedule, broadcast and track student login events.</p>
                </div>
                
                <button
                  onClick={() => {
                    setEditingSession(null);
                    setSessionForm({
                      name: '',
                      description: '',
                      date: '',
                      startTime: '',
                      endTime: '',
                      venue: '',
                      hostedBy: '',
                      resourcePerson: '',
                      numberOfVolunteers: 0,
                      volunteers: []
                    });
                    setShowSessionModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center space-x-1 shadow-[0_0_15px_rgba(6,182,212,0.2)] cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Schedule Session</span>
                </button>
              </div>

              {/* LIVE BANNER FOR VERIFIED ACTIVE CLASSES */}
              {sessions.filter(s => getSessionState(s) === 'Live').length > 0 ? (
                sessions.filter(s => getSessionState(s) === 'Live').map(s => (
                  <div key={s.id} className="glass-panel-neon-cyan p-5 rounded-2xl bg-cyan-950/20 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="absolute top-0 right-0 h-1 bg-cyan-400 w-full animate-pulse" />
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded bg-cyan-400 text-slate-950 text-[10px] font-black tracking-widest animate-pulse uppercase">LIVE BADGE</span>
                        <span className="text-[10.5px] font-mono text-cyan-300 uppercase tracking-widest font-black">SESSION LIVE NOW</span>
                      </div>
                      <h3 className="font-display font-extrabold text-xl text-white">{s.name}</h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 mt-1">
                        <span className="flex items-center"><MapPin className="h-3.5 w-3.5 text-cyan-400 mr-1" /> {s.venue}</span>
                        <span className="flex items-center"><Clock className="h-3.5 w-3.5 text-cyan-400 mr-1" /> {s.startTime} - {s.endTime}</span>
                        <span className="flex items-center"><UserIcon className="h-3.5 w-3.5 text-cyan-400 mr-1" /> Hosted by {s.hostedBy}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
                      <button
                        onClick={() => {
                          setScanningSessionId(s.id);
                          setShowAdminScanner(true);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-extrabold flex items-center space-x-1.5 transition-all shadow-[0_0_15px_rgba(6,182,212,0.25)] cursor-pointer"
                      >
                        <Scan className="h-4 w-4" />
                        <span>Scan Student QRs</span>
                      </button>
                      <button
                        onClick={() => endSessionComplete(s.id)}
                        className="px-3.5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-500 transition-all cursor-pointer"
                      >
                        Conclude Active Session
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="glass-panel p-5 rounded-2xl flex flex-col items-center justify-center text-center text-slate-500">
                  <div className="p-3 bg-slate-900/60 rounded-full border border-slate-800/80 mb-2">
                    <Clock className="h-5 w-5 text-slate-600" />
                  </div>
                  <span className="text-sm font-semibold">No Sessions Live Currently</span>
                  <p className="text-[11px] text-slate-500 max-w-xs mt-1">Select a past or scheduled registration below to broadcast live check-ins.</p>
                </div>
              )}

              {/* ATTENDANCE VERIFICATION SECTION */}
              <div id="attendance-verification-section" className="glass-panel p-6 rounded-2xl bg-slate-950/60 border border-slate-900 space-y-4">
                <div className="border-b border-slate-900 pb-3">
                  <h3 className="font-display font-extrabold text-base text-white flex items-center gap-2">
                    <QrCode className="h-5 w-5 text-cyan-400" />
                    <span>Attendance Verification</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Verify presence of student attendees manually or by scanning client token identifiers.
                  </p>
                </div>

                {sessions.filter(s => getSessionState(s) === 'Live').length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-5">
                    {/* Option 1: Scan Student QR */}
                    <div id="verify-option-1" className="bg-slate-900/40 p-4.5 border border-slate-800/80 rounded-xl space-y-3.5 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] text-cyan-400 uppercase tracking-wider font-extrabold block">Scan Student QR Code</span>
                        <h4 className="font-bold text-white text-sm font-display mt-0.5">Scan Student QR Code</h4>
                        <p className="text-[11px] text-slate-500 leading-normal mt-1">
                          Align the student's unique attendance QR code inside the scanner to verify attendance.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const liveSess = sessions.find(s => getSessionState(s) === 'Live');
                          if (liveSess) {
                            setScanningSessionId(liveSess.id);
                            setShowAdminScanner(true);
                          } else {
                            showToast('No active live session to scan student QR codes.', 'info');
                          }
                        }}
                        className="w-full py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                      >
                        <Scan className="h-4 w-4" />
                        <span>Scan Student QR</span>
                      </button>
                    </div>

                    {/* Option 2: Enter Attendance Token */}
                    <form onSubmit={handleVerifyToken} id="verify-option-2" className="bg-slate-900/40 p-4.5 border border-slate-800/80 rounded-xl space-y-3 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] text-cyan-400 uppercase tracking-wider font-extrabold block">If QR scanning is unavailable</span>
                        <h4 className="font-bold text-white text-sm font-display mt-0.5">Enter Attendance Token</h4>
                        <p className="text-[11px] text-slate-500 leading-normal mt-1">
                          Manually enter the student's unique attendance token to verify credentials.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <input
                          type="text"
                          id="verify-token-input"
                          required
                          placeholder="Enter Attendance Token"
                          value={adminEnteredToken}
                          onChange={(e) => setAdminEnteredToken(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-xl text-white bg-slate-950 border border-slate-800 focus:border-cyan-500 outline-none font-mono"
                        />
                        <button
                          type="submit"
                          disabled={isVerifyingAdminToken}
                          className="w-full py-2 px-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-white hover:text-cyan-400 font-extrabold text-xs transition-all flex items-center justify-center space-x-1.5 whitespace-nowrap cursor-pointer"
                        >
                          {isVerifyingAdminToken ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle className="h-3.5 w-3.5" />
                          )}
                          <span>Verify Attendance</span>
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-900/40 border border-slate-800/60 rounded-xl text-center space-y-2 text-slate-500">
                    <Clock className="h-6 w-6 text-slate-600 mx-auto" />
                    <h4 className="font-bold text-white text-xs">Verification Locked: No Active Live Session</h4>
                    <p className="text-[11px] max-w-sm mx-auto">
                      Attendance verification can only be performed when a session is live. Please start a session first.
                    </p>
                  </div>
                )}
              </div>

              {/* ALL RECORDED SESSIONS */}
              {filteredSessions.length > 0 ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  {filteredSessions.map(s => (
                    <div key={s.id} className="glass-panel p-5 rounded-2xl relative flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <span className={`text-[9.5px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded flex items-center gap-1 ${
                            getSessionState(s) === 'Completed'
                              ? 'bg-slate-900 text-slate-400 border border-slate-800'
                              : getSessionState(s) === 'Live'
                              ? 'bg-rose-550/10 text-rose-450 border border-rose-550/10'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/10'
                          }`}>
                            {getSessionState(s) === 'Completed' && '✅ Completed'}
                            {getSessionState(s) === 'Live' && '🔴 Live'}
                            {getSessionState(s) === 'Upcoming' && '🟡 Upcoming'}
                          </span>
                          <div className="flex space-x-1">
                            <button 
                              onClick={() => startEditSession(s)}
                              className="p-1 px-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-all text-xs"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button 
                              onClick={() => deleteSession(s.id)}
                              className="p-1 px-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 transition-all text-xs"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <h4 className="font-display font-extrabold text-base text-white">{s.name}</h4>
                        <p className="text-xs text-slate-400 line-clamp-2">{s.description || 'No description provided.'}</p>
                      </div>

                      <div className="space-y-2 border-t border-slate-900/60 pt-3">
                        <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 text-[10.5px] text-slate-400">
                          <span className="truncate flex items-center font-mono">Date: {s.date}</span>
                          <span className="truncate flex items-center">Venue: {s.venue}</span>
                          <span className="truncate flex items-center">Expert: {s.resourcePerson}</span>
                          <span className="truncate flex items-center text-cyan-400 font-bold">Attendees: {attendance.filter(a => a.sessionId === s.id).length} Checked In</span>
                        </div>

                        <div className="flex space-x-2 pt-2">
                          {getSessionState(s) === 'Upcoming' && (
                            <button
                              onClick={() => startSessionLiveNow(s.id)}
                              className="flex-grow py-2 rounded-xl bg-slate-900 hover:bg-orange-500 hover:text-slate-950 text-slate-300 font-bold text-xs transition-all border border-slate-800 hover:border-orange-500 cursor-pointer text-center"
                            >
                              Force Start ⚡
                            </button>
                          )}
                          {getSessionState(s) === 'Live' && (
                            <button
                              onClick={() => endSessionComplete(s.id)}
                              className="flex-grow py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all text-center cursor-pointer"
                            >
                              Force End 🚫
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedSessionId(s.id);
                              setActiveTab('attendance');
                            }}
                            className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-semibold cursor-pointer"
                          >
                            Attendance Records
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="glass-panel p-8 text-center text-slate-500 rounded-2xl">
                  No Sessions Available
                </div>
              )}

            </div>
          )}

          {/* 2. ATTENDANCE RECORDS TAB */}
          {activeTab === 'attendance' && (
            <div className="space-y-4">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-bold text-white flex items-center">
                    <Users className="h-5.5 w-5.5 text-cyan-400 mr-2" />
                    Attendance Management
                  </h2>
                  <p className="text-slate-400 text-xs">Acknowledge checked in students, edit attendance records, or run manual listings.</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setShowManualCheckInModal(true)}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-800 flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Manual Entry</span>
                  </button>

                  {selectedSessionId && sessions.find(s => s.id === selectedSessionId) && (
                    <>
                      <button
                        onClick={() => exportAttendanceCSV(sessions.find(s => s.id === selectedSessionId)!)}
                        className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 text-xs font-bold hover:bg-slate-800 flex items-center space-x-1 cursor-pointer"
                      >
                        <Download className="h-4 w-4" />
                        <span>CSV Export</span>
                      </button>
                      <button
                        onClick={() => exportAttendancePDF(sessions.find(s => s.id === selectedSessionId)!)}
                        className="px-3 py-2 rounded-xl bg-cyan-500 text-slate-950 text-xs font-black hover:bg-cyan-400 flex items-center space-x-1 cursor-pointer"
                      >
                        <FileText className="h-4 w-4" />
                        <span>Print PDF</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Group session & department filters */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="glass-panel p-4 rounded-2xl">
                  <label className="text-xs uppercase font-bold tracking-wider text-slate-400 block mb-2">Filter Attendance Records by Session Name</label>
                  <select
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                    className="glass-input w-full p-2.5 rounded-xl text-xs"
                  >
                    <option value="">-- Choose session from database records --</option>
                    {sessions.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.date} &bull; {s.name} ({s.venue})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="glass-panel p-4 rounded-2xl">
                  <label className="text-xs uppercase font-bold tracking-wider text-slate-400 block mb-2">Filter by Department</label>
                  <select
                    value={attendanceDeptFilter}
                    onChange={(e) => setAttendanceDeptFilter(e.target.value)}
                    className="glass-input w-full p-2.5 rounded-xl text-xs"
                  >
                    <option value="">All Departments</option>
                    {dynamicDepartments.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ATTENDANCE RECORDS DATA TABLE */}
              <div className="glass-panel rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-900/60 bg-slate-900/25 flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-200">
                    Showing {attendance.filter(a => (!selectedSessionId || a.sessionId === selectedSessionId) && (!attendanceDeptFilter || (a.studentDept && normalizeDepartmentName(a.studentDept).toUpperCase() === normalizeDepartmentName(attendanceDeptFilter).toUpperCase()))).length} checked-in records
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900/40 text-[10.5px] uppercase font-bold tracking-wider text-slate-400 border-b border-slate-900/80">
                        <th className="p-4">Student Name</th>
                        <th className="p-4">USN ID</th>
                        <th className="p-4">Department / Branch</th>
                        <th className="p-4">Checked In Timestamp</th>
                        <th className="p-4 text-center">Via Method</th>
                        <th className="p-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs divide-y divide-slate-950">
                      {attendance.filter(a => (!selectedSessionId || a.sessionId === selectedSessionId) && (!attendanceDeptFilter || (a.studentDept && normalizeDepartmentName(a.studentDept).toUpperCase() === normalizeDepartmentName(attendanceDeptFilter).toUpperCase()))).length > 0 ? (
                        attendance.filter(a => (!selectedSessionId || a.sessionId === selectedSessionId) && (!attendanceDeptFilter || (a.studentDept && normalizeDepartmentName(a.studentDept).toUpperCase() === normalizeDepartmentName(attendanceDeptFilter).toUpperCase()))).map(a => (
                          <tr key={a.id} className="hover:bg-slate-900/30 transition-colors">
                            <td className="p-4 font-semibold text-white">{a.studentName}</td>
                            <td className="p-4 font-mono text-cyan-400">{a.studentUsn}</td>
                            <td className="p-4 text-slate-400">{a.studentDept}</td>
                            <td className="p-4 text-slate-400 font-mono">{new Date(a.checkInTime).toLocaleString()}</td>
                            <td className="p-4 text-center">
                              <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${a.method === 'qr' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-purple-500/10 text-purple-400'}`}>
                                {a.method.toUpperCase()}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <button
                                onClick={() => {
                                  setDeleteConfirm({
                                    isOpen: true,
                                    onConfirm: async () => {
                                      try {
                                        const success = await attendanceService.deleteAttendance(a.id);
                                        if (success) {
                                          showToast('Item deleted successfully.', 'success');
                                          loadAdminMetrics();
                                        } else {
                                          showToast('Unable to delete item. Please try again.', 'error');
                                        }
                                      } catch (err) {
                                        showToast('Unable to delete item. Please try again.', 'error');
                                      }
                                    }
                                  });
                                }}
                                className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-500">
                            No Attendance Records Found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* 3. ASSIGNMENTS TAB */}
          {activeTab === 'assignments' && (
            <div className="space-y-4">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-bold text-white flex items-center">
                    <BookOpen className="h-5.5 w-5.5 text-cyan-400 mr-2" />
                    Assignment & Task Hub
                  </h2>
                  <p className="text-slate-400 text-xs">Define tasks, distribute documents, attach external reference materials, and grade student submissions.</p>
                </div>

                <button
                  onClick={() => {
                    setEditingAssignment(null);
                    setAssignmentForm({
                      title: '',
                      description: '',
                      resources: '',
                      deadline: '',
                      sessionId: selectedSessionId,
                      attachedLinks: '',
                      attachedFiles: []
                    });
                    setShowAssignmentModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center space-x-1 shadow-[0_0_15px_rgba(6,182,212,0.2)] cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Release Assignment Task</span>
                </button>
              </div>

              <div className="grid md:grid-cols-12 gap-6">
                
                {/* Assignments List */}
                <div className="md:col-span-5 space-y-4">
                  <div className="text-xs uppercase font-bold tracking-widest text-slate-500">Active Tasks ({assignments.length})</div>
                        {assignments.length > 0 ? (
                    assignments.map(a => {
                      const statusInfo = getAssignmentStatus(a.deadline);
                      return (
                        <div 
                          key={a.id}
                          onClick={() => setSelectedAssignmentId(a.id)}
                          className={`glass-panel p-4 rounded-2xl cursor-pointer transition-all border ${selectedAssignmentId === a.id ? 'border-cyan-500 bg-cyan-950/10' : 'border-slate-900 bg-transparent hover:bg-slate-900/30'}`}
                        >
                          <div className="flex justify-between items-start mb-2.5">
                            <div>
                              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider block">Deadline:</span>
                              <span className="text-[10.5px] font-semibold text-slate-300">
                                {statusInfo.dueDateString} • {statusInfo.dueTimeString}
                              </span>
                            </div>
                            <div className="flex space-x-1" onClick={e => e.stopPropagation()}>
                              <button 
                                onClick={() => startEditAssignment(a)}
                                className="p-1 text-slate-500 hover:text-white"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button 
                                onClick={() => deleteAssignment(a.id)}
                                className="p-1 text-slate-500 hover:text-rose-400"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          <h4 className="font-display font-semibold text-sm text-white mb-1.5">{a.title}</h4>
                          
                          <div className="flex justify-between items-center text-[10px] text-slate-400 border-t border-slate-900/40 pt-2.5 mt-2">
                            <span className={`font-mono ${statusInfo.isClosed ? 'text-slate-500' : 'text-cyan-400 font-bold'}`}>
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
                          
                          <div className="flex justify-between items-center text-[10px] text-slate-500 pt-2 border-t border-slate-900/20 mt-2">
                            <span>Submissions: {getSubmissionsForAssignment(a.id).length} Students</span>
                            <span className="font-semibold text-slate-400">View Submissions &rarr;</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="glass-panel text-center text-slate-500 text-xs py-10">
                      No Assignments Available
                    </div>
                  )}
                </div>

                {/* Assignment Submission records tracker */}
                <div className="md:col-span-7 space-y-4">
                  <div className="text-xs uppercase font-bold tracking-widest text-slate-500">Student Submission Records</div>
                  
                  {selectedAssignmentId && assignments.find(a => a.id === selectedAssignmentId) ? (
                    (() => {
                      const currentAssignObj = assignments.find(a => a.id === selectedAssignmentId)!;
                      const assignSubs = getSubmissionsForAssignment(selectedAssignmentId);
                      const statusInfo = getAssignmentStatus(currentAssignObj.deadline);

                      return (
                        <div className="glass-panel p-5 rounded-2xl space-y-4">
                          <div className="border-b border-slate-900/60 pb-3">
                            <span className="text-[10.5px] font-mono text-cyan-400">Class Task Details</span>
                            <h3 className="font-display font-black text-lg text-white mb-1">{currentAssignObj.title}</h3>
                            <p className="text-slate-400 text-xs leading-relaxed">{currentAssignObj.description}</p>
                            
                            {/* Detailed spec statistics tracker inside Admin portal */}
                            <div className="mt-3.5 grid grid-cols-2 gap-3 bg-slate-900/30 p-3 border border-slate-900 rounded-xl text-xs">
                              <div>
                                <span className="text-slate-500 text-[10px] block font-mono uppercase">Due Date</span>
                                <span className="font-semibold text-slate-300">{statusInfo.dueDateString}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 text-[10px] block font-mono uppercase">Due Time</span>
                                <span className="font-semibold text-slate-300">{statusInfo.dueTimeString}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 text-[10px] block font-mono uppercase">Time Remaining</span>
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
                          </div>

                          <div className="space-y-3">
                            <h4 className="font-semibold text-xs text-slate-200">Active Submissions ({assignSubs.length})</h4>
                            
                            {assignSubs.length > 0 ? (
                              assignSubs.map(sub => (
                                <div key={sub.id} className="bg-slate-950/60 border border-slate-900 p-4 rounded-xl space-y-3">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <div className="font-semibold text-xs text-white">{sub.studentName}</div>
                                      <div className="text-[10.5px] font-mono text-cyan-400">{sub.studentUsn}</div>
                                    </div>
                                    <span className="text-[10.5px] font-mono text-slate-500">Filed: {new Date(sub.submittedAt).toLocaleDateString()}</span>
                                  </div>

                                  {/* Submissions items (Files & links) */}
                                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                                    
                                    {sub.attachedFiles.map((file, idx) => (
                                      <button
                                        key={idx}
                                        type="button"
                                        onClick={async (e) => {
                                          e.preventDefault();
                                          await storageService.openFile(file.url, file.name);
                                        }}
                                        className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 flex items-center space-x-1.5 truncate text-[10.5px] cursor-pointer text-left w-full"
                                      >
                                        <FileText className="h-3.5 w-3.5 text-cyan-500 shrink-0" />
                                        <span className="truncate">{file.name}</span>
                                      </button>
                                    ))}

                                    {sub.attachedLinks.map((lnk, idx) => (
                                      <a
                                        key={idx}
                                        href={lnk}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-purple-400 flex items-center space-x-1.5 truncate text-[10.5px]"
                                      >
                                        <LinkIcon className="h-3.5 w-3.5 text-purple-500" />
                                        <span className="truncate">{lnk}</span>
                                      </a>
                                    ))}

                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-slate-500 text-xs text-center py-6">No Student has submitted homework for this target deadline yet.</p>
                            )}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="glass-panel p-6 rounded-2xl text-center text-slate-500 text-xs">
                      Select an assignment on the sidebar to view submissions.
                    </div>
                  )}

                </div>

              </div>

            </div>
          )}

          {/* 4. SUMMARIES & REFLECTIONS TAB */}
          {activeTab === 'summaries' && (() => {
            const currentSubmissions = summaries.filter(s => !selectedSessionId || s.sessionId === selectedSessionId);
            const totalCount = currentSubmissions.length;
            
            // Calculate average sub-ratings
            const getAverage = (key: 'rating' | 'contentQualityRating' | 'instructorRating' | 'relevanceRating' | 'engagementRating') => {
              if (totalCount === 0) return '0.0';
              const sumVal = currentSubmissions.reduce((acc, curr) => {
                const val = curr[key] !== undefined && curr[key] !== null ? curr[key] : (curr.rating || 5);
                return acc + val;
              }, 0);
              return (sumVal / totalCount).toFixed(1);
            };

            // Calculate impact and confidence percentages
            const getPercentage = (field: 'learningImpact' | 'confidenceLevel', value: string) => {
              if (totalCount === 0) return '0%';
              const count = currentSubmissions.filter(s => s[field] === value).length;
              return `${Math.round((count / totalCount) * 100)}%`;
            };

            return (
              <div className="space-y-6">
                <div>
                  <h2 className="font-display text-2xl font-bold text-white flex items-center">
                    <FileText className="h-5.5 w-5.5 text-cyan-400 mr-2" />
                    Session Feedback Analytics & Logs
                  </h2>
                  <p className="text-slate-400 text-xs">Analyze student rating cards, evaluated learning impacts, and overall instructor feedback from check-in sessions.</p>
                </div>

                {/* Filtering session timeline */}
                <div className="glass-panel p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1.5">Filter by academic session timeline</label>
                    <select
                      value={selectedSessionId}
                      onChange={(e) => setSelectedSessionId(e.target.value)}
                      className="glass-input w-full p-2.5 rounded-xl text-xs"
                    >
                      <option value="">-- All Checked-in Class Timelines --</option>
                      {sessions.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.date} &bull; {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="bg-slate-900/60 border border-slate-800/85 px-4 py-2.5 rounded-xl shrink-0 flex items-center space-x-3">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total Evaluations</span>
                    <span className="font-mono text-xl font-extrabold text-cyan-405">{totalCount}</span>
                  </div>
                </div>

                {/* Aggregated analytical widgets */}
                {totalCount > 0 && (
                  <div className="grid sm:grid-cols-3 gap-4">
                    {/* Star ratings averages */}
                    <div className="glass-panel p-4.5 rounded-2xl bg-slate-950/65 border-cyan-500/10 space-y-3 shadow-md">
                      <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center">
                        <Star className="h-3.5 w-3.5 text-cyan-450 mr-1.5 fill-cyan-400" />
                        Average Star Evaluations
                      </h4>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between items-center text-slate-300">
                          <span className="text-slate-400">⭐ Overall Rating:</span>
                          <span className="font-mono font-semibold text-white">{getAverage('rating')} / 5</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-300">
                          <span className="text-slate-400">⭐ Content Quality:</span>
                          <span className="font-mono font-semibold text-cyan-400">{getAverage('contentQualityRating')} / 5</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-300">
                          <span className="text-slate-400">⭐ Instructor Explanation:</span>
                          <span className="font-mono font-semibold text-cyan-400">{getAverage('instructorRating')} / 5</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-300">
                          <span className="text-slate-400">⭐ Practical Relevance:</span>
                          <span className="font-mono font-semibold text-cyan-400">{getAverage('relevanceRating')} / 5</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-300">
                          <span className="text-slate-400">⭐ Engagement & Interaction:</span>
                          <span className="font-mono font-semibold text-cyan-400">{getAverage('engagementRating')} / 5</span>
                        </div>
                      </div>
                    </div>

                    {/* Learning Impact Distribution */}
                    <div className="glass-panel p-4.5 rounded-2xl bg-slate-950/65 border-emerald-500/10 space-y-3">
                      <h4 className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center">
                        <Award className="h-3.5 w-3.5 mr-1.5" />
                        Learning Impact Metrics
                      </h4>
                      <div className="space-y-1.5 text-xs">
                        {['Significant Improvement', 'Moderate Improvement', 'Slight Improvement', 'No Improvement'].map((opt) => (
                          <div key={opt} className="flex justify-between items-center text-slate-300">
                            <span className="text-slate-400 text-[11px]">{opt}:</span>
                            <span className="font-mono font-bold text-white">{getPercentage('learningImpact', opt)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Confidence Level Distribution */}
                    <div className="glass-panel p-4.5 rounded-2xl bg-slate-950/65 border-amber-500/10 space-y-3">
                      <h4 className="text-[10px] uppercase font-bold text-amber-550 tracking-wider flex items-center">
                        <Sparkles className="h-3.5 w-3.5 mr-1.5 text-amber-400" />
                        Confidence Levels
                      </h4>
                      <div className="space-y-1.5 text-xs font-sans">
                        {['Beginner', 'Intermediate', 'Advanced'].map((opt) => (
                          <div key={opt} className="flex justify-between items-center text-slate-300">
                            <span className="text-slate-400 text-[11px]">{opt} Level:</span>
                            <span className="font-mono font-bold text-white">{getPercentage('confidenceLevel', opt)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Feedback Logs List */}
                <div className="grid md:grid-cols-2 gap-4">
                  {currentSubmissions.length > 0 ? (
                    currentSubmissions.map(sum => {
                      const isPlaceholder = sum.summary === "Class feedback filed via modern simplified rating system.";
                      return (
                        <div key={sum.id} className="glass-panel p-5 rounded-2xl space-y-3.5 bg-slate-950/45 border border-slate-900">
                          
                          <div className="flex justify-between items-start border-b border-slate-900/60 pb-3">
                            <div className="min-w-0 flex-1">
                              <h4 className="font-semibold text-white text-xs truncate">{sum.studentName}</h4>
                              <span className="font-mono text-[10px] text-cyan-400 block mt-0.5">{sum.studentUsn}</span>
                            </div>
                            <div className="flex items-center space-x-2 shrink-0">
                              <span className="text-[10px] text-slate-500 font-mono bg-slate-900 border border-slate-800/80 px-2 py-0.5 rounded-md">
                                {new Date(sum.submittedAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-[10px] bg-slate-900/10 border border-slate-900/30 p-2.5 rounded-xl">
                            <div className="flex flex-col items-start">
                              <span className="text-slate-500 tracking-wider uppercase text-[8.5px] font-bold">Overall</span> 
                              <span className="font-mono font-extrabold text-cyan-400 text-xs mt-0.5">{sum.rating || 5}/5</span>
                            </div>
                            <div className="flex flex-col items-start border-l border-slate-900/50 pl-2">
                              <span className="text-slate-500 tracking-wider uppercase text-[8.5px] font-bold">Impact</span> 
                              <span className="font-bold text-emerald-450 mt-0.5 text-[9.5px] truncate max-w-[95px]" title={sum.learningImpact || 'Moderate Improvement'}>
                                {sum.learningImpact || 'Moderate'}
                              </span>
                            </div>
                            <div className="flex flex-col items-start border-l border-slate-900/50 pl-2">
                              <span className="text-slate-500 tracking-wider uppercase text-[8.5px] font-bold">Confidence</span> 
                              <span className="font-bold text-amber-500 mt-0.5 text-[9.5px]">{sum.confidenceLevel || 'Intermediate'}</span>
                            </div>
                          </div>

                          {/* Star Ratings Grid Details */}
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px] text-slate-400 border-t border-slate-900/30 pt-2.5 pb-1 bg-slate-950/20 px-2 rounded-lg">
                            <div className="flex justify-between items-center">
                              <span>⭐ Content Quality:</span>
                              <span className="font-mono font-semibold text-slate-300">{(sum.contentQualityRating !== undefined && sum.contentQualityRating !== null) ? sum.contentQualityRating : (sum.rating || 5)}/5</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>⭐ Clarity of Explanation:</span>
                              <span className="font-mono font-semibold text-slate-300">{(sum.instructorRating !== undefined && sum.instructorRating !== null) ? sum.instructorRating : (sum.rating || 5)}/5</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>⭐ Practical Relevance:</span>
                              <span className="font-mono font-semibold text-slate-300">{(sum.relevanceRating !== undefined && sum.relevanceRating !== null) ? sum.relevanceRating : (sum.rating || 5)}/5</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>⭐ Engagement & Interaction:</span>
                              <span className="font-mono font-semibold text-slate-300">{(sum.engagementRating !== undefined && sum.engagementRating !== null) ? sum.engagementRating : (sum.rating || 5)}/5</span>
                            </div>
                          </div>

                          {/* Additional Comments Block */}
                          <div className="space-y-2.5 text-xs text-slate-300">
                            <div>
                              <div className="text-[9px] uppercase font-bold text-slate-500 mb-1 tracking-wider">💡 Additional Comments</div>
                              <p className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-905 leading-relaxed text-slate-300 whitespace-pre-line italic">
                                {sum.feedback ? `"${sum.feedback}"` : 'No comments provided.'}
                              </p>
                            </div>

                            {/* Show legacy detailed feedback logs only if they actually contain real individual user input */}
                            {!isPlaceholder && (sum.summary || sum.learnings) && (
                              <details className="text-[10px] text-slate-500 mt-2 cursor-pointer select-none">
                                <summary className="hover:text-slate-300 transition-colors font-bold uppercase tracking-wider text-[8.5px] focus:outline-none">Legacy Extended Evaluation Data</summary>
                                <div className="space-y-2 mt-2 pl-2.5 border-l border-slate-805">
                                  {sum.summary && (
                                    <div>
                                      <div className="text-[8.5px] uppercase font-bold text-slate-600">Session Highlights</div>
                                      <p className="text-slate-400 leading-relaxed text-[10.5px]">{sum.summary}</p>
                                    </div>
                                  )}
                                  {sum.learnings && (
                                    <div>
                                      <div className="text-[8.5px] uppercase font-bold text-slate-600">Key Learnings & Takeaways</div>
                                      <p className="text-slate-400 leading-relaxed text-[10.5px]">{sum.learnings}</p>
                                    </div>
                                  )}
                                </div>
                              </details>
                            )}
                          </div>

                        </div>
                      );
                    })
                  ) : (
                    <div className="glass-panel col-span-2 p-8 text-center text-slate-500 text-xs shadow-inner">
                      No Session Feedback Logs Available
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* 5. HUB ANALYTICS TAB */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              
              <div>
                <h2 className="font-display text-2xl font-bold text-white flex items-center">
                  <BarChart3 className="h-5.5 w-5.5 text-cyan-400 mr-2" />
                  Educational Analytics Dashboard
                </h2>
                <p className="text-slate-400 text-xs">A comprehensive operational perspective tracking student attendance curves, tasks and active sessions.</p>
              </div>

              {sessions.length === 0 ? (
                <div className="glass-panel p-12 text-center text-slate-500 rounded-2xl font-semibold">
                  No Data Available
                </div>
              ) : (
                <>
                  {/* BENTO STATISTICS GRID */}
                  <div className="grid sm:grid-cols-3 gap-4">
                    
                    <div className="glass-panel-neon-cyan p-5 rounded-2xl flex flex-col justify-between">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-cyan-400">Attendance Index</span>
                        <TrendingUp className="h-4 w-4 text-cyan-400" />
                      </div>
                      <div className="my-3">
                        <span className="font-display text-4xl font-extrabold text-white">
                          {attendance.length > 0 && studentProfiles.length > 0 
                            ? `${Math.round((attendance.length / (sessions.length * studentProfiles.filter(p => p.accountStatus === 'Approved').length || 1)) * 100)}%` 
                            : '0%'}
                        </span>
                        <span className="text-xs text-slate-400 block mt-1">Average system classroom presence</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">Based on sessions data</div>
                    </div>

                    <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border-slate-800">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-purple-400">Task Completion Rate</span>
                        <CheckCircle className="h-4 w-4 text-purple-400" />
                      </div>
                      <div className="my-3">
                        <span className="font-display text-4xl font-extrabold text-white">
                          {assignments.length > 0 
                            ? `${Math.round((submissions.length / (assignments.length * studentProfiles.filter(p => p.accountStatus === 'Approved').length || 1)) * 100)}%` 
                            : '0%'}
                        </span>
                        <span className="text-xs text-slate-400 block mt-1">Assignment submission compliance</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">Active students on schedule</div>
                    </div>

                    <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border-slate-800">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400">Interactive Feedbacks</span>
                        <Award className="h-4 w-4 text-emerald-400" />
                      </div>
                      <div className="my-3">
                        <span className="font-display text-4xl font-extrabold text-white">
                          {summaries.length > 0 
                            ? `${(summaries.reduce((acc, curr) => acc + (curr.rating || 5), 0) / summaries.length).toFixed(1)} / 5` 
                            : '5.0 / 5'}
                        </span>
                        <span className="text-xs text-slate-400 block mt-1">Instructor response review rating</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">Highly positive learning curves</div>
                    </div>

                  </div>

                  {/* STUDENT APPROVAL COUNTERS */}
                  <div className="grid sm:grid-cols-3 gap-4">
                    
                    <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border-amber-500/20 bg-amber-500/5">
                      <div className="flex justify-between items-center text-amber-400">
                        <span className="text-[10px] uppercase font-bold tracking-widest">Total Pending Students</span>
                        <Clock className="h-4 w-4" />
                      </div>
                      <div className="my-3">
                        <span className="font-display text-4xl font-extrabold text-white">
                          {studentProfiles.filter(p => !p.accountStatus || p.accountStatus === 'Pending').length}
                        </span>
                        <span className="text-xs text-slate-400 block mt-1">Awaiting registration clearance</span>
                      </div>
                    </div>

                    <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border-emerald-500/20 bg-emerald-500/5">
                      <div className="flex justify-between items-center text-emerald-400">
                        <span className="text-[10px] uppercase font-bold tracking-widest">Total Approved Students</span>
                        <CheckCircle className="h-4 w-4" />
                      </div>
                      <div className="my-3">
                        <span className="font-display text-4xl font-extrabold text-white">
                          {studentProfiles.filter(p => p.accountStatus === 'Approved').length}
                        </span>
                        <span className="text-xs text-slate-400 block mt-1">Fully checked in & signed profiles</span>
                      </div>
                    </div>

                    <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border-rose-500/20 bg-rose-500/5">
                      <div className="flex justify-between items-center text-rose-400">
                        <span className="text-[10px] uppercase font-bold tracking-widest">Total Rejected Students</span>
                        <XCircle className="h-4 w-4" />
                      </div>
                      <div className="my-3">
                        <span className="font-display text-4xl font-extrabold text-white">
                          {studentProfiles.filter(p => p.accountStatus === 'Rejected').length}
                        </span>
                        <span className="text-xs text-slate-400 block mt-1">Blocked from accessing terminal</span>
                      </div>
                    </div>

                  </div>

                  {/* VISUAL CHART REPRESENTATION (High quality custom SVGs & CSS bars) */}
                  <div className="grid md:grid-cols-12 gap-6">
                    
                    {/* Custom Attendance Distribution Bar */}
                    <div className="md:col-span-7 glass-panel p-5 rounded-2xl space-y-4">
                      <h4 className="font-semibold text-xs text-slate-200">Session Attendance Ratios</h4>
                      
                      <div className="space-y-3 pt-2">
                        {sessions.slice(0, 4).map(s => {
                          const counts = attendance.filter(a => a.sessionId === s.id).length;
                          const ratio = Math.min((counts / 25) * 100, 100);

                          return (
                            <div key={s.id} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-slate-300 font-semibold truncate max-w-xs">{s.name}</span>
                                <span className="font-mono text-cyan-400">{counts} verified</span>
                              </div>
                              <div className="h-2.5 bg-slate-900 border border-slate-800 rounded-full overflow-hidden">
                                <div 
                                  className="bg-cyan-500 h-full rounded-full shadow-[0_0_8px_rgba(6,182,212,0.4)]"
                                  style={{ width: `${ratio || 10}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Branch / Department Attendance curve */}
                    <div id="department-participation-panel" className="md:col-span-5 glass-panel p-5 rounded-2xl space-y-4">
                      <h4 className="font-semibold text-xs text-slate-200">Department participation %</h4>
                      
                      <div className="space-y-2.5 text-xs pt-1">
                        {getDepartmentStats().length > 0 ? (
                          getDepartmentStats().map(d => (
                            <div key={d.name} id={`dept-${d.name.toLowerCase().replace(/\s+/g, '-')}`} className="flex justify-between items-center text-slate-400">
                              <span className="truncate max-w-[150px]">{d.name}</span>
                              <span className="text-white font-mono font-bold">{d.percentage}%</span>
                            </div>
                          ))
                        ) : (
                          <div id="no-department-data-msg" className="text-slate-500 text-[11px] py-4 text-center italic">
                            No Department Participation Data Available
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                </>
              )}

            </div>
          )}

          {/* 6. STUDENT APPROVALS TAB */}
          {activeTab === 'approvals' && (
            <div className="space-y-4">
              
              <div>
                <h2 className="font-display text-2xl font-bold text-white flex items-center">
                  <Award className="h-5.5 w-5.5 text-cyan-400 mr-2" />
                  Student Approvals
                </h2>
                <p className="text-slate-400 text-xs text-left">Manage pending student registrations. Review credentials, departments, and approve or block college attendance portal terminals.</p>
              </div>

              <div className="glass-panel rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900/40 text-[10px] uppercase font-bold tracking-widest text-slate-500 border-b border-slate-900/80">
                        <th className="p-4">Full Name</th>
                        <th className="p-4">USN</th>
                        <th className="p-4">Department</th>
                        <th className="p-4">Email Address</th>
                        <th className="p-4">Registration Date</th>
                        <th className="p-4 text-center">Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs divide-y divide-slate-950">
                      {studentProfiles.filter(p => !p.accountStatus || p.accountStatus === 'Pending').length > 0 ? (
                        studentProfiles.filter(p => !p.accountStatus || p.accountStatus === 'Pending').map(p => (
                          <tr key={p.id} className="hover:bg-slate-900/30 transition-colors">
                            <td className="p-4 font-semibold text-white">{p.fullName}</td>
                            <td className="p-4 font-mono text-cyan-400 font-bold">{p.usn || 'N/A'}</td>
                            <td className="p-4 text-slate-350 text-left">{p.department || 'N/A'}</td>
                            <td className="p-4 text-slate-400 font-mono text-[11px] text-left">{p.email || 'N/A'}</td>
                            <td className="p-4 text-slate-500 font-mono text-left">
                              {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="p-4 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                                p.accountStatus === 'Approved' 
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                  : p.accountStatus === 'Rejected'
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              }`}>
                                {p.accountStatus?.toUpperCase() || 'PENDING'}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end space-x-1.5">
                                {(p.accountStatus !== 'Approved') && (
                                  <button
                                    onClick={() => handleApproveStudent(p.id)}
                                    className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-bold transition-all shadow-[0_0_8px_rgba(16,185,129,0.2)] cursor-pointer"
                                  >
                                    Approve
                                  </button>
                                )}
                                {(p.accountStatus !== 'Rejected') && (
                                  <button
                                    onClick={() => handleRejectStudent(p.id)}
                                    className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold transition-all cursor-pointer"
                                  >
                                    Reject
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="p-12 text-center text-slate-500">
                            <div className="text-sm font-extrabold text-slate-300 font-sans mb-1">
                              No Pending Student Approvals
                            </div>
                            <div className="text-xs text-slate-400 font-sans">
                              Student registration requests will appear here.
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-6">
              {!selectedStudentReport ? (
                <>
                  <div>
                    <h2 className="font-display text-2xl font-bold text-white flex items-center bg-transparent">
                      <FileCheck className="h-5.5 w-5.5 text-cyan-400 mr-2" />
                      Student Progress & Reports Directory
                    </h2>
                    <p className="text-slate-400 text-xs text-left">
                      Access official progression records, attendance ratios, submitted tasks, and interaction insights for all registered students.
                    </p>
                  </div>

                  {/* Filters Bar */}
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Search students by name, USN, or email..."
                        value={reportsSearch}
                        onChange={(e) => setReportsSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-800 text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-cyan-500 text-slate-100 font-sans"
                      />
                    </div>
                    
                    <select
                      value={reportsDeptFilter}
                      onChange={(e) => setReportsDeptFilter(e.target.value)}
                      className="bg-slate-900 border border-slate-800 px-4 py-2 text-xs rounded-xl text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-sans cursor-pointer"
                    >
                      <option value="">All Departments</option>
                      {dynamicDepartments.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>

                    {(reportsSearch || reportsDeptFilter) && (
                      <button
                        onClick={() => {
                          setReportsSearch('');
                          setReportsDeptFilter('');
                        }}
                        className="px-4 py-2 bg-slate-850 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-slate-450 hover:text-white transition-colors cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  {/* Students Database Table */}
                  <div className="glass-panel rounded-2xl overflow-hidden bg-slate-950 border border-slate-900">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-900/40 text-[10px] uppercase font-bold tracking-widest text-slate-500 border-b border-slate-900/80">
                            <th className="p-4 text-left">Student Name</th>
                            <th className="p-4 text-left">USN</th>
                            <th className="p-4 text-left">Department</th>
                            <th className="p-4 text-left">Email Address</th>
                            <th className="p-4 text-center">Status</th>
                            <th className="p-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="text-xs divide-y divide-slate-950">
                          {studentProfiles.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="p-12 text-center text-slate-500">
                                <div className="text-sm font-extrabold text-slate-300 font-sans mb-1">
                                  No Students Registered
                                </div>
                                <div className="text-xs text-slate-400 font-sans">
                                  Registered student profiles from Supabase will display here.
                                </div>
                              </td>
                            </tr>
                          ) : studentProfiles.filter(p => {
                            const q = reportsSearch.toLowerCase();
                            const matchesSearch = p.fullName.toLowerCase().includes(q) || 
                                                  (p.usn && p.usn.toLowerCase().includes(q)) ||
                                                  (p.email && p.email.toLowerCase().includes(q));
                            const matchesDept = !reportsDeptFilter || (p.department && normalizeDepartmentName(p.department).toUpperCase() === normalizeDepartmentName(reportsDeptFilter).toUpperCase());
                            return matchesSearch && matchesDept;
                          }).length > 0 ? (
                            studentProfiles.filter(p => {
                              const q = reportsSearch.toLowerCase();
                              const matchesSearch = p.fullName.toLowerCase().includes(q) || 
                                                    (p.usn && p.usn.toLowerCase().includes(q)) ||
                                                    (p.email && p.email.toLowerCase().includes(q));
                              const matchesDept = !reportsDeptFilter || (p.department && normalizeDepartmentName(p.department).toUpperCase() === normalizeDepartmentName(reportsDeptFilter).toUpperCase());
                              return matchesSearch && matchesDept;
                            }).map(p => (
                              <tr key={p.id} className="hover:bg-slate-900/30 transition-colors">
                                <td className="p-4 font-semibold text-white text-left">
                                  <div className="flex items-center space-x-2.5 bg-transparent">
                                    <div className="h-8 w-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 font-extrabold font-mono uppercase text-xs">
                                      {p.fullName.charAt(0)}
                                    </div>
                                    <span>{p.fullName}</span>
                                  </div>
                                </td>
                                <td className="p-4 font-mono text-cyan-400 font-bold text-left">{p.usn || 'N/A'}</td>
                                <td className="p-4 text-slate-350 text-left">{p.department || 'N/A'}</td>
                                <td className="p-4 text-slate-400 font-mono text-[11px] text-left">{p.email || 'N/A'}</td>
                                <td className="p-4 text-center">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold border ${
                                    p.accountStatus === 'Approved' 
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                      : p.accountStatus === 'Rejected'
                                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  }`}>
                                    {p.accountStatus?.toUpperCase() || 'PENDING'}
                                  </span>
                                </td>
                                <td className="p-4 text-right">
                                  <button
                                    onClick={() => setSelectedStudentReport(p)}
                                    className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-[11.5px] transition-all shadow-[0_0_10px_rgba(6,182,212,0.15)] cursor-pointer flex items-center space-x-1.5 ml-auto"
                                  >
                                    <FileText className="h-3.5 w-3.5" />
                                    <span>View Report</span>
                                  </button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="p-12 text-center text-slate-500 colspan-6">
                                <div className="text-sm font-extrabold text-slate-300 font-sans mb-1">
                                  No Match Found
                                </div>
                                <div className="text-xs text-slate-400 font-sans">
                                  Adjust your search filters to find registered student profiles.
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <StudentReportView
                  profile={selectedStudentReport}
                  sessions={sessions}
                  attendance={attendance}
                  assignments={assignments}
                  submissions={submissions}
                  summaries={summaries}
                  onBack={() => setSelectedStudentReport(null)}
                  isAdminMode={true}
                />
              )}
            </div>
          )}

        </div>

      </div>

      {/* ============================================================================
          DYNAMIC FLOATING MODALS
          ============================================================================ */}

      {/* 1. SCHEDULE / EDIT SESSION MODAL */}
      {showSessionModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 font-sans text-slate-100">
          <div className="glass-panel max-w-lg w-full p-6 rounded-2xl relative">
            <button 
              onClick={() => setShowSessionModal(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="font-display font-bold text-lg text-white mb-4">
              {editingSession ? `Edit Session "${editingSession.name}"` : 'Schedule Session'}
            </h3>

            <form onSubmit={handleSessionSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Session Title</label>
                <input
                  type="text"
                  required
                  placeholder="Enter Session Title"
                  value={sessionForm.name}
                  onChange={(e) => setSessionForm({...sessionForm, name: e.target.value})}
                  className="glass-input w-full p-2.5 rounded-xl text-xs mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Description</label>
                <textarea
                  placeholder="Enter Session Description"
                  value={sessionForm.description}
                  onChange={(e) => setSessionForm({...sessionForm, description: e.target.value})}
                  className="glass-input w-full p-2.5 rounded-xl text-xs mt-1 h-20"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Date</label>
                  <input
                    type="date"
                    required
                    min={localToday}
                    value={sessionForm.date}
                    onChange={(e) => setSessionForm({...sessionForm, date: e.target.value})}
                    className="glass-input w-full p-2.5 rounded-xl text-xs mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Start Time</label>
                  <input
                    type="time"
                    required
                    min={startMinTime}
                    value={sessionForm.startTime}
                    onChange={(e) => setSessionForm({...sessionForm, startTime: e.target.value})}
                    className="glass-input w-full p-2.5 rounded-xl text-xs mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">End Time</label>
                  <input
                    type="time"
                    required
                    min={startMinTime}
                    value={sessionForm.endTime}
                    onChange={(e) => setSessionForm({...sessionForm, endTime: e.target.value})}
                    className="glass-input w-full p-2.5 rounded-xl text-xs mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Venue Room</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter Venue"
                    value={sessionForm.venue}
                    onChange={(e) => setSessionForm({...sessionForm, venue: e.target.value})}
                    className="glass-input w-full p-2.5 rounded-xl text-xs mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Expert Resource Person</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter Resource Person Name"
                    value={sessionForm.resourcePerson}
                    onChange={(e) => setSessionForm({...sessionForm, resourcePerson: e.target.value})}
                    className="glass-input w-full p-2.5 rounded-xl text-xs mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Hosting body</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter Hosting Department / Club / Organization"
                    value={sessionForm.hostedBy}
                    onChange={(e) => setSessionForm({...sessionForm, hostedBy: e.target.value})}
                    className="glass-input w-full p-2.5 rounded-xl text-xs mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Number of Volunteers</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Enter Number of Volunteers"
                    value={sessionForm.numberOfVolunteers}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value));
                      let arr = [...(sessionForm.volunteers || [])];
                      if (arr.length < val) {
                        while (arr.length < val) arr.push('');
                      } else if (arr.length > val) {
                        arr = arr.slice(0, val);
                      }
                      setSessionForm({
                        ...sessionForm,
                        numberOfVolunteers: val,
                        volunteers: arr
                      });
                    }}
                    className="glass-input w-full p-2.5 rounded-xl text-xs mt-1"
                  />
                </div>
              </div>

              {sessionForm.numberOfVolunteers > 0 && (
                <div className="space-y-2 border-t border-slate-900/60 pt-3">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">Volunteer Names</label>
                    <button
                      type="button"
                      onClick={() => {
                        const updatedVolunteers = [...(sessionForm.volunteers || []), ''];
                        setSessionForm({
                          ...sessionForm,
                          volunteers: updatedVolunteers,
                          numberOfVolunteers: updatedVolunteers.length
                        });
                      }}
                      className="text-[10px] text-cyan-400 hover:underline flex items-center cursor-pointer"
                    >
                      + Add Volunteer Name
                    </button>
                  </div>
                  
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {Array.from({ length: sessionForm.numberOfVolunteers }).map((_, idx) => {
                      const value = sessionForm.volunteers && sessionForm.volunteers[idx] !== undefined ? sessionForm.volunteers[idx] : '';
                      return (
                        <div key={idx} className="flex items-center space-x-2">
                          <span className="text-[10px] text-slate-550 w-18 shrink-0">Volunteer {idx + 1}:</span>
                          <input
                            type="text"
                            required
                            placeholder="Enter Volunteer Name"
                            value={value}
                            onChange={(e) => {
                              const arr = [...(sessionForm.volunteers || [])];
                              while (arr.length <= idx) arr.push('');
                              arr[idx] = e.target.value;
                              setSessionForm({ ...sessionForm, volunteers: arr });
                            }}
                            className="glass-input flex-1 p-2 rounded-xl text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const arr = (sessionForm.volunteers || []).filter((_, i) => i !== idx);
                              setSessionForm({
                                ...sessionForm,
                                volunteers: arr,
                                numberOfVolunteers: Math.max(0, sessionForm.numberOfVolunteers - 1)
                              });
                            }}
                            className="text-rose-450 hover:text-rose-400 text-xs px-1 cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end space-x-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setShowSessionModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                >
                  Confirm & Write
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. MANUAL CHECK-IN ENTRY MODAL */}
      {showManualCheckInModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 font-sans text-slate-100">
          <div className="glass-panel max-w-md w-full p-6 rounded-2xl relative">
            <button 
              onClick={() => setShowManualCheckInModal(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="font-display font-bold text-lg text-white mb-4">Manual Attendance Entry</h3>

            <form onSubmit={handleManualCheckInSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Active Session Target</label>
                <select
                  required
                  value={manualCheckIn.sessionId || selectedSessionId}
                  onChange={(e) => setManualCheckIn({...manualCheckIn, sessionId: e.target.value})}
                  className="glass-input w-full p-2.5 rounded-xl text-xs mt-1"
                >
                  <option value="">-- Select session target --</option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Student Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="Enter Student Full Name"
                  value={manualCheckIn.fullName}
                  onChange={(e) => setManualCheckIn({...manualCheckIn, fullName: e.target.value})}
                  className="glass-input w-full p-2.5 rounded-xl text-xs mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Student USN ID</label>
                <input
                  type="text"
                  required
                  placeholder="Enter Student USN ID"
                  value={manualCheckIn.usn}
                  onChange={(e) => setManualCheckIn({...manualCheckIn, usn: e.target.value})}
                  className="glass-input w-full p-2.5 rounded-xl text-xs mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Student Department</label>
                <select
                  required
                  value={manualCheckIn.department}
                  onChange={(e) => setManualCheckIn({...manualCheckIn, department: e.target.value})}
                  className="glass-input w-full p-2.5 rounded-xl text-xs mt-1"
                >
                  <option value="">-- Choose Department --</option>
                  {dynamicDepartments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end space-x-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setShowManualCheckInModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                >
                  Register Check-In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. ASSIGNMENT MODAL BUILDER */}
      {showAssignmentModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 font-sans text-slate-100">
          <div className="glass-panel max-w-lg w-full p-6 rounded-2xl relative">
            <button 
              onClick={() => setShowAssignmentModal(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="font-display font-bold text-lg text-white mb-4">
              {editingAssignment ? 'Rewrite Assignment Instructions' : 'Release Assignment Work'}
            </h3>

            <form onSubmit={handleAssignmentSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Assignment Title</label>
                <input
                  type="text"
                  required
                  placeholder="Enter Assignment Title"
                  value={assignmentForm.title}
                  onChange={(e) => setAssignmentForm({...assignmentForm, title: e.target.value})}
                  className="glass-input w-full p-2.5 rounded-xl text-xs mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Task Description</label>
                <textarea
                  required
                  placeholder="Enter Task Description"
                  value={assignmentForm.description}
                  onChange={(e) => setAssignmentForm({...assignmentForm, description: e.target.value})}
                  className="glass-input w-full p-2.5 rounded-xl text-xs mt-1 h-20"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Link to Session (Optional)</label>
                <select
                  value={assignmentForm.sessionId}
                  onChange={(e) => setAssignmentForm({...assignmentForm, sessionId: e.target.value})}
                  className="glass-input w-full p-2.5 rounded-xl text-xs mt-1 cursor-pointer bg-slate-900 border border-slate-800"
                >
                  <option value="">No Session Linkage</option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.date} &bull; {s.name} ({s.venue})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Reference Links (Comma separated)</label>
                  <input
                    type="text"
                    placeholder="Enter Reference Web URLs"
                    value={assignmentForm.attachedLinks}
                    onChange={(e) => setAssignmentForm({...assignmentForm, attachedLinks: e.target.value})}
                    className="glass-input w-full p-2.5 rounded-xl text-xs mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Academic Deadline</label>
                  <input
                    type="datetime-local"
                    required
                    min={localIsoNow}
                    value={assignmentForm.deadline}
                    onChange={(e) => setAssignmentForm({...assignmentForm, deadline: e.target.value})}
                    className="glass-input w-full p-2.5 rounded-xl text-xs mt-1"
                  />
                </div>
              </div>

              {/* Supported real asset uploader bundle */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Upload Reference resource files</label>
                <div className="relative">
                  <input
                    type="file"
                    multiple
                    disabled={uploading}
                    onChange={handleResourceFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                  />
                  <div className="glass-panel p-3 rounded-xl border border-dashed border-cyan-500/30 flex flex-col items-center justify-center text-xs text-slate-400 hover:text-white hover:border-cyan-400/60 transition-all">
                    <div className="flex items-center">
                      {uploading ? (
                        <RefreshCw className="h-4 w-4 animate-spin mr-1.5" />
                      ) : (
                        <Plus className="h-4 w-4 text-cyan-400 mr-1.5" />
                      )}
                      <span>{uploading ? 'Analyzing and writing bytes securely...' : 'Choose or drop reference files (PDF, ZIP, DOCX)'}</span>
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

                {/* Sub-lists of files */}
                {assignmentForm.attachedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {assignmentForm.attachedFiles.map((file, idx) => (
                      <div key={idx} className="bg-slate-900 border border-slate-800 text-[10px] py-1 px-2.5 rounded-lg text-slate-350 flex items-center space-x-1">
                        <span>{file.name} ({file.size || 'Sandbox Mode'})</span>
                        <button 
                          type="button" 
                          onClick={() => {
                            setAssignmentForm({
                              ...assignmentForm,
                              attachedFiles: assignmentForm.attachedFiles.filter((_, i) => i !== idx)
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

              <div className="pt-2 flex justify-end space-x-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setShowAssignmentModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                >
                  Conclude & Write
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. ACTIVE PRESENTATION CODE DISPLAY ROTATING QR SCREEN */}
      {/* 5. ADMIN SCANNER FOR SECURE UNIQUE STUDENT QR CODES */}
      {showAdminScanner && scanningSessionId && (
        <QRScannerModal
          title="Scan Student QR Code"
          subtitle="Align the student's unique attendance QR code inside the viewfinder window to verify their presence"
          onScanSuccess={handleAdminVerifyQR}
          onClose={() => {
            setShowAdminScanner(false);
            setScanningSessionId(null);
          }}
        />
      )}

      {/* GLOBAL UNIFIED DELETE CONFIRMATION MODAL */}
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

      {/* CLEAR NOTIFICATIONS CONFIRMATION DIALOG (ADMIN) */}
      {showAdminClearConfirm && (
        <div id="clear-notifications-confirm-modal-admin" className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 font-sans text-slate-100 animate-fade-in">
          <div className="glass-panel max-w-sm w-full p-6 md:p-8 rounded-2xl relative flex flex-col items-center bg-slate-950 border border-slate-900 text-center space-y-4">
            
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.15)] animate-pulse">
              <Bell className="h-6 w-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="font-display font-black text-white text-md">Clear All Notifications?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Are you sure you want to clear all admin alerts and broadcasts?
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3.5 w-full pt-1">
              <button
                type="button"
                onClick={() => setShowAdminClearConfirm(false)}
                className="py-2.5 rounded-xl border border-slate-800 hover:bg-slate-900 text-xs font-semibold text-slate-300 transition-all cursor-pointer font-sans"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAdminClearAll}
                className="py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)] cursor-pointer font-sans"
              >
                Clear All
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
