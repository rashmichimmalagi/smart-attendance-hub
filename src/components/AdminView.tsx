/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  AlertCircle,
  FileCheck,
  Star,
  ShieldCheck,
  Copy,
  Lock,
  Unlock,
  Mail,
  Eye,
  Info,
  Shield,
  KeyRound,
  UserCheck,
  UploadCloud,
  AlertTriangle,
  Megaphone,
  Archive,
  RotateCcw
} from 'lucide-react';
import StudentReportView from './StudentReportView';
import { getFriendlyTimestamp, getNotificationCategoryInfo } from './StudentView';
import { 
  sessionService, 
  attendanceService, 
  assignmentService, 
  summaryService, 
  notificationService, 
  storageService,
  authService,
  generateThreeAuthCodeOptions,
  attendanceTokenService,
  getSessionCalculatedState,
  isSupabaseConfigured,
  supabase,
  subscribeToDatabaseChanges,
  debounce,
  isAdminSpecificNotificationDeleted,
  absenceRequestService
} from '../supabase';
import { 
  Session, 
  AttendanceRecord, 
  Assignment, 
  AssignmentSubmission, 
  SessionSummary, 
  Profile, 
  AppNotification,
  AbsenceRequest
} from '../types';
import { exportToCSV, exportToExcel, exportSingleTableToExcel, printFormattedReport, formatReportDate, formatReportDateTime } from '../utils/export';
import { QRScannerModal } from './QRManager';
import { getAssignmentStatus } from '../utils/assignmentUtils';
import { DEPARTMENT_OPTIONS, normalizeDepartmentName } from '../utils/departmentUtils';
import { getFeedbackWindowStatus } from '../utils/feedbackUtils';
import Footer from './Footer';

const getCleanDescription = (desc?: string): string => {
  if (!desc) return '';
  return desc
    .replace(/\[feedback:(optional|mandatory)\]/g, '')
    .replace(/\[feedback_closing:[^\]]+\]/g, '')
    .replace(/\[feedback_deadline:[^\]]+\]/g, '')
    .trim();
};

const getFeedbackRequirement = (desc?: string): 'mandatory' | 'optional' => {
  if (!desc) return 'mandatory';
  return desc.includes('[feedback:optional]') ? 'optional' : 'mandatory';
};

const getFeedbackClosingTime = (desc?: string): string => {
  if (!desc) return '';
  const match = desc.match(/\[feedback_deadline:\s*([^\]]+)\]/) || desc.match(/\[feedback_closing:[^\]]*time=([^;\]]+)/);
  return match ? match[1].trim() : '';
};

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

const formatAuditDateTime = (dateStr: string) => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = String(hours).padStart(2, '0');
  
  return `${day}-${month}-${year} ${hoursStr}:${minutes} ${ampm}`;
};

const formatAssignmentAuditDateTime = (dateStr?: string) => {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  
  return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
};

const AdminSkeletonLoader = () => (
  <div className="space-y-4 animate-pulse">
    {[1, 2, 3].map((n) => (
      <div key={n} className="glass-panel p-6 rounded-2xl border border-slate-900 bg-slate-950/20 space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-4 bg-slate-800 rounded w-1/3" />
          <div className="h-4 bg-slate-800 rounded w-1/12" />
        </div>
        <div className="h-4 bg-slate-800 rounded w-1/2" />
        <div className="h-3 bg-slate-800 rounded w-2/3" />
        <div className="border-t border-slate-900 pt-3 flex justify-between">
          <div className="h-3 bg-slate-800 rounded w-1/4" />
          <div className="h-3 bg-slate-800 rounded w-1/4" />
        </div>
      </div>
    ))}
  </div>
);

interface AdminViewProps {
  adminProfile: Profile;
  onLogout: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export default function AdminView({ adminProfile, onLogout, showToast, theme, toggleTheme }: AdminViewProps) {
  // State lists
  const [adminMetricsLoading, setAdminMetricsLoading] = useState<boolean>(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [summaries, setSummaries] = useState<SessionSummary[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showAdminClearConfirm, setShowAdminClearConfirm] = useState(false);
  const [assignmentDeleteState, setAssignmentDeleteState] = useState<{
    isOpen: boolean;
    assignmentId: string;
    assignmentTitle: string;
    hasSubmissions: boolean;
    submissionsCount: number;
    showDeleteVerification: boolean;
    verificationText: string;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    title?: string;
    message?: string;
    isDeleting?: boolean;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [studentProfiles, setStudentProfiles] = useState<Profile[]>([]);
  const [adminProfiles, setAdminProfiles] = useState<Profile[]>([]);
  const [selectedStudentReport, setSelectedStudentReport] = useState<Profile | null>(null);
  const [reportsSearch, setReportsSearch] = useState('');
  const [reportsDeptFilter, setReportsDeptFilter] = useState('');
  const [attendanceDeptFilter, setAttendanceDeptFilter] = useState('');

  // Security & Profile tab states
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [localAdminProfile, setLocalAdminProfile] = useState<Profile>(adminProfile);

  const handleSignOut = async () => {
    console.log('Sign Out clicked');
    if (isSigningOut) {
      console.log('[Auth Debug] AdminView logout already in progress');
      return;
    }
    setIsSigningOut(true);
    try {
      await onLogout();
    } catch (err) {
      console.error('[Auth Debug] Logout error in AdminView:', err);
    } finally {
      setIsSigningOut(false);
    }
  };
  const [profileCodeVisible, setProfileCodeVisible] = useState(false);
  const [profileCodeCopied, setProfileCodeCopied] = useState(false);
  const [refreshCodeLoading, setRefreshCodeLoading] = useState(false);

  const getRecordMarkedBy = (record: AttendanceRecord, sess?: Session) => {
    // 1. Check if record has a human-readable scanningAdminName
    if (record.scanningAdminName && record.scanningAdminName.trim()) {
      return record.scanningAdminName;
    }
    
    // 2. Check if record has scanningAdminId and we can find their name in adminProfiles
    if (record.scanningAdminId) {
      const ap = adminProfiles.find(p => p.id === record.scanningAdminId);
      if (ap && ap.fullName) {
        return ap.fullName;
      }
    }

    // 3. Check if record.markedBy has a valid, human-readable name
    if (record.markedBy && 
        record.markedBy.trim() && 
        record.markedBy !== 'Self Check-In (QR)' && 
        !record.markedBy.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return record.markedBy;
    }

    // 4. Default fallback: use session owner/host to handle pre-existing or legacy data beautifully
    if (sess) {
      const ap = adminProfiles.find(p => p.id === sess.sessionOwnerId);
      if (ap && ap.fullName) return ap.fullName;
      return sess.hostedBy || 'System Creator';
    }

    return 'System Creator';
  };

  useEffect(() => {
    setLocalAdminProfile(adminProfile);
  }, [adminProfile]);

  const promptRegenerateCode = () => {
    const options = generateThreeAuthCodeOptions(localAdminProfile.fullName, localAdminProfile.adminId);
    setRegenOptions(options);
    setSelectedRegenOption(options[0]);
    setShowRegenModal(true);
  };

  const handleRegenerateCode = async (specificCode: string) => {
    setRefreshCodeLoading(true);
    try {
      const newCode = await authService.regenerateAuthenticationCode(
        localAdminProfile.id,
        localAdminProfile.fullName,
        localAdminProfile.department || 'GEN',
        specificCode
      );
      if (!newCode) {
        showToast('Error occurred during code regeneration.', 'error');
      } else {
        // Also reflect on initial object reference if possible
        adminProfile.authenticationCode = newCode;
        setLocalAdminProfile(prev => ({ ...prev, authenticationCode: newCode }));
        showToast('Your security Authentication Code has been regenerated successfully!', 'success');
        setProfileCodeVisible(true);
        setShowRegenModal(false);
      }
    } catch (err: any) {
      showToast(err.message || 'Error occurred during code regeneration.', 'error');
    } finally {
      setRefreshCodeLoading(false);
    }
  };

  // Code regeneration selection states
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [regenOptions, setRegenOptions] = useState<string[]>([]);
  const [selectedRegenOption, setSelectedRegenOption] = useState<string>('');

  // Use strictly the same department dropdown source to prevent future list divergence
  const dynamicDepartments = DEPARTMENT_OPTIONS;

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'sessions' | 'attendance' | 'assignments' | 'summaries' | 'analytics' | 'approvals' | 'reports' | 'profile' | 'absences'>('sessions');
  const [approvalStatusFilter, setApprovalStatusFilter] = useState<'All' | 'Pending' | 'Approved' | 'Suspended' | 'Rejected'>('All');

  // Absence regularization administrative state hooks
  const [absenceRequests, setAbsenceRequests] = useState<AbsenceRequest[]>([]);
  const [absenceStatusFilter, setAbsenceStatusFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('All');
  const [absenceSearchQuery, setAbsenceSearchQuery] = useState('');
  const [adminRemarksMap, setAdminRemarksMap] = useState<Record<string, string>>({});
  const [savingRequests, setSavingRequests] = useState<Record<string, boolean>>({});

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

  const filteredAbsences = useMemo(() => {
    return absenceRequests.filter(req => {
      if (absenceStatusFilter !== 'All' && req.status !== absenceStatusFilter) {
        return false;
      }
      if (absenceSearchQuery.trim()) {
        const query = absenceSearchQuery.toLowerCase();
        const matchesName = (req.studentName || '').toLowerCase().includes(query);
        const matchesUsn = (req.studentUsn || '').toLowerCase().includes(query);
        const matchesSession = (req.sessionName || '').toLowerCase().includes(query);
        if (!matchesName && !matchesUsn && !matchesSession) {
          return false;
        }
      }
      return true;
    });
  }, [absenceRequests, absenceStatusFilter, absenceSearchQuery]);

  const getAdminPermissionLevel = (sess: Session) => {
    const isOwner = !sess.sessionOwnerId || sess.sessionOwnerId === adminProfile.id;
    const isAuthorized = sess.authorizedAdminIds?.includes(adminProfile.id);
    return {
      isOwner,
      isAuthorized,
      isAdmin: true,
      canManageAttendance: true,
      canModify: true
    };
  };

  // Filter selections
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');

  // Modals & form fields state
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const isTimelineLocked = !!editingSession && (editingSession.status === 'live' || editingSession.status === 'expired');
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [approvedDuplicateName, setApprovedDuplicateName] = useState('');
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  // Attendance search & dynamic method filters
  const [attendanceSearchQuery, setAttendanceSearchQuery] = useState('');
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<'all' | 'qr' | 'manual'>('all');

  // Analytics timeline filter range selector
  const [analyticsRange, setAnalyticsRange] = useState<'daily' | 'weekly' | 'monthly' | 'all'>('all');

  const [sessionForm, setSessionForm] = useState(() => {
    const saved = localStorage.getItem('unsaved_session_form');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      name: '',
      description: '',
      date: '',
      startTime: '',
      endTime: '',
      venue: '',
      hostedBy: '',
      resourcePerson: '',
      numberOfVolunteers: 0,
      volunteers: [] as string[],
      authorizedAdminIds: [] as string[],
      feedbackRequirement: 'mandatory' as 'mandatory' | 'optional',
      feedbackClosingTime: ''
    };
  });

  useEffect(() => {
    if (sessionForm.name || sessionForm.description || sessionForm.venue) {
      localStorage.setItem('unsaved_session_form', JSON.stringify(sessionForm));
    } else {
      localStorage.removeItem('unsaved_session_form');
    }
  }, [sessionForm]);

  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [assignmentForm, setAssignmentForm] = useState(() => {
    const saved = localStorage.getItem('unsaved_assignment_form');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      title: '',
      description: '',
      resources: '',
      deadline: '',
      sessionId: '',
      attachedLinks: '',
      attachedFiles: [] as Array<{name: string, url: string, size?: string}>
    };
  });

  useEffect(() => {
    if (assignmentForm.title || assignmentForm.description) {
      localStorage.setItem('unsaved_assignment_form', JSON.stringify(assignmentForm));
    } else {
      localStorage.removeItem('unsaved_assignment_form');
    }
  }, [assignmentForm]);

  // State for Assignment Deadline Extension
  const [isExtendingAssignment, setIsExtendingAssignment] = useState(false);
  const [extensionDurationType, setExtensionDurationType] = useState<'1h' | '6h' | '12h' | '1d' | '2d' | 'custom'>('1h');
  const [customExtensionDateTime, setCustomExtensionDateTime] = useState('');

  // State for Session Feedback Extension
  const [showExtendFeedbackModal, setShowExtendFeedbackModal] = useState(false);
  const [extendFeedbackSession, setExtendFeedbackSession] = useState<Session | null>(null);
  const [extendFeedbackOption, setExtendFeedbackOption] = useState<'plus_15' | 'plus_30' | 'plus_60' | 'custom'>('plus_15');
  const [extendFeedbackCustomTime, setExtendFeedbackCustomTime] = useState<string>('');
  const [isSavingFeedbackExtension, setIsSavingFeedbackExtension] = useState(false);

  const handleOpenExtendFeedbackModal = (session: Session) => {
    setExtendFeedbackSession(session);
    setExtendFeedbackOption('plus_15');

    const windowStatus = getFeedbackWindowStatus(session);
    const now = new Date();
    const currentDeadline = windowStatus.deadline;
    const baseTime = (windowStatus.isExpired || now > currentDeadline) ? now : currentDeadline;

    const defaultCustom = new Date(baseTime.getTime() + 60 * 60 * 1000);
    const localISO = new Date(defaultCustom.getTime() - defaultCustom.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setExtendFeedbackCustomTime(localISO);

    setShowExtendFeedbackModal(true);
  };

  const handleSaveFeedbackExtension = async () => {
    if (!extendFeedbackSession) return;
    setIsSavingFeedbackExtension(true);
    try {
      const windowStatus = getFeedbackWindowStatus(extendFeedbackSession);
      const now = new Date();
      const currentDeadline = windowStatus.deadline;
      const baseTime = (windowStatus.isExpired || now > currentDeadline) ? now : currentDeadline;

      let targetDeadline: Date;
      if (extendFeedbackOption === 'plus_15') {
        targetDeadline = new Date(baseTime.getTime() + 15 * 60 * 1000);
      } else if (extendFeedbackOption === 'plus_30') {
        targetDeadline = new Date(baseTime.getTime() + 30 * 60 * 1000);
      } else if (extendFeedbackOption === 'plus_60') {
        targetDeadline = new Date(baseTime.getTime() + 60 * 60 * 1000);
      } else {
        targetDeadline = new Date(extendFeedbackCustomTime);
      }

      if (isNaN(targetDeadline.getTime())) {
        showToast('Please select a valid custom date and time', 'error');
        setIsSavingFeedbackExtension(false);
        return;
      }

      const cleanDesc = getCleanDescription(extendFeedbackSession.description);
      const reqTag = getFeedbackRequirement(extendFeedbackSession.description) === 'optional'
        ? '[feedback:optional]'
        : '[feedback:mandatory]';
      const closeTag = `[feedback_deadline: ${targetDeadline.toISOString()}]`;

      const updatedDescription = `${cleanDesc}\n${reqTag}\n${closeTag}`.trim();

      console.log('Selected Session ID:', extendFeedbackSession.id);
      console.log('Previous Deadline:', currentDeadline.toISOString());
      console.log('New Deadline:', targetDeadline.toISOString());

      const success = await sessionService.updateSession(extendFeedbackSession.id, {
        description: updatedDescription,
        feedbackDeadline: targetDeadline.toISOString()
      });

      console.log('SQL/Supabase Update Response:', success);

      if (success) {
        const formattedDeadline = targetDeadline.toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric'
        }) + ' at ' + targetDeadline.toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit', hour12: true
        });

        // Refresh ONLY the affected session in local UI state for instant responsiveness
        setSessions(prev => prev.map(s => s.id === extendFeedbackSession.id ? {
          ...s,
          description: updatedDescription,
          feedbackDeadline: targetDeadline.toISOString()
        } : s));

        // Show success toast immediately and close modal
        showToast(`Feedback deadline successfully ${windowStatus.isExpired ? 'reopened' : 'extended'}!`, 'success');
        setShowExtendFeedbackModal(false);
        setExtendFeedbackSession(null);

        // Send notification asynchronously in background (non-blocking)
        notificationService.addNotification(
          '📝 Feedback Deadline Extended',
          `The feedback submission deadline for ${extendFeedbackSession.name} has been extended.\nNew Deadline: ${formattedDeadline} [session_id:${extendFeedbackSession.id}]`,
          'student'
        ).catch(err => console.warn('Background notification send error:', err));

        // Background notification list refresh
        notificationService.getNotifications('admin', adminProfile)
          .then(list => setNotifications(list || []))
          .catch(err => console.warn('Background notification list refresh error:', err));
      } else {
        console.error('Any Database Error:', 'updateSession returned false without throwing an exception');
        showToast('Failed to update feedback deadline.', 'error');
      }
    } catch (err: any) {
      console.error('Any Database Error:', err);
      console.error('Complete Error Object:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
      const errorMessage = err?.message || (typeof err === 'string' ? err : 'An unknown database error occurred');
      showToast(`Error extending feedback time: ${errorMessage}`, 'error');
    } finally {
      setIsSavingFeedbackExtension(false);
    }
  };

  // Manual check-in details
  const [showManualCheckInModal, setShowManualCheckInModal] = useState(false);
  const [manualCheckIn, setManualCheckIn] = useState({
    fullName: '',
    usn: '',
    department: '',
    sessionId: '',
    email: '',
    isValidStudent: null as boolean | null,
    searchError: null as string | null,
    isSearching: false
  });

  const resetManualAttendanceForm = () => {
    setManualCheckIn({
      fullName: '',
      usn: '',
      department: '',
      sessionId: '',
      email: '',
      isValidStudent: null,
      searchError: null,
      isSearching: false
    });
  };

  // Ensure form resets on lifecycle (closed/unmounted)
  useEffect(() => {
    resetManualAttendanceForm();
    return () => {
      resetManualAttendanceForm();
    };
  }, []);

  // Ensure form resets when showing or hiding the modal
  useEffect(() => {
    resetManualAttendanceForm();
  }, [showManualCheckInModal]);

  useEffect(() => {
    if (!showSessionModal) {
      setShowDuplicateWarning(false);
      setApprovedDuplicateName('');
      setIsCreatingSession(false);
    }
  }, [showSessionModal]);

  const lookupStudentByUSN = async (usn: string) => {
    const cleanUsn = usn.trim().toUpperCase();
    if (!cleanUsn) {
      setManualCheckIn(prev => ({
        ...prev,
        fullName: '',
        department: '',
        email: '',
        isValidStudent: null,
        searchError: null
      }));
      return;
    }

    setManualCheckIn(prev => ({ ...prev, isSearching: true, searchError: null }));

    try {
      if (supabase) {
        const { data: profileRecord, error } = await supabase
          .from('profiles')
          .select('id, full_name, email, department, usn, account_status, user_roles!inner(role)')
          .ilike('usn', cleanUsn)
          .eq('user_roles.role', 'student')
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!profileRecord) {
          setManualCheckIn(prev => ({
            ...prev,
            fullName: '',
            department: '',
            email: '',
            isValidStudent: false,
            searchError: 'Student not found',
            isSearching: false
          }));
          return;
        }

        const status = profileRecord.account_status || 'Pending';
        if (status !== 'Approved') {
          setManualCheckIn(prev => ({
            ...prev,
            fullName: '',
            department: '',
            email: '',
            isValidStudent: false,
            searchError: `Student account is ${status}. Only Approved students can be checked in.`,
            isSearching: false
          }));
          return;
        }

        setManualCheckIn(prev => ({
          ...prev,
          fullName: profileRecord.full_name || '',
          department: profileRecord.department || '',
          email: profileRecord.email || '',
          isValidStudent: true,
          searchError: null,
          isSearching: false
        }));

      } else {
        const profiles = studentProfiles;
        const match = profiles.find(p => p.usn?.trim().toUpperCase() === cleanUsn);
        if (!match) {
          setManualCheckIn(prev => ({
            ...prev,
            fullName: '',
            department: '',
            email: '',
            isValidStudent: false,
            searchError: 'Student not found',
            isSearching: false
          }));
          return;
        }

        const status = match.accountStatus || 'Pending';
        if (status !== 'Approved') {
          setManualCheckIn(prev => ({
            ...prev,
            fullName: '',
            department: '',
            email: '',
            isValidStudent: false,
            searchError: `Student account is ${status}. Only Approved students can be checked in.`,
            isSearching: false
          }));
          return;
        }

        setManualCheckIn(prev => ({
          ...prev,
          fullName: match.fullName || '',
          department: match.department || '',
          email: match.email || '',
          isValidStudent: true,
          searchError: null,
          isSearching: false
        }));
      }
    } catch (err: any) {
      console.error("Student USN lookup database error for debugging:", err);
      setManualCheckIn(prev => ({
        ...prev,
        fullName: '',
        department: '',
        email: '',
        isValidStudent: false,
        searchError: 'Unable to load student information',
        isSearching: false
      }));
    }
  };

  useEffect(() => {
    if (!manualCheckIn.usn) return;
    const delayDebounceFn = setTimeout(() => {
      lookupStudentByUSN(manualCheckIn.usn);
    }, 450);

    return () => clearTimeout(delayDebounceFn);
  }, [manualCheckIn.usn]);

  // QR presentation modal
  const [activeQRSession, setActiveQRSession] = useState<Session | null>(null);
  const [showAdminScanner, setShowAdminScanner] = useState(false);
  const [scanningSessionId, setScanningSessionId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const loadAdminMetricsCountRef = useRef(0);
  const isInitialSessionLoadRef = useRef(true);
  const isInitialAssignmentLoadRef = useRef(true);

  const loadAdminMetricsRef = useRef<() => any>(() => {});

  const loadAdminMetricsDebounced = useRef(
    debounce(() => {
      loadAdminMetricsRef.current();
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
    window.addEventListener('storage_sync_update', handleActivity);

    // Setup real-time Supabase subscriptions using specific listener helper
    // wrapped in debounced updates to prevent socket and database flooding!
    const cleanup = subscribeToDatabaseChanges(() => {
      console.log("[Supabase Realtime Event RECEIVED at Admin] Reloading admin metrics debounced...");
      loadAdminMetricsDebounced();
    });

    const interval = setInterval(() => {
      setTick(t => t + 1);
      loadAdminMetricsDebounced();
    }, 15000);

    return () => {
      window.removeEventListener('focus', handleActivity);
      window.removeEventListener('visibilitychange', handleActivity);
      window.removeEventListener('storage_sync_update', handleActivity);
      clearInterval(interval);
      cleanup();
    };
  }, [loadAdminMetricsDebounced]);

  // File uploading states
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).inactivityTimeoutPaused = uploading;
    }
    return () => {
      if (typeof window !== 'undefined') {
        (window as any).inactivityTimeoutPaused = false;
      }
    };
  }, [uploading]);

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
      // 1. Optimistic UI update
      setNotifications(prev => prev.map(n => ({ ...n, readBy: [...(n.readBy || []), adminProfile.id] })));
      
      // 2. Persist to local fallback storage
      const readKey = `admin_read_notifs_${adminProfile.id}`;
      const localReadIds: string[] = JSON.parse(localStorage.getItem(readKey) || '[]');
      notifications.forEach(n => {
        if (!localReadIds.includes(n.id)) {
          localReadIds.push(n.id);
        }
      });
      localStorage.setItem(readKey, JSON.stringify(localReadIds));

      // 3. Update database
      await notificationService.markAllAsRead(adminProfile.id, 'admin');
      showToast('All notifications marked as read', 'success');
      await loadAdminMetrics();
    } catch (err) {
      showToast('Failed to mark notifications as read', 'error');
    }
  };

  const handleAdminClearAll = async () => {
    try {
      const currentNotifIds = notifications.map(n => n.id);
      setNotifications([]);
      await notificationService.clearAllNotificationsForAdmin(adminProfile.id, currentNotifIds);
      showToast('Notifications pipeline cleared successfully.', 'success');
      setShowAdminClearConfirm(false);
      await loadAdminMetrics();
    } catch (err) {
      showToast('Failed to clear notifications roster.', 'error');
    }
  };

  const handleAdminDeleteIndividual = (id: string) => {
    setDeleteConfirm({
      isOpen: true,
      message: "Are you sure? This action cannot be undone.",
      onConfirm: async () => {
        try {
          setNotifications(prev => prev.filter(n => n.id !== id));
          const success = await notificationService.deleteNotificationForAdmin(id, adminProfile.id);
          if (success) {
            showToast('Notification deleted successfully', 'success');
            await loadAdminMetrics();
          } else {
            showToast('Unable to delete notification.', 'error');
          }
        } catch (err: any) {
          showToast(`Unable to delete notification.`, 'error');
        }
      }
    });
  };

  const handleAdminMarkIndividualAsRead = async (id: string) => {
    try {
      // 1. Optimistic UI update
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, readBy: [...(n.readBy || []), adminProfile.id] } : n));
      
      // 2. Persist to local fallback storage
      const readKey = `admin_read_notifs_${adminProfile.id}`;
      const localReadIds: string[] = JSON.parse(localStorage.getItem(readKey) || '[]');
      if (!localReadIds.includes(id)) {
        localReadIds.push(id);
        localStorage.setItem(readKey, JSON.stringify(localReadIds));
      }

      // 3. Update database
      await notificationService.markAsRead(id, adminProfile.id);
      showToast('Notification marked as read.', 'success');
      await loadAdminMetrics();
    } catch (err) {
      showToast('Failed to change read status.', 'error');
    }
  };

  // Fetch all core admin metrics helper
  const loadAdminMetrics = async () => {
    loadAdminMetricsCountRef.current++;
    console.log(`[Admin Metrics Audit] loadAdminMetrics called (Count: ${loadAdminMetricsCountRef.current})`);
    let activeSessionsList: Session[] = [];
    let activeAssignmentsList: Assignment[] = [];
    // Isolate each API query so failures in individual modules do not block student profiles/approvals refreshing
    try {
      const sessList = await sessionService.getSessions();
      activeSessionsList = sessList || [];
      setSessions(sessList || []);
      if (sessList && sessList.length > 0 && isInitialSessionLoadRef.current) {
        setSelectedSessionId(sessList[0].id);
        isInitialSessionLoadRef.current = false;
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
      activeAssignmentsList = assignList || [];
      setAssignments(assignList || []);
      if (assignList && assignList.length > 0 && isInitialAssignmentLoadRef.current) {
        setSelectedAssignmentId(assignList[0].id);
        isInitialAssignmentLoadRef.current = false;
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
      const notifList = await notificationService.getNotifications('admin', adminProfile);
      const adminRole = 'admin';
      const deletedKey = `admin_deleted_notifs_${adminProfile.id}`;
      const deletedIds: string[] = JSON.parse(localStorage.getItem(deletedKey) || '[]');
      const readKey = `admin_read_notifs_${adminProfile.id}`;
      const localReadIds: string[] = JSON.parse(localStorage.getItem(readKey) || '[]');

      const filteredNotifs = (notifList || [])
        .filter(n => n.roleTarget === 'admin' || n.roleTarget === 'all')
        .filter(n => !deletedIds.includes(n.id) && !isAdminSpecificNotificationDeleted(adminProfile.id, n.title, n.message))
        .map(n => {
          const isLocallyRead = localReadIds.includes(n.id);
          const readByArray = n.readBy || [];
          const updatedReadBy = isLocallyRead && !readByArray.includes(adminProfile.id)
            ? [...readByArray, adminProfile.id]
            : readByArray;
          return {
            ...n,
            readBy: updatedReadBy
          };
        });

      setNotifications(filteredNotifs);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }

    try {
      const profs = await authService.getStudentProfiles();
      setStudentProfiles(profs || []);
    } catch (errProfs) {
      console.error('Failed to load student profiles:', errProfs);
    }

    try {
      const admins = await authService.getAdminProfiles();
      let finalAdmins = [...(admins || [])];

      // Gather all required admin/owner profile IDs from fetched sessions to ensure visibility
      const allAuthIds = new Set<string>();
      const currentSessions = activeSessionsList.length > 0 ? activeSessionsList : sessions;
      currentSessions.forEach(s => {
        if (s.authorizedAdminIds && Array.isArray(s.authorizedAdminIds)) {
          s.authorizedAdminIds.forEach(id => {
            if (id) allAuthIds.add(id);
          });
        }
        if (s.sessionOwnerId) {
          allAuthIds.add(s.sessionOwnerId);
        }
      });

      const currentAssignments = activeAssignmentsList.length > 0 ? activeAssignmentsList : assignments;
      currentAssignments.forEach(a => {
        if (a.lastModifiedBy) {
          allAuthIds.add(a.lastModifiedBy);
        }
        if (a.createdBy) {
          allAuthIds.add(a.createdBy);
        }
      });

      const fetchedIds = new Set(finalAdmins.map(a => a.id));
      const missingIds = Array.from(allAuthIds).filter(id => id && !fetchedIds.has(id));

      if (missingIds.length > 0) {
        console.log('[Authorized Admin Check] Fetching missing admin/owner profiles for session visibility:', missingIds);
        try {
          const extraAdmins = await authService.getProfilesByIds(missingIds);
          if (extraAdmins && extraAdmins.length > 0) {
            finalAdmins = [...finalAdmins, ...extraAdmins];
          }
        } catch (errExtra) {
          console.error('Failed to load missing admin profiles:', errExtra);
        }
      }

      setAdminProfiles(finalAdmins);
    } catch (errAdmins) {
      console.error('Failed to load admin profiles:', errAdmins);
    }

    try {
      const absencesList = await absenceRequestService.getAbsenceRequests();
      setAbsenceRequests(absencesList || []);
    } catch (errAbs) {
      console.error('Failed to load absence requests:', errAbs);
    } finally {
      setAdminMetricsLoading(false);
    }
  };

  loadAdminMetricsRef.current = loadAdminMetrics;

  const handleAbsenceReview = async (requestId: string, status: 'Approved' | 'Rejected', remarks: string, req: AbsenceRequest) => {
    // Show saving status indicator immediately
    setSavingRequests(prev => ({ ...prev, [requestId]: true }));

    // Optimistically update status card and UI state
    const originalRequests = [...absenceRequests];
    const prevStatus = req.status;
    const nowISO = new Date().toISOString();
    
    const currentTimeline = req.historyTimeline || [{ action: 'Submitted', timestamp: req.createdAt }];
    const actionLabel = status === 'Approved' ? 'Approved' : 'Rejected';
    const updatedTimeline = [
      ...currentTimeline,
      {
        action: actionLabel,
        adminName: adminProfile.fullName,
        timestamp: nowISO
      }
    ];

    const updatedRequests = absenceRequests.map(r => {
      if (r.requestId === requestId) {
        return {
          ...r,
          status,
          adminRemarks: remarks || undefined,
          approvedBy: adminProfile.id,
          approvedByName: adminProfile.fullName,
          approvedAt: nowISO,
          previousStatus: prevStatus,
          statusChangedBy: adminProfile.id,
          statusChangedAt: nowISO,
          historyTimeline: updatedTimeline
        };
      }
      return r;
    });
    setAbsenceRequests(updatedRequests);

    // Call API in the background (no blocking delay refresh)
    try {
      const success = await absenceRequestService.updateAbsenceRequestStatus(requestId, {
        status,
        adminRemarks: remarks || undefined,
        approvedBy: adminProfile.id,
        approvedByName: adminProfile.fullName,
        previousStatus: prevStatus,
        statusChangedBy: adminProfile.id,
        statusChangedAt: nowISO,
        historyTimeline: updatedTimeline
      });

      if (success) {
        // Notify student of decision/excusal state change
        try {
          await notificationService.addNotification(
            status === 'Approved' ? 'Absence Request Approved' : 'Absence Request Rejected',
            `Your absence request for session "${req.sessionName}" has been ${status.toLowerCase()} by Admin ${adminProfile.fullName}.${remarks ? ' Remarks: ' + remarks : ''} [for: ${req.studentUsn || req.studentId}]`,
            'student'
          );
        } catch (err) {
          console.error('Failed to notify student:', err);
        }

        // Fire background refresh of overall database records and statistics
        loadAdminMetrics();
      } else {
        throw new Error('Database transaction refused status updates.');
      }
    } catch (err: any) {
      console.error('Failed to update request:', err);
      // Revert optimistic state on transactional failure
      setAbsenceRequests(originalRequests);
      alert(`Conflict/Error updating absence request: ${err.message || err}`);
    } finally {
      setSavingRequests(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const handleUndoAbsenceReview = async (req: AbsenceRequest) => {
    const requestId = req.requestId;
    setSavingRequests(prev => ({ ...prev, [requestId]: true }));

    // Optimistically revert status to Pending
    const originalRequests = [...absenceRequests];
    const prevStatus = req.status;
    const nowISO = new Date().toISOString();

    const currentTimeline = req.historyTimeline || [{ action: 'Submitted', timestamp: req.createdAt }];
    const actionLabel = prevStatus === 'Approved' ? 'Undo Approval' : 'Undo Rejection';
    const updatedTimeline = [
      ...currentTimeline,
      {
        action: actionLabel,
        adminName: adminProfile.fullName,
        timestamp: nowISO
      }
    ];

    const updatedRequests = absenceRequests.map(r => {
      if (r.requestId === requestId) {
        return {
          ...r,
          status: 'Pending' as const,
          adminRemarks: undefined,
          approvedBy: undefined,
          approvedByName: undefined,
          approvedAt: undefined,
          previousStatus: prevStatus,
          statusChangedBy: adminProfile.id,
          statusChangedAt: nowISO,
          historyTimeline: updatedTimeline
        };
      }
      return r;
    });
    setAbsenceRequests(updatedRequests);

    try {
      const success = await absenceRequestService.updateAbsenceRequestStatus(requestId, {
        status: 'Pending',
        adminRemarks: undefined,
        approvedBy: undefined,
        approvedByName: undefined,
        previousStatus: prevStatus,
        statusChangedBy: adminProfile.id,
        statusChangedAt: nowISO,
        historyTimeline: updatedTimeline
      });

      if (success) {
        // Notify student of reversal back to Pending status
        try {
          await notificationService.addNotification(
            'Absence Request Reverted',
            `Your absence request for session "${req.sessionName}" has been reverted back to Pending review by Admin ${adminProfile.fullName}. [for: ${req.studentUsn || req.studentId}]`,
            'student'
          );
        } catch (err) {
          console.error('Failed to notify student:', err);
        }

        // Run background metric sync
        loadAdminMetrics();
      } else {
        throw new Error('Database transaction refused status revert.');
      }
    } catch (err: any) {
      console.error('Failed to undo request status:', err);
      setAbsenceRequests(originalRequests);
      alert(`Conflict/Error undoing status review: ${err.message || err}`);
    } finally {
      setSavingRequests(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const sendSessionUpdateNotification = async (
    oldSess: Session, 
    newFields: Partial<Session>, 
    actionName: string
  ) => {
    try {
      const changedList: string[] = [];
      const nowStr = new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

      if (actionName === 'Force Started') {
        changedList.push(`Session status set to LIVE (Force Started).`);
      } else if (actionName === 'Force Ended') {
        changedList.push(`Session status set to Concluded (Force Ended).`);
      } else if (actionName === 'Cancelled') {
        changedList.push(`Session was deleted/cancelled.`);
      } else {
        if (newFields.name !== undefined && oldSess.name !== newFields.name) {
          changedList.push(`Title: changed from "${oldSess.name}" to "${newFields.name}"`);
        }
        if (newFields.description !== undefined && oldSess.description !== newFields.description) {
          changedList.push(`Description updated.`);
        }
        if (newFields.venue !== undefined && oldSess.venue !== newFields.venue) {
          changedList.push(`Venue: changed from "${oldSess.venue}" to "${newFields.venue}"`);
        }
        if (newFields.resourcePerson !== undefined && oldSess.resourcePerson !== newFields.resourcePerson) {
          const oldSpeaker = oldSess.resourcePerson || 'None';
          const newSpeaker = newFields.resourcePerson || 'None';
          changedList.push(`Speaker/Resource Person: changed from "${oldSpeaker}" to "${newSpeaker}"`);
        }
        if (newFields.date !== undefined && oldSess.date !== newFields.date) {
          changedList.push(`Date: changed from "${oldSess.date}" to "${newFields.date}"`);
        }
        if (newFields.startTime !== undefined && oldSess.startTime !== newFields.startTime) {
          changedList.push(`Start Time: changed from "${oldSess.startTime}" to "${newFields.startTime}"`);
        }
        if (newFields.endTime !== undefined && oldSess.endTime !== newFields.endTime) {
          changedList.push(`End Time: changed from "${oldSess.endTime}" to "${newFields.endTime}"`);
        }
        if (newFields.notes !== undefined && oldSess.notes !== newFields.notes) {
          changedList.push(`Notes updated.`);
        }
        if (newFields.sessionSummary !== undefined && oldSess.sessionSummary !== newFields.sessionSummary) {
          changedList.push(`Session summary updated.`);
        }
        if (newFields.authorizedAdminIds !== undefined) {
          const oldIds = oldSess.authorizedAdminIds || [];
          const newIds = newFields.authorizedAdminIds || [];
          const isEqual = oldIds.length === newIds.length && oldIds.every(id => newIds.includes(id));
          if (!isEqual) {
            const getNames = (ids: string[]) => ids.map(id => {
              if (id === adminProfile.id) return adminProfile.fullName;
              return adminProfiles.find(ap => ap.id === id)?.fullName || 'Co-Admin';
            }).join(', ');
            changedList.push(`Authorized Admins: updated to [${getNames(newIds) || 'None'}]`);
          }
        }
        if (newFields.extensionHistory !== undefined) {
          const lastExt = newFields.extensionHistory[newFields.extensionHistory.length - 1];
          if (lastExt) {
            changedList.push(`Session Extended: added +${lastExt.duration} minutes (New End Time: ${newFields.endTime})`);
          }
        }
      }

      if (changedList.length === 0) return;

      const messageContent = `Session: "${oldSess.name}"\n` +
        `Updated By: ${adminProfile.fullName}\n` +
        `Updated At: ${nowStr}\n` +
        `Changed Fields:\n- ` + changedList.join('\n- ');

      if (actionName === 'Session Updated') {
        const updatedSess: Session = {
          ...oldSess,
          ...newFields
        };
        await notificationService.handleSessionUpdate(oldSess, updatedSess);
        
        await notificationService.addNotification(
          `${actionName} 📢`,
          messageContent,
          'admin'
        );
      } else {
        await notificationService.addNotification(
          `${actionName} 📢`,
          messageContent,
          'student'
        );

        await notificationService.addNotification(
          `${actionName} 📢`,
          messageContent,
          'admin'
        );
      }
    } catch (e) {
      console.error("Failed to send session update notifications:", e);
    }
  };

  // Selected session details loaded on-demand helper is managed via local template bindings

  // Handle Session Form Submission
  const handleSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isCreatingSession) {
      console.log('[Duplicate Submission Control] Prevented concurrent execution click.');
      return;
    }

    // 1. PAST DATE / TIME VALIDATION
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeNowStr = `${hours}:${minutes}`;

    if (editingSession) {
      const normOriginalStart = editingSession.startTime ? editingSession.startTime.substring(0, 5) : '';
      const normOriginalEnd = editingSession.endTime ? editingSession.endTime.substring(0, 5) : '';
      const normFormStart = sessionForm.startTime ? sessionForm.startTime.substring(0, 5) : '';
      const normFormEnd = sessionForm.endTime ? sessionForm.endTime.substring(0, 5) : '';

      const hasStartTimeChanged = normOriginalStart !== normFormStart;
      const hasEndTimeChanged = normOriginalEnd !== normFormEnd;
      const hasDateChanged = editingSession.date !== sessionForm.date;

      if (isTimelineLocked) {
        if (hasDateChanged || hasStartTimeChanged) {
          showToast('Start date and start time cannot be modified once a session is Live or Completed.', 'error');
          return;
        }
      }

      // ✗ Session date to a past date
      if (hasDateChanged && sessionForm.date < todayStr) {
        showToast('Past dates are not allowed.', 'error');
        return;
      }

      // Run time validations ONLY if Start Time or End Time has actually changed
      if (hasStartTimeChanged || hasEndTimeChanged) {
        // If today:
        if (sessionForm.date === todayStr) {
          // ✗ Start Time can't be changed to a past time
          if (hasStartTimeChanged && sessionForm.startTime < timeNowStr) {
            showToast('Start time cannot be earlier than the current time.', 'error');
            return;
          }
          // ✗ End Time can't be changed to a past time
          if (hasEndTimeChanged && sessionForm.endTime < timeNowStr) {
            showToast('Start time cannot be earlier than the current time.', 'error');
            return;
          }
        }

        // If the date is in the past:
        if (sessionForm.date < todayStr) {
          // ✗ Start Time / End Time cannot be changed on a past session while keeping it in the past
          showToast('Start time cannot be earlier than the current time.', 'error');
          return;
        }

        // "End time must be after start time."
        if (sessionForm.endTime <= sessionForm.startTime) {
          showToast('End time must be after start time.', 'error');
          return;
        }
      }
    } else {
      // Creating a new session
      if (sessionForm.date < todayStr) {
        showToast('Past dates are not allowed.', 'error');
        return;
      }

      if (sessionForm.date === todayStr && sessionForm.startTime < timeNowStr) {
        showToast('Start time cannot be earlier than the current time.', 'error');
        return;
      }

      if (sessionForm.endTime <= sessionForm.startTime) {
        showToast('End time must be after start time.', 'error');
        return;
      }
    }

    // 2. VENUE CONFLICT DETECTION
    const venueConflict = sessions.find(s => {
      if (editingSession && s.id === editingSession.id) return false;

      // ONLY consider active/scheduled sessions; ignore 'expired' (Completed / Force Ended / Cancelled / Expired) status
      if (s.status !== 'inactive' && s.status !== 'live') return false;

      if (s.date === sessionForm.date && s.venue.trim().toLowerCase() === sessionForm.venue.trim().toLowerCase()) {
        const sStart = s.startTime.substring(0, 5);
        // Use actualEndTime if it exists, otherwise fall back to extended/standard endTime
        const sEnd = (s.actualEndTime || s.extendedEndTime || s.endTime).substring(0, 5);
        const fStart = sessionForm.startTime.substring(0, 5);
        const fEnd = sessionForm.endTime.substring(0, 5);

        // Standard math overlap: there is overlap if sStart < fEnd and fStart < sEnd
        if (sStart < fEnd && fStart < sEnd) {
          return true;
        }
      }
      return false;
    });

    if (venueConflict) {
      const conflictStart = venueConflict.startTime.substring(0, 5);
      const conflictEnd = (venueConflict.actualEndTime || venueConflict.extendedEndTime || venueConflict.endTime).substring(0, 5);
      showToast(`Venue ${sessionForm.venue} is occupied by ${venueConflict.name} from ${conflictStart} to ${conflictEnd}.`, 'error');
      return;
    }

    // 3. DUPLICATE SESSION NAME VALIDATION
    if (!editingSession) {
      const duplicateExists = sessions.some(s => s.name.trim().toLowerCase() === sessionForm.name.trim().toLowerCase());
      if (duplicateExists && approvedDuplicateName !== sessionForm.name.trim().toLowerCase()) {
        setShowDuplicateWarning(true);
        showToast('Warning: A session with this name already exists. Please confirm to continue.', 'info');
        return;
      }
    }

    setIsCreatingSession(true);
    try {
      let descriptionWithTag = sessionForm.feedbackRequirement === 'optional'
        ? `${sessionForm.description}\n[feedback:optional]`
        : `${sessionForm.description}\n[feedback:mandatory]`;

      if (editingSession?.description) {
        const existingClosingMatch = editingSession.description.match(/\[feedback_deadline:[^\]]+\]/) || editingSession.description.match(/\[feedback_closing:[^\]]+\]/);
        if (existingClosingMatch) {
          descriptionWithTag += `\n${existingClosingMatch[0]}`;
        }
      }

      if (editingSession) {
        const success = await sessionService.updateSession(editingSession.id, {
          name: sessionForm.name,
          description: descriptionWithTag,
          date: sessionForm.date,
          startTime: sessionForm.startTime,
          endTime: sessionForm.endTime,
          venue: sessionForm.venue,
          hostedBy: sessionForm.hostedBy,
          resourcePerson: sessionForm.resourcePerson,
          numberOfVolunteers: Number(sessionForm.numberOfVolunteers),
          volunteers: sessionForm.volunteers,
          authorizedAdminIds: sessionForm.authorizedAdminIds
        });
        if (success) {
          showToast(`Successfully updated session "${sessionForm.name}"`, 'success');
          
          // Dispatch descriptive notification of altered fields
          await sendSessionUpdateNotification(editingSession, {
            name: sessionForm.name,
            description: descriptionWithTag,
            date: sessionForm.date,
            startTime: sessionForm.startTime,
            endTime: sessionForm.endTime,
            venue: sessionForm.venue,
            hostedBy: sessionForm.hostedBy,
            resourcePerson: sessionForm.resourcePerson,
            authorizedAdminIds: sessionForm.authorizedAdminIds
          }, 'Session Updated');

          setShowSessionModal(false);
          setEditingSession(null);
          setApprovedDuplicateName('');
          setShowDuplicateWarning(false);
          localStorage.removeItem('unsaved_session_form');
          loadAdminMetrics();
        } else {
          showToast('Failed to update session details', 'error');
        }
      } else {
        // Ensure frontend duplicate block for exactly matching name, date, and startTime
        const exactDuplicateExists = sessions.some(s => 
          s.name.trim().toLowerCase() === sessionForm.name.trim().toLowerCase() &&
          s.date === sessionForm.date &&
          s.startTime.substring(0, 5) === sessionForm.startTime.substring(0, 5)
        );
        if (exactDuplicateExists) {
          showToast("A session with the same name, date, and start time already exists.", 'error');
          setIsCreatingSession(false);
          return;
        }

        const result = await sessionService.createSession({
          name: sessionForm.name,
          description: descriptionWithTag,
          date: sessionForm.date,
          startTime: sessionForm.startTime,
          endTime: sessionForm.endTime,
          venue: sessionForm.venue,
          hostedBy: sessionForm.hostedBy,
          resourcePerson: sessionForm.resourcePerson,
          numberOfVolunteers: Number(sessionForm.numberOfVolunteers),
          volunteers: sessionForm.volunteers,
          sessionOwnerId: adminProfile.id,
          authorizedAdminIds: sessionForm.authorizedAdminIds
        });
        if (result) {
          showToast(`Published Live session: "${sessionForm.name}"`, 'success');
          
          // Generate notification for new session created
          await notificationService.addNotification(
            `New Session Created 📅`,
            `A new educational session "${sessionForm.name}" has been scheduled on ${sessionForm.date} from ${sessionForm.startTime} to ${sessionForm.endTime} at ${sessionForm.venue}`,
            'all'
          );

          setShowSessionModal(false);
          setApprovedDuplicateName('');
          setShowDuplicateWarning(false);
          localStorage.removeItem('unsaved_session_form');
          loadAdminMetrics();
        } else {
          showToast('Failed to create new session.', 'error');
        }
      }
    } catch (err: any) {
      console.error('Session creation failed:', err);
      showToast(err?.message || 'An error occurred while scheduling the session.', 'error');
    } finally {
      setIsCreatingSession(false);
    }
  };

  const startEditSession = (sess: Session) => {
    setEditingSession(sess);
    setSessionForm({
      name: sess.name || '',
      description: getCleanDescription(sess.description || ''),
      date: sess.date || '',
      startTime: sess.startTime ? sess.startTime.substring(0, 5) : '',
      endTime: sess.endTime ? sess.endTime.substring(0, 5) : '',
      venue: sess.venue || '',
      hostedBy: sess.hostedBy || '',
      resourcePerson: sess.resourcePerson || '',
      numberOfVolunteers: sess.numberOfVolunteers || 0,
      volunteers: sess.volunteers || [],
      authorizedAdminIds: sess.authorizedAdminIds || [],
      feedbackRequirement: getFeedbackRequirement(sess.description),
      feedbackClosingTime: getFeedbackClosingTime(sess.description)
    });
    setShowSessionModal(true);
  };

  const deleteSession = (id: string) => {
    const sess = sessions.find(s => s.id === id);
    setDeleteConfirm({
      isOpen: true,
      message: `Are you sure you want to delete session "${sess?.name || 'this session'}"? All related attendance records, feedback, and session data will be permanently removed.`,
      isDeleting: false,
      onConfirm: async () => {
        try {
          const success = await sessionService.deleteSession(id);
          if (success) {
            // Remove deleted session from UI state immediately without reloading the entire page
            setSessions(prev => prev.filter(s => s.id !== id));
            setAttendance(prev => prev.filter(a => a.sessionId !== id));
            setSummaries(prev => prev.filter(s => s.sessionId !== id));
            showToast('Session deleted successfully.', 'success');

            // Send notification asynchronously in background
            if (sess) {
              sendSessionUpdateNotification(sess, {}, 'Cancelled').catch(err => console.warn('Async session update notification failed:', err));
            }
            notificationService.getNotifications('admin', adminProfile)
              .then(list => setNotifications(list || []))
              .catch(err => console.warn('Background notification refresh error:', err));
          } else {
            showToast('Unable to delete session. Please try again.', 'error');
          }
        } catch (err: any) {
          console.error('Delete session error:', err);
          showToast(`Unable to delete session: ${err?.message || 'Error'}`, 'error');
        }
      }
    });
  };

  const startSessionLiveNow = async (id: string) => {
    try {
      const sess = sessions.find(s => s.id === id);
      const success = await sessionService.startSession(id);
      if (success) {
        showToast('Session is now LIVE! QR check-ins are enabled.', 'success');
        if (sess) {
          await sendSessionUpdateNotification(sess, {}, 'Force Started');
        }
        loadAdminMetrics();
      } else {
        showToast('Failed to start session.', 'error');
      }
    } catch (err: any) {
      console.error('Error during force-start session workflow:', err);
      showToast(err?.message || 'Failed to start session.', 'error');
    }
  };

  const endSessionComplete = async (id: string) => {
    try {
      const sess = sessions.find(s => s.id === id);
      const success = await sessionService.endSession(id);
      if (success) {
        showToast('Session safely concluded. Assignment submission open.', 'success');
        if (sess) {
          await sendSessionUpdateNotification(sess, {}, 'Force Ended');
        }
        loadAdminMetrics();
      } else {
        showToast('Failed to end session.', 'error');
      }
    } catch (err: any) {
      console.error('Error during force-end session workflow:', err);
      showToast(err?.message || 'Failed to end session.', 'error');
    }
  };

  const handleExtendSession = async (sess: Session, minutes: number) => {
    if (sess.status === 'expired') {
      showToast('Cannot extend an already expired/concluded session.', 'error');
      return;
    }
    
    try {
      // Prevent duplicate multiple clicks within 5 seconds
      const lastExtension = sess.extensionHistory && sess.extensionHistory[sess.extensionHistory.length - 1];
      if (lastExtension) {
        const lastTime = new Date(lastExtension.timestamp).getTime();
        const now = new Date().getTime();
        if (now - lastTime < 5000) {
          showToast('Duplicate extension request ignored. Please wait a moment.', 'error');
          return;
        }
      }

      // Parse current end time
      const [hours, mins] = (sess.extendedEndTime || sess.endTime || '').split(':').map(Number);
      if (isNaN(hours) || isNaN(mins)) {
        showToast('Invalid session end time format.', 'error');
        return;
      }

      const totalMins = hours * 60 + mins + minutes;
      const hoursNew = Math.floor(totalMins / 60) % 24;
      const minsNew = totalMins % 60;
      const newEndTimeStr = `${String(hoursNew).padStart(2, '0')}:${String(minsNew).padStart(2, '0')}`;
      
      const originalEndTimeVal = sess.originalEndTime || sess.endTime;
      
      const extensionRecord = {
        timestamp: new Date().toISOString(),
        duration: minutes
      };
      
      const updatedHistory = [...(sess.extensionHistory || []), extensionRecord];
      
      const success = await sessionService.updateSession(sess.id, {
        endTime: newEndTimeStr,
        originalEndTime: originalEndTimeVal,
        extendedEndTime: newEndTimeStr,
        extensionHistory: updatedHistory
      });
      
      if (success) {
        showToast(`Extended "${sess.name}" session by ${minutes} minutes. New End Time: ${newEndTimeStr}`, 'success');
        
        // Push notification dynamically to Students
        await notificationService.addNotification(
          `Session Extended ⏰`,
          `"${sess.name}" has been extended by ${minutes} minutes and will stay active until ${newEndTimeStr}.`,
          'student'
        );
        
        loadAdminMetrics();
      } else {
        showToast('Failed to extend session.', 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast('Error executing session extension: ' + (err.message || err), 'error');
    }
  };

  // Manual Check-In Submit
  const handleManualCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSessionId = manualCheckIn.sessionId || selectedSessionId;
    const cleanUsn = manualCheckIn.usn.trim().toUpperCase();

    if (!cleanSessionId || !cleanUsn) {
      showToast('Provide required student USN for manual entry', 'info');
      return;
    }

    if (manualCheckIn.isValidStudent === false) {
      showToast(manualCheckIn.searchError || 'Student profile not found. Submission disabled.', 'error');
      return;
    }

    if (!manualCheckIn.fullName) {
      showToast('Please wait for the student profile search to compile.', 'info');
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
        const { data: profileRecord } = await supabase
          .from('profiles')
          .select('id, account_status, user_roles!inner(role)')
          .ilike('usn', cleanUsn)
          .eq('user_roles.role', 'student')
          .maybeSingle();
        if (profileRecord?.id) {
          if (profileRecord.account_status !== 'Approved') {
            showToast(`Cannot mark attendance: Student account is ${profileRecord.account_status || 'not active'}.`, 'error');
            return;
          }
          realStudentId = profileRecord.id;
          console.log("[Manual Check-In Success] Mapped USN to authentic Profile ID:", realStudentId);
        }
      } else {
        const match = studentProfiles.find(p => p.usn?.trim().toUpperCase() === cleanUsn);
        if (match) {
          if (match.accountStatus !== 'Approved') {
            showToast(`Cannot mark attendance: Student account is ${match.accountStatus || 'not active'}.`, 'error');
            return;
          }
          realStudentId = match.id;
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
      if (res.alreadyMarked) {
        showToast('Attendance is already marked.', 'info');
        return;
      }
      showToast(`Checked in ${manualCheckIn.fullName} manually.`, 'success');
      
      // Notify active mark
      await notificationService.addNotification(
        `Attendance Marked Successfully ✅`,
        `Attendance recorded manually for ${manualCheckIn.fullName} (${cleanUsn}) in session.`,
        'admin'
      );

      resetManualAttendanceForm();
      setShowManualCheckInModal(false);
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
          sessionId: assignmentForm.sessionId || undefined,
          lastModifiedBy: adminProfile.id,
          lastModifiedByName: adminProfile.fullName
        });
        if (success) {
          showToast('Updated student assignment resources.', 'success');
          setShowAssignmentModal(false);
          setEditingAssignment(null);
          localStorage.removeItem('unsaved_assignment_form');
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
          sessionId: assignmentForm.sessionId || undefined,
          createdBy: adminProfile.id,
          createdByName: adminProfile.fullName,
          lastModifiedBy: adminProfile.id,
          lastModifiedByName: adminProfile.fullName
        });
        if (res) {
          const formattedDueDate = new Date(assignmentForm.deadline).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
          }) + ' at ' + new Date(assignmentForm.deadline).toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit', hour12: true
          });

          await notificationService.addNotification(
            '📚 New Assignment',
            `A new assignment has been posted.\nAssignment: ${assignmentForm.title}\nDue: ${formattedDueDate} [assignmentId:${res.id}]`,
            'student'
          );

          showToast('Assignment released to students.', 'success');
          setShowAssignmentModal(false);
          localStorage.removeItem('unsaved_assignment_form');
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
    const target = assignments.find(a => a.id === id);
    if (!target) return;
    const assignSubs = submissions.filter(sub => sub.assignmentId === id);
    const hasSubs = assignSubs.length > 0;

    setAssignmentDeleteState({
      isOpen: true,
      assignmentId: id,
      assignmentTitle: target.title,
      hasSubmissions: hasSubs,
      submissionsCount: assignSubs.length,
      showDeleteVerification: false,
      verificationText: ''
    });
  };

  const handleExtendDeadline = async (assignmentId: string) => {
    try {
      const currentAssignObj = assignments.find(a => a.id === assignmentId);
      if (!currentAssignObj) {
        showToast('Assignment not found.', 'error');
        return;
      }

      const baseTime = Math.max(new Date().getTime(), new Date(currentAssignObj.deadline).getTime());
      let extensionMs = 0;
      if (extensionDurationType === '1h') extensionMs = 1 * 60 * 60 * 1000;
      else if (extensionDurationType === '6h') extensionMs = 6 * 60 * 60 * 1000;
      else if (extensionDurationType === '12h') extensionMs = 12 * 60 * 60 * 1000;
      else if (extensionDurationType === '1d') extensionMs = 24 * 60 * 60 * 1000;
      else if (extensionDurationType === '2d') extensionMs = 48 * 60 * 60 * 1000;

      let newDeadlineIso = '';
      if (extensionDurationType === 'custom') {
        if (!customExtensionDateTime) {
          showToast('Please select a custom date and time.', 'error');
          return;
        }
        newDeadlineIso = new Date(customExtensionDateTime).toISOString();
      } else {
        newDeadlineIso = new Date(baseTime + extensionMs).toISOString();
      }

      if (new Date(newDeadlineIso).getTime() <= new Date().getTime()) {
        showToast('The extended deadline must be in the future.', 'error');
        return;
      }

      const res = await assignmentService.extendAssignmentDeadline(
        assignmentId,
        newDeadlineIso,
        adminProfile.id,
        adminProfile.fullName
      );

      if (res) {
        showToast('Assignment deadline extended successfully!', 'success');
        setIsExtendingAssignment(false);
        setCustomExtensionDateTime('');
        setExtensionDurationType('1h');
        await loadAdminMetrics();
      } else {
        showToast('Failed to extend assignment deadline.', 'error');
      }
    } catch (err: any) {
      console.error('[handleExtendDeadline] Error:', err);
      showToast(err.message || 'An error occurred while extending the deadline.', 'error');
    }
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
    const rows = filtered.map((a, i) => {
      const recordMarkedBy = getRecordMarkedBy(a, sess);
      const recordMarkedAt = a.markedAt || a.checkInTime;
      return [
        String(i + 1),
        a.studentName,
        a.studentUsn,
        a.studentDept,
        formatReportDateTime(a.checkInTime),
        a.method.toUpperCase(),
        recordMarkedBy,
        formatReportDateTime(recordMarkedAt)
      ];
    });
    exportToCSV(
      `Attendance_Report_${sess.name.replace(/\s+/g, '_')}`,
      ['Sl No', 'Student Name', 'USN', 'Department', 'Check-In Time', 'Verification Method', 'Marked By', 'Marked At'],
      rows,
      `Attendance Report: ${sess.name}`,
      adminProfile?.fullName || 'Administrator'
    );
    showToast('Downloaded Attendance sheet as Excel CSV.', 'success');
  };

  const exportAttendanceExcel = (sess: Session) => {
    const filtered = attendance.filter(a => a.sessionId === sess.id);
    const rows = filtered.map((a, i) => {
      const recordMarkedBy = getRecordMarkedBy(a, sess);
      const recordMarkedAt = a.markedAt || a.checkInTime;
      return [
        String(i + 1),
        a.studentName,
        a.studentUsn,
        a.studentDept,
        formatReportDateTime(a.checkInTime),
        a.method.toUpperCase(),
        recordMarkedBy,
        formatReportDateTime(recordMarkedAt)
      ];
    });

    const filename = `Attendance_Report_${sess.name.replace(/\s+/g, '_')}`;
    const reportName = `Attendance Report: ${sess.name}`;
    const userName = adminProfile?.fullName || 'Administrator';

    exportSingleTableToExcel(
      filename,
      reportName,
      userName,
      'Attendance List',
      ['Sl No', 'Student Name', 'USN', 'Department', 'Check-In Time', 'Verification Method', 'Marked By', 'Marked At'],
      rows
    );
    showToast('Downloaded Attendance sheet as Excel Spreadsheet.', 'success');
  };

  const exportAttendancePDF = (sess: Session) => {
    const filtered = attendance.filter(a => a.sessionId === sess.id);
    const rows = filtered.map((a, i) => {
      const recordMarkedBy = getRecordMarkedBy(a, sess);
      const recordMarkedAt = a.markedAt || a.checkInTime;
      return [
        String(i + 1),
        a.studentName,
        a.studentUsn,
        a.studentDept,
        new Date(a.checkInTime).toLocaleString(),
        a.method.toUpperCase(),
        recordMarkedBy,
        formatAuditDateTime(recordMarkedAt)
      ];
    });

    const totalStudents = filtered.length;
    const qrCount = filtered.filter(a => a.method === 'qr').length;
    const manualCount = filtered.filter(a => a.method === 'manual').length;

    printFormattedReport(
      'Smart Attendance Hub Tracker',
      `Session Report: ${sess.name} (${sess.venue})`,
      ['Sl No', 'Student Name', 'USN ID', 'Branch / Department', 'Checked In Time', 'Origin Method', 'Marked By', 'Marked At'],
      rows,
      {
        'Total Check-Ins': totalStudents,
        'QR Scanned Count': qrCount,
        'Manual Entries': manualCount,
        'Hosting Body': sess.hostedBy
      }
    );
  };

  const exportAssignmentReportCSV = () => {
    const rows = assignments.map((a, i) => {
      const linkedSess = sessions.find(s => s.id === a.sessionId);
      const totalSubs = submissions.filter(sub => sub.assignmentId === a.id).length;
      const statusInfo = getAssignmentStatus(a.deadline);
      return [
        String(i + 1),
        a.title,
        linkedSess ? linkedSess.name : 'General / Independent',
        formatReportDate(a.deadline),
        String(totalSubs),
        statusInfo.status
      ];
    });

    exportToCSV(
      'Assignment_Report',
      ['Sl No', 'Assignment Name', 'Session / Topic', 'Due Date', 'Submitted Count', 'Completion Status'],
      rows,
      'Assignment Status Report',
      adminProfile?.fullName || 'Administrator'
    );
    showToast('Downloaded Assignment Report as CSV.', 'success');
  };

  const exportAssignmentReportExcel = () => {
    const rows = assignments.map((a, i) => {
      const linkedSess = sessions.find(s => s.id === a.sessionId);
      const totalSubs = submissions.filter(sub => sub.assignmentId === a.id).length;
      const statusInfo = getAssignmentStatus(a.deadline);
      return [
        String(i + 1),
        a.title,
        linkedSess ? linkedSess.name : 'General / Independent',
        formatReportDate(a.deadline),
        String(totalSubs),
        statusInfo.status
      ];
    });

    const userName = adminProfile?.fullName || 'Administrator';
    exportSingleTableToExcel(
      'Assignment_Report',
      'Assignment Status Report',
      userName,
      'Assignments',
      ['Sl No', 'Assignment Name', 'Session / Topic', 'Due Date', 'Submitted Count', 'Completion Status'],
      rows
    );
    showToast('Downloaded Assignment Report as Excel Spreadsheet.', 'success');
  };

  const exportFeedbackReportCSV = () => {
    const currentSubmissions = summaries.filter(s => !selectedSessionId || s.sessionId === selectedSessionId);
    const rows = currentSubmissions.map((s, i) => {
      const sess = sessions.find(se => se.id === s.sessionId);
      return [
        String(i + 1),
        sess ? sess.name : 'Unknown Session',
        sess ? formatReportDate(sess.date) : 'N/A',
        s.studentName || 'Anonymous Student',
        String(s.rating || 0),
        String(s.instructorRating || 0),
        String(s.contentQualityRating || 0),
        String(s.engagementRating || 0),
        s.learningImpact || 'N/A',
        s.reflectionText || 'No Feedback Text'
      ];
    });

    exportToCSV(
      'Feedback_Report',
      ['Sl No', 'Session Name', 'Session Date', 'Marked By', 'Overall Rating', 'Instructor Rating', 'Content Quality', 'Engagement', 'Learning Impact', 'Feedback'],
      rows,
      'Feedback & Evaluation Report',
      adminProfile?.fullName || 'Administrator'
    );
    showToast('Downloaded Feedback Report as CSV.', 'success');
  };

  const exportFeedbackReportExcel = () => {
    const currentSubmissions = summaries.filter(s => !selectedSessionId || s.sessionId === selectedSessionId);
    const rows = currentSubmissions.map((s, i) => {
      const sess = sessions.find(se => se.id === s.sessionId);
      return [
        String(i + 1),
        sess ? sess.name : 'Unknown Session',
        sess ? formatReportDate(sess.date) : 'N/A',
        s.studentName || 'Anonymous Student',
        String(s.rating || 0),
        String(s.instructorRating || 0),
        String(s.contentQualityRating || 0),
        String(s.engagementRating || 0),
        s.learningImpact || 'N/A',
        s.reflectionText || 'No Feedback Text'
      ];
    });

    const userName = adminProfile?.fullName || 'Administrator';
    exportSingleTableToExcel(
      'Feedback_Report',
      'Feedback & Evaluation Report',
      userName,
      'Feedback Logs',
      ['Sl No', 'Session Name', 'Session Date', 'Marked By', 'Overall Rating', 'Instructor Rating', 'Content Quality', 'Engagement', 'Learning Impact', 'Feedback'],
      rows
    );
    showToast('Downloaded Feedback Report as Excel Spreadsheet.', 'success');
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

  const handleSuspendStudent = (studentId: string) => {
    setDeleteConfirm({
      isOpen: true,
      title: 'Suspend Student Account',
      message: 'Are you sure you want to suspend this approved student account? They will lose access to all active features but their historical attendance, submissions, and feedback data will remain fully intact.',
      onConfirm: async () => {
        const rollbackProfiles = [...studentProfiles];
        setStudentProfiles(prev => 
          prev.map(p => p.id === studentId ? { ...p, accountStatus: 'Suspended' } : p)
        );
        try {
          const result = await authService.updateStudentStatus(studentId, 'Suspended');
          if (result.success) {
            showToast('Student Suspended successfully!', 'success');
            await loadAdminMetrics();
          } else {
            setStudentProfiles(rollbackProfiles);
            showToast(result.error || 'Failed to suspend student.', 'error');
          }
        } catch (err: any) {
          setStudentProfiles(rollbackProfiles);
          showToast('An error occurred while suspending student.', 'error');
        }
      }
    });
  };

  const handleReactivateStudent = (studentId: string) => {
    setDeleteConfirm({
      isOpen: true,
      title: 'Reactivate Student Account',
      message: 'Are you sure you want to reactivate this student account? They will be granted full access immediately.',
      onConfirm: async () => {
        const rollbackProfiles = [...studentProfiles];
        setStudentProfiles(prev => 
          prev.map(p => p.id === studentId ? { ...p, accountStatus: 'Approved' } : p)
        );
        try {
          const result = await authService.updateStudentStatus(studentId, 'Approved');
          if (result.success) {
            showToast('Student Reactived successfully!', 'success');
            await loadAdminMetrics();
          } else {
            setStudentProfiles(rollbackProfiles);
            showToast(result.error || 'Failed to reactivate student.', 'error');
          }
        } catch (err: any) {
          setStudentProfiles(rollbackProfiles);
          showToast('An error occurred while reactivating student.', 'error');
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

  const renderAdminSessionStatistics = (s: Session) => {
    const currentAttendance = attendance.filter(a => a.sessionId === s.id);
    const uniqueAttendees = currentAttendance.filter((item, index, self) =>
      self.findIndex(t => t.studentId === item.studentId) === index
    );
    const presentCount = uniqueAttendees.length;
    
    // Exclude approved excuse requests from registered count for this session
    const currentSessionAbsences = (absenceRequests || []).filter(r => r.sessionId === s.id && r.status === 'Approved').length;
    const registeredCount = Math.max(1, (studentProfiles.length || 60) - currentSessionAbsences);
    const absentCount = Math.max(0, registeredCount - presentCount);
    const attendanceRate = registeredCount > 0 ? Math.round((presentCount / registeredCount) * 100) : 0;
    
    const currentFeedback = summaries.filter(su => su.sessionId === s.id);
    const uniqueFeedback = currentFeedback.filter((item, index, self) =>
      self.findIndex(t => 
        (t.studentUsn && item.studentUsn && t.studentUsn.trim().toLowerCase() === item.studentUsn.trim().toLowerCase()) ||
        (t.studentId && item.studentId && t.studentId === item.studentId)
      ) === index
    );
    const feedbackSubmitted = uniqueFeedback.length;
    const feedbackPending = Math.max(0, presentCount - feedbackSubmitted);
    
    const ownerName = adminProfiles.find(ap => ap.id === s.sessionOwnerId)?.fullName || s.hostedBy || 'System Creator';
    const authorizedNames = (s.authorizedAdminIds || [])
      .map(id => adminProfiles.find(ap => ap.id === id)?.fullName)
      .filter(Boolean)
      .join(', ') || 'None';
      
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
    const displayStatus = getSessionState(s);

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
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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

          {/* Card 4: Feedback Responses */}
          <div className="bg-slate-950/45 p-4 rounded-xl border border-slate-900 flex flex-col justify-center items-center text-center h-28 aspect-auto">
            <div className="text-2xl sm:text-3xl font-black text-purple-400 tracking-tight">
              {feedbackSubmitted}
            </div>
            <span className="text-[10.0px] text-slate-400 font-bold uppercase mt-1.5 tracking-wider">Feedback Responses</span>
          </div>

          {/* Card 5: Timing */}
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
  const filteredSessions = sessions.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q) ||
      s.venue.toLowerCase().includes(q)
    );
  });

  // Date and Time limits for form validations
  const nowForMin = new Date();
  const localToday = !editingSession
    ? `${nowForMin.getFullYear()}-${String(nowForMin.getMonth() + 1).padStart(2, '0')}-${String(nowForMin.getDate()).padStart(2, '0')}`
    : undefined;
  const startMinTime = (!editingSession && sessionForm.date === localToday)
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
        <div className="icon-input-container w-full max-w-xs h-9">
          <div className="flex items-center justify-center w-9 h-9 shrink-0 text-slate-500 border-r border-slate-800/40">
            <Search className="h-3.5 w-3.5" />
          </div>
          <input
            type="text"
            placeholder="Search sessions or resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="transparent-input-field !p-2 text-xs text-white"
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
            id="btn-admin-signout"
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

      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 grid md:grid-cols-12 gap-8">
        
        {/* Left hand Sidebar Navigation panel */}
        <div className="md:col-span-3 flex flex-col space-y-4">
          
          <div className="glass-panel p-4.5 rounded-2xl flex flex-col space-y-2">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-2">Workspace Navigation</span>
            
            <button
              onClick={() => setActiveTab('sessions')}
              data-active={activeTab === 'sessions'}
              className={`sidebar-nav-btn ${activeTab === 'sessions' ? 'active bg-cyan-500 text-white font-bold shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'text-slate-400 hover:text-white hover:bg-slate-900/80'}`}
            >
              <Calendar className={`h-4 w-4 shrink-0 ${activeTab === 'sessions' ? 'text-white' : 'text-slate-400'}`} />
              <span>Session Management</span>
            </button>

            <button
              onClick={() => setActiveTab('attendance')}
              data-active={activeTab === 'attendance'}
              className={`sidebar-nav-btn ${activeTab === 'attendance' ? 'active bg-cyan-500 text-white font-bold shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'text-slate-400 hover:text-white hover:bg-slate-900/80'}`}
            >
              <Users className={`h-4 w-4 shrink-0 ${activeTab === 'attendance' ? 'text-white' : 'text-slate-400'}`} />
              <span>Attendance Management</span>
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
              onClick={() => setActiveTab('summaries')}
              data-active={activeTab === 'summaries'}
              className={`sidebar-nav-btn ${activeTab === 'summaries' ? 'active bg-cyan-500 text-white font-bold shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'text-slate-400 hover:text-white hover:bg-slate-900/80'}`}
            >
              <FileText className={`h-4 w-4 shrink-0 ${activeTab === 'summaries' ? 'text-white' : 'text-slate-400'}`} />
              <span>Session Feedback</span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              data-active={activeTab === 'analytics'}
              className={`sidebar-nav-btn ${activeTab === 'analytics' ? 'active bg-cyan-500 text-white font-bold shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'text-slate-400 hover:text-white hover:bg-slate-900/80'}`}
            >
              <BarChart3 className={`h-4 w-4 shrink-0 ${activeTab === 'analytics' ? 'text-white' : 'text-slate-400'}`} />
              <span>Reports & Analytics</span>
            </button>

            <button
              onClick={() => setActiveTab('approvals')}
              data-active={activeTab === 'approvals'}
              className={`sidebar-nav-btn ${activeTab === 'approvals' ? 'active bg-cyan-500 text-white font-bold shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'text-slate-400 hover:text-white hover:bg-slate-900/80'}`}
            >
              <Award className={`h-4 w-4 shrink-0 ${activeTab === 'approvals' ? 'text-white' : 'text-slate-400'}`} />
              <span>Student Approvals</span>
            </button>

            <button
              onClick={() => setActiveTab('reports')}
              data-active={activeTab === 'reports'}
              className={`sidebar-nav-btn ${activeTab === 'reports' ? 'active bg-cyan-500 text-white font-bold shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'text-slate-400 hover:text-white hover:bg-slate-900/80'}`}
            >
              <FileCheck className={`h-4 w-4 shrink-0 ${activeTab === 'reports' ? 'text-white' : 'text-slate-400'}`} />
              <span>Student Progress Cards</span>
            </button>

            <button
              onClick={() => setActiveTab('absences')}
              data-active={activeTab === 'absences'}
              className={`sidebar-nav-btn ${activeTab === 'absences' ? 'active bg-cyan-500 text-white font-bold shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'text-slate-400 hover:text-white hover:bg-slate-900/80'}`}
            >
              <AlertCircle className={`h-4 w-4 shrink-0 ${activeTab === 'absences' ? 'text-white' : 'text-slate-400'}`} />
              <span>Absence Regularization</span>
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              data-active={activeTab === 'profile'}
              className={`sidebar-nav-btn ${activeTab === 'profile' ? 'active bg-cyan-500 text-white font-bold shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'text-slate-400 hover:text-white hover:bg-slate-900/80'}`}
            >
              <ShieldCheck className={`h-4 w-4 shrink-0 ${activeTab === 'profile' ? 'text-white' : 'text-slate-400'}`} />
              <span>Security & Profile</span>
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
              <div id="metric-pending-absences" className="bg-slate-900/40 p-2 border border-slate-800/80 rounded-xl">
                <div className="text-slate-400 text-[8.5px] uppercase tracking-wider font-semibold">Pending Abs.</div>
                <div className="font-display font-black text-base text-pink-400 mt-0.5">{absenceRequests.filter(r => r.status === 'Pending').length}</div>
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
                  const { icon: CategoryIcon, emoji } = getNotificationCategoryInfo(notif.title, notif.message);

                  let displayTitle = notif.title;
                  let displayMessage = notif.message;
                  if (notif.title.toLowerCase().includes('account approved') || notif.message.toLowerCase().includes('your account has been approved')) {
                    displayTitle = '🎉 Account Approved';
                    displayMessage = `Congratulations!\nYour account has been approved successfully.\nYou now have full access to Smart Attendance Hub.\nEnjoy exploring attendance, assignments, sessions, reports, and all available student features.`;
                  } else if (!displayTitle.includes(emoji) && emoji !== '🔔') {
                    displayTitle = `${emoji} ${displayTitle}`;
                  }

                  return (
                    <div key={notif.id} className={`p-3 rounded-xl border text-[11px] leading-snug space-y-1.5 transition-all ${
                      theme === 'dark'
                        ? (isRead 
                            ? 'bg-slate-950/40 border-slate-900/60 opacity-80 hover:bg-slate-900/30' 
                            : 'bg-slate-900 border-slate-800 hover:bg-slate-850/80 shadow-sm')
                        : (isRead 
                            ? 'bg-slate-50 border-slate-200 opacity-75 hover:bg-slate-100/50' 
                            : 'bg-blue-500/5 border-blue-100 hover:bg-blue-500/10')
                    }`}>
                      <div className="font-semibold flex justify-between items-start gap-1">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <span className={`truncate font-sans ${
                            theme === 'dark'
                              ? (isRead ? 'font-medium text-slate-400' : 'font-bold text-white')
                              : (isRead ? 'font-medium text-slate-500' : 'font-bold text-slate-900')
                          }`}>{displayTitle}</span>
                          {!isRead && (
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0 shadow-[0_0_4px_rgba(59,130,246,0.6)]" title="Unread" />
                          )}
                        </div>
                      </div>
                      
                      <p className={`whitespace-pre-wrap leading-relaxed ${
                        theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                      }`}>{displayMessage}</p>
                      
                      <div className={`flex items-center justify-between border-t pt-1.5 mt-1.5 text-[9px] ${
                        theme === 'dark' ? 'border-slate-900/40' : 'border-slate-200/60'
                      }`}>
                        <span className="text-slate-500 font-mono flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          <span>{getFriendlyTimestamp(notif.createdAt)}</span>
                        </span>

                        <div className="flex items-center gap-2">
                          {!isRead ? (
                            <button
                              onClick={() => handleAdminMarkIndividualAsRead(notif.id)}
                              className="text-[#a855f7] hover:text-[#c084fc] font-bold cursor-pointer font-sans"
                            >
                              Mark Read
                            </button>
                          ) : (
                            <span className="text-slate-600 font-medium font-sans">Read</span>
                          )}
                          <button
                            onClick={() => handleAdminDeleteIndividual(notif.id)}
                            className="text-slate-500 hover:text-rose-400 flex items-center cursor-pointer font-sans"
                            title="Delete notification"
                          >
                            <Trash2 className="h-2.5 w-2.5 mr-0.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4 text-slate-500 italic text-[11px]">
                No Notifications. You're all caught up.
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
                      volunteers: [],
                      authorizedAdminIds: [],
                      feedbackRequirement: 'mandatory'
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
                sessions.filter(s => getSessionState(s) === 'Live').map(s => {
                  const permissions = getAdminPermissionLevel(s);
                  // Check if current user is allowed to manage attendance for this live session
                  if (!permissions.canManageAttendance) {
                    return (
                      <div key={s.id} className="glass-panel-neon-cyan p-5 rounded-2xl bg-cyan-950/20 relative overflow-hidden flex flex-col justify-between items-start gap-4">
                        <div className="absolute top-0 right-0 h-1 bg-cyan-400 w-full" />
                        <div className="space-y-1">
                          <span className="text-[10.5px] font-mono text-cyan-300 uppercase tracking-widest font-black">SESSION RUNNING</span>
                          <h3 className="font-display font-extrabold text-xl text-white">{s.name}</h3>
                          <p className="text-xs text-slate-400">Status: Running | Restricted View (Check-in management locked for your profile level).</p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={s.id} className="glass-panel-neon-cyan p-5 rounded-2xl bg-cyan-950/20 relative overflow-hidden flex flex-col justify-between items-start gap-4">
                      <div className="absolute top-0 right-0 h-1 bg-cyan-400 w-full animate-pulse" />
                      <div className="w-full flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="px-2 py-0.5 rounded bg-cyan-400 text-slate-950 text-[10px] font-black tracking-widest animate-pulse uppercase">LIVE BADGE</span>
                            <span className="text-[10.5px] font-mono text-cyan-300 uppercase tracking-widest font-black">
                              {s.extendedEndTime ? 'SESSION EXTENDED LIVE' : 'SESSION LIVE NOW'}
                            </span>
                          </div>
                          <h3 className="font-display font-extrabold text-xl text-white">{s.name}</h3>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 mt-1">
                            <span className="flex items-center"><MapPin className="h-3.5 w-3.5 text-cyan-400 mr-1" /> {s.venue}</span>
                            <span className="flex items-center">
                              <Clock className="h-3.5 w-3.5 text-cyan-400 mr-1" /> 
                              {s.startTime} - {s.endTime} 
                              {s.extendedEndTime && <span className="text-cyan-400 ml-1.5 font-bold font-mono">(Extended from {s.originalEndTime || s.startTime})</span>}
                            </span>
                            <span className="flex items-center"><UserIcon className="h-3.5 w-3.5 text-cyan-400 mr-1" /> Hosted by {s.hostedBy}</span>
                          </div>

                          {/* Extension controls for Session Owner */}
                          {permissions.canModify && (
                            <div className="flex items-center space-x-2 mt-3.5 bg-slate-950/40 p-2 rounded-xl border border-slate-900 w-fit">
                              <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5 text-cyan-400" />
                                Extend:
                              </span>
                              {[5, 10, 15, 30, 60].map(mins => (
                                <button
                                  key={mins}
                                  onClick={() => handleExtendSession(s, mins)}
                                  className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-[10.5px] font-mono font-bold hover:text-cyan-400 hover:border-cyan-500/40 transition-all cursor-pointer text-slate-300"
                                >
                                  +{mins}m
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Extension History List */}
                          {s.extensionHistory && s.extensionHistory.length > 0 && (
                            <div className="text-[10px] font-mono text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-slate-900/80 mt-2 max-w-sm">
                              <span className="font-extrabold text-slate-300 block mb-1 uppercase tracking-wider text-[9px]">Extension Log:</span>
                              <ul className="list-disc list-inside space-y-0.5">
                                {s.extensionHistory.map((h: any, idx: number) => (
                                  <li key={idx}>
                                    +{h.duration}m extension logged at {new Date(h.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {/* Real-time Session Statistics Dashboard */}
                          {renderAdminSessionStatistics(s)}
                        </div>

                        <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end shrink-0">
                          {permissions.canManageAttendance && (
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
                          )}
                          
                          {permissions.canModify && (
                            <button
                              onClick={() => endSessionComplete(s.id)}
                              className="px-3.5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-500 transition-all cursor-pointer"
                            >
                              Conclude Active Session
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
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
              {adminMetricsLoading ? (
                <AdminSkeletonLoader />
              ) : filteredSessions.length > 0 ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  {filteredSessions.map(s => {
                    const permissions = getAdminPermissionLevel(s);
                    return (
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
                            
                            {permissions.canModify && (
                              <div className="flex space-x-1">
                                <button 
                                  onClick={() => startEditSession(s)}
                                  className="p-1 px-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-all text-xs cursor-pointer"
                                  title="Edit Session"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                                <button 
                                  onClick={() => deleteSession(s.id)}
                                  className="p-1 px-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 transition-all text-xs cursor-pointer"
                                  title="Delete Session"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>

                          <h4 className="font-display font-extrabold text-base text-white">{s.name}</h4>
                          <p className="text-xs text-slate-400 line-clamp-2">{s.description || 'No description provided.'}</p>
                        </div>

                        <div className="space-y-2 border-t border-slate-900/60 pt-3 text-slate-400">
                          <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 text-[10.5px]">
                            <span className="truncate flex items-center font-mono">Date: {s.date}</span>
                            <span className="truncate flex items-center">Venue: {s.venue}</span>
                            <span className="truncate flex items-center">Expert: {s.resourcePerson}</span>
                            <span className="truncate flex items-center text-cyan-400 font-bold">
                              Attendees: {attendance.filter(a => a.sessionId === s.id).length} Checked In
                            </span>
                          </div>

                          {/* Session Permissions Sub-section */}
                          <div className="border-t border-slate-900/60 pt-3 mt-3 text-xs space-y-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">Session Owner:</span>
                                <span className="text-slate-200 font-extrabold text-xs block mt-0.5">
                                  {adminProfiles.find(ap => ap.id === s.sessionOwnerId)?.fullName || s.hostedBy || 'System Creator'}
                                </span>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-widest border shrink-0 ${
                                permissions.isOwner 
                                  ? 'bg-cyan-950/40 text-cyan-400 border-cyan-900/60' 
                                  : permissions.isAuthorized 
                                  ? 'bg-amber-950/40 text-amber-400 border-amber-900/60' 
                                  : 'bg-rose-950/40 text-rose-400 border-rose-900/60'
                              }`}>
                                {permissions.isOwner ? 'Owner' : permissions.isAuthorized ? 'Authorized Admin' : 'No Access'}
                              </span>
                            </div>
                            
                            <div>
                              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">Authorized Admins:</span>
                              <span className="text-slate-300 text-xs font-semibold block mt-0.5">
                                {(() => {
                                  let ids = s.authorizedAdminIds || [];
                                  if (!Array.isArray(ids)) {
                                    ids = [];
                                  }
                                  if (ids.length === 0) {
                                    console.log(`[Authorized Admins Debug] Session "${s.name}" (${s.id}) - Saved authorized admin IDs: [] (Empty)`);
                                    return 'None';
                                  }
                                  const listNames = ids.map(id => {
                                    const ap = adminProfiles.find(p => p.id === id);
                                    if (!ap) {
                                      console.warn(`[Authorized Admins Debug] Session "${s.name}" - Retrieved admin ID is missing public profile: ${id}`);
                                      return null;
                                    }
                                    return ap.fullName;
                                  }).filter(Boolean);

                                  console.log(`[Authorized Admins Debug]
  - Session Name: "${s.name}" 
  - Saved Admin IDs:`, ids, `
  - Retrieved Admin Names:`, listNames);

                                  return listNames.length > 0 ? listNames.join(', ') : 'None';
                                })()}
                              </span>
                            </div>
                          </div>

                          {/* Real-time Session Statistics Dashboard */}
                          {renderAdminSessionStatistics(s)}

                          <div className="flex space-x-2 pt-2">
                            {permissions.canModify && getSessionState(s) === 'Upcoming' && (
                              <button
                                onClick={() => startSessionLiveNow(s.id)}
                                className="flex-grow py-2 rounded-xl bg-slate-900 hover:bg-orange-500 hover:text-slate-950 text-slate-300 font-bold text-xs transition-all border border-slate-800 hover:border-orange-500 cursor-pointer text-center"
                              >
                                Force Start ⚡
                              </button>
                            )}
                            {permissions.canModify && getSessionState(s) === 'Live' && (
                              <button
                                onClick={() => endSessionComplete(s.id)}
                                className="flex-grow py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all text-center cursor-pointer"
                              >
                                Force End 🚫
                              </button>
                            )}
                            
                            {permissions.canManageAttendance ? (
                              <button
                                onClick={() => {
                                  setSelectedSessionId(s.id);
                                  setActiveTab('attendance');
                                }}
                                className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-semibold cursor-pointer"
                              >
                                Attendance Records
                              </button>
                            ) : (
                              <div className="w-full flex items-center justify-center p-2 rounded-xl bg-rose-950/20 border border-rose-900/30 text-rose-400 font-bold text-[10px] space-x-1.5 shadow-sm">
                                <Lock className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                                <span className="text-left leading-normal font-sans">Access Denied: You are not authorized to manage this session.</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="glass-panel p-8 text-center text-slate-500 rounded-2xl">
                  {searchQuery ? "No matching results found." : "No Sessions. Create a session to get started."}
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
                        onClick={() => exportAttendanceExcel(sessions.find(s => s.id === selectedSessionId)!)}
                        className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-cyan-400 text-xs font-bold hover:bg-slate-800 flex items-center space-x-1 cursor-pointer"
                      >
                        <Download className="h-4 w-4" />
                        <span>Excel Export</span>
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

              {/* Real-time search query and status method filter panels */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="glass-panel p-4 rounded-2xl">
                  <label className="text-xs uppercase font-bold tracking-wider text-slate-400 block mb-2">Search Student by Name or USN ID</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search student name, USN identifier..."
                      value={attendanceSearchQuery}
                      onChange={(e) => setAttendanceSearchQuery(e.target.value)}
                      className="glass-input w-full p-2.5 pr-9 rounded-xl text-xs"
                    />
                    <Search className="h-4 w-4 text-slate-500 absolute top-3 right-3" />
                  </div>
                </div>

                <div className="glass-panel p-4 rounded-2xl">
                  <label className="text-xs uppercase font-bold tracking-wider text-slate-400 block mb-2">Filter by Check-In Method</label>
                  <div className="flex bg-slate-900/40 p-1.5 rounded-xl border border-slate-900 text-xs">
                    {(['all', 'qr', 'manual'] as const).map(option => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setAttendanceStatusFilter(option)}
                        className={`flex-grow py-1.5 rounded-lg font-bold uppercase transition-all text-[10px] cursor-pointer ${
                          attendanceStatusFilter === option
                            ? 'bg-cyan-500 text-slate-950 shadow-sm font-extrabold'
                            : 'text-slate-404 hover:text-white'
                        }`}
                      >
                        {option === 'all' ? 'All Methods' : option === 'qr' ? 'QR Code' : 'Manual Entry'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ATTENDANCE RECORDS DATA TABLE */}
              {(() => {
                const currentSess = sessions.find(s => s.id === selectedSessionId);
                if (selectedSessionId && currentSess && !getAdminPermissionLevel(currentSess).canManageAttendance) {
                  return (
                    <div className="glass-panel p-8 text-center space-y-3 max-w-md mx-auto my-6">
                      <XCircle className="h-12 w-12 text-rose-500 mx-auto" />
                      <h3 className="text-base font-bold text-white font-display">Access Denied</h3>
                      <p className="text-xs text-slate-400">
                        You do not have permission to manage attendance or view records for <strong>{currentSess.name}</strong>.
                        Only the Session Owner (Creator) or Authorized Admins have access.
                      </p>
                    </div>
                  );
                }

                // Apply premium structural filtered list
                const filteredAttendance = attendance.filter(a => {
                  if (selectedSessionId && a.sessionId !== selectedSessionId) return false;
                  if (attendanceDeptFilter && (!a.studentDept || normalizeDepartmentName(a.studentDept).toUpperCase() !== normalizeDepartmentName(attendanceDeptFilter).toUpperCase())) return false;
                  
                  if (attendanceStatusFilter !== 'all' && a.method !== attendanceStatusFilter) return false;

                  const activeSearchQuery = searchQuery || attendanceSearchQuery;
                  if (activeSearchQuery) {
                    const q = activeSearchQuery.toLowerCase().trim();
                    const attendSess = sessions.find(s => s.id === a.sessionId);
                    const sessionName = attendSess ? attendSess.name.toLowerCase() : '';
                    const subject = attendSess ? (attendSess.description || '').toLowerCase() : '';
                    
                    const nameMatch = a.studentName.toLowerCase().includes(q);
                    const usnMatch = a.studentUsn.toLowerCase().includes(q);
                    const sessionMatch = sessionName.includes(q);
                    const subjectMatch = subject.includes(q);
                    const deptMatch = (a.studentDept || '').toLowerCase().includes(q);

                    if (!nameMatch && !usnMatch && !sessionMatch && !subjectMatch && !deptMatch) return false;
                  }

                  return true;
                });

                return (
                  <div className="glass-panel rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-slate-900/60 bg-slate-900/25 flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-200">
                        Showing {filteredAttendance.length} checked-in records
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
                            <th className="p-4">Marked By</th>
                            <th className="p-4">Marked At</th>
                            <th className="p-4 text-center">Via Method</th>
                            <th className="p-4 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="text-xs divide-y divide-slate-950">
                          {filteredAttendance.length > 0 ? (
                            filteredAttendance.map(a => {
                              const attendSess = sessions.find(s => s.id === a.sessionId);
                              const canDeleteThisRecord = attendSess ? getAdminPermissionLevel(attendSess).canModify : false;
                              const recordMarkedBy = getRecordMarkedBy(a, attendSess);
                              const recordMarkedAt = a.markedAt || a.checkInTime;
                              return (
                                <tr key={a.id} className="hover:bg-slate-900/30 transition-colors">
                                  <td className="p-4 font-semibold text-white">{a.studentName}</td>
                                  <td className="p-4 font-mono text-cyan-400">{a.studentUsn}</td>
                                  <td className="p-4 text-slate-400">{a.studentDept}</td>
                                  <td className="p-4 text-slate-400 font-mono">{new Date(a.checkInTime).toLocaleString()}</td>
                                  <td className="p-4 text-slate-400 font-semibold">{recordMarkedBy}</td>
                                  <td className="p-4 text-slate-400 font-mono">{formatAuditDateTime(recordMarkedAt)}</td>
                                  <td className="p-4 text-center">
                                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${a.method === 'qr' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-purple-500/10 text-purple-400'}`}>
                                      {a.method.toUpperCase()}
                                    </span>
                                  </td>
                                  <td className="p-4 text-center">
                                    {canDeleteThisRecord ? (
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
                                    ) : (
                                      <span className="text-[10px] text-slate-600 font-mono italic">Locked</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={8} className="p-8 text-center text-slate-500">
                                {searchQuery || attendanceSearchQuery ? "No matching results found." : "No Attendance Records Found"}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

            </div>
          )}

          {/* 3. ASSIGNMENTS TAB */}
          {activeTab === 'assignments' && (() => {
            const filteredAssignments = assignments.filter(asg => !asg.isArchived).filter(asg => {
              if (!searchQuery) return true;
              const q = searchQuery.toLowerCase().trim();
              const titleMatch = asg.title.toLowerCase().includes(q);
              const linkedSess = sessions.find(s => s.id === asg.sessionId);
              const subjectMatch = linkedSess ? linkedSess.name.toLowerCase().includes(q) : false;
              return titleMatch || subjectMatch;
            });

            return (
              <div className="space-y-4">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-bold text-white flex items-center">
                    <BookOpen className="h-5.5 w-5.5 text-cyan-400 mr-2" />
                    Assignment & Task Hub
                  </h2>
                  <p className="text-slate-400 text-xs">Define tasks, distribute documents, attach external reference materials, and grade student submissions.</p>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                  <button
                    onClick={exportAssignmentReportCSV}
                    className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 text-xs font-bold hover:bg-slate-800 flex items-center space-x-1 cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                    <span>Export CSV</span>
                  </button>
                  <button
                    onClick={exportAssignmentReportExcel}
                    className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-cyan-400 text-xs font-bold hover:bg-slate-800 flex items-center space-x-1 cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                    <span>Export Excel</span>
                  </button>
                  {(() => {
                    const currentSessForAssignment = sessions.find(s => s.id === selectedSessionId);
                    const canRelease = !selectedSessionId || (currentSessForAssignment ? getAdminPermissionLevel(currentSessForAssignment).canModify : true);
                    if (!canRelease) return null;
                    return (
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
                    );
                  })()}
                </div>
              </div>

              <div className="grid md:grid-cols-12 gap-6">
                
                {/* Assignments List */}
                <div className="md:col-span-5 space-y-6">
                  <div className="space-y-4">
                    <div className="text-xs uppercase font-bold tracking-widest text-slate-500">Active Tasks ({filteredAssignments.length})</div>
                    {adminMetricsLoading ? (
                      <AdminSkeletonLoader />
                    ) : filteredAssignments.length > 0 ? (
                      filteredAssignments.map(a => {
                        const statusInfo = getAssignmentStatus(a.deadline);
                        const linkedSess = sessions.find(s => s.id === a.sessionId);
                        const canModifyAssignment = true;
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
                              {canModifyAssignment && (
                                <div className="flex items-center space-x-1" onClick={e => e.stopPropagation()}>
                                  <button 
                                    onClick={() => setSelectedAssignmentId(a.id)}
                                    className={`p-1 rounded-lg transition-colors ${selectedAssignmentId === a.id ? 'text-cyan-400 bg-cyan-950/20' : 'text-slate-500 hover:text-white hover:bg-slate-900'}`}
                                    title="View Assignment"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </button>
                                  <button 
                                    onClick={() => startEditAssignment(a)}
                                    className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-slate-900 transition-colors"
                                    title="Edit Assignment"
                                  >
                                    <Edit3 className="h-3.5 w-3.5" />
                                  </button>
                                  <button 
                                    onClick={async () => {
                                      try {
                                        const res = await assignmentService.archiveAssignment(a.id, adminProfile.id, adminProfile.fullName);
                                        if (res) {
                                          showToast('Assignment archived successfully.', 'success');
                                          await loadAdminMetrics();
                                        } else {
                                          showToast('Unable to archive assignment.', 'error');
                                        }
                                      } catch (err: any) {
                                        showToast(err?.message || 'Unable to archive assignment.', 'error');
                                      }
                                    }}
                                    className="p-1 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-slate-900 transition-colors"
                                    title="Archive Assignment"
                                  >
                                    <Archive className="h-3.5 w-3.5" />
                                  </button>
                                  <button 
                                    onClick={() => deleteAssignment(a.id)}
                                    className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                    title="Delete Assignment"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )}
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
                        {searchQuery ? "No matching results found." : "No Assignments. Assignments will appear here."}
                      </div>
                    )}
                  </div>

                  {/* Archived Tasks Section */}
                  <div className="pt-6 border-t border-slate-900/40">
                    <div className="text-xs uppercase font-bold tracking-widest text-slate-500 mb-3.5 flex items-center space-x-1.5">
                      <span>Archived Tasks ({assignments.filter(a => a.isArchived).length})</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/50 animate-pulse"></span>
                    </div>
                    <div className="space-y-3">
                      {assignments.filter(a => a.isArchived).length > 0 ? (
                        assignments.filter(a => a.isArchived).map(a => {
                          const linkedSess = sessions.find(s => s.id === a.sessionId);
                          const subjectName = linkedSess ? linkedSess.name : 'No Session';
                          const archivedDateStr = a.archivedAt ? new Date(a.archivedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
                          const archivedByStr = a.archivedByName || 'N/A';
                          return (
                            <div 
                              key={a.id}
                              onClick={() => setSelectedAssignmentId(a.id)}
                              className={`glass-panel p-4 rounded-2xl cursor-pointer transition-all border ${selectedAssignmentId === a.id ? 'border-slate-700 bg-slate-900/20' : 'border-slate-950 bg-slate-950/10 hover:bg-slate-900/10'}`}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div className="space-y-0.5">
                                  <span className="text-[9px] font-mono text-slate-500 block">Archived on {archivedDateStr}</span>
                                  <span className="text-[10px] font-semibold text-slate-400">
                                    by {archivedByStr}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-1" onClick={e => e.stopPropagation()}>
                                  <button 
                                    onClick={() => setSelectedAssignmentId(a.id)}
                                    className={`p-1.5 rounded-lg transition-colors ${selectedAssignmentId === a.id ? 'text-cyan-400 bg-cyan-950/20' : 'text-slate-500 hover:text-white hover:bg-slate-900'}`}
                                    title="View Submissions"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </button>
                                  <button 
                                    onClick={async () => {
                                      try {
                                        const res = await assignmentService.restoreAssignment(a.id);
                                        if (res) {
                                          showToast('Assignment restored successfully.', 'success');
                                          await loadAdminMetrics();
                                        } else {
                                          showToast('Unable to restore assignment.', 'error');
                                        }
                                      } catch (err: any) {
                                        showToast(err?.message || 'Unable to restore assignment.', 'error');
                                      }
                                    }}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-slate-900 transition-colors"
                                    title="Restore Assignment"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  </button>
                                  <button 
                                    onClick={() => deleteAssignment(a.id)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                    title="Permanently Delete Assignment"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                              <h4 className="font-display font-semibold text-xs text-slate-400 line-through mb-1">{a.title}</h4>
                              <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1.5 border-t border-slate-900/20">
                                <span>Subject: {subjectName}</span>
                                <span>Submissions: {getSubmissionsForAssignment(a.id).length}</span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center text-slate-600 text-xs py-5 border border-dashed border-slate-900/60 rounded-xl">
                          No archived assignments.
                        </div>
                      )}
                    </div>
                  </div>
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
                              
                              <div className="col-span-2 border-t border-slate-900/40 pt-2.5 grid grid-cols-2 gap-3 text-xs text-slate-400">
                                <div>
                                  <span className="text-slate-500 font-bold block">Created At:</span>
                                  <span className="text-slate-300 font-mono block mt-0.5">{formatAssignmentAuditDateTime(currentAssignObj.createdAt)}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500 font-bold block">Last Updated:</span>
                                  <span className="text-slate-300 font-mono block mt-0.5">{formatAssignmentAuditDateTime(currentAssignObj.updatedAt || currentAssignObj.createdAt)}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500 font-bold block">Created By:</span>
                                  <span className="text-slate-200 font-semibold text-xs block mt-0.5 animate-fade-in">
                                    {(() => {
                                      const creatorId = currentAssignObj.createdBy;
                                      const creatorName = currentAssignObj.createdByName;
                                      
                                      const isPlaceholder = (name: string | undefined | null) => {
                                        if (!name) return true;
                                        const n = name.trim().toLowerCase();
                                        return n === 'administrator' || n === 'admin' || n === 'faculty' || n === 'user role' || n === 'system creator' || n === 'unknown creator' || n === 'unknown user';
                                      };

                                      if (creatorId) {
                                        if (creatorId === adminProfile.id) return adminProfile.fullName;
                                        const profileObj = adminProfiles.find(ap => ap.id === creatorId);
                                        if (profileObj) return profileObj.fullName;
                                      }
                                      if (creatorName && !isPlaceholder(creatorName)) {
                                        return creatorName;
                                      }
                                      if (creatorId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(creatorId)) {
                                        return creatorId;
                                      }
                                      return 'Unknown User';
                                    })()}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500 font-bold block">Last Modified By:</span>
                                  <span className="text-slate-200 font-semibold text-xs block mt-0.5 animate-fade-in">
                                    {(() => {
                                      const modifierId = currentAssignObj.lastModifiedBy;
                                      const modifierName = currentAssignObj.lastModifiedByName;

                                      const isPlaceholder = (name: string | undefined | null) => {
                                        if (!name) return true;
                                        const n = name.trim().toLowerCase();
                                        return n === 'administrator' || n === 'admin' || n === 'faculty' || n === 'user role' || n === 'system creator' || n === 'unknown creator' || n === 'unknown user';
                                      };

                                      if (modifierId) {
                                        if (modifierId === adminProfile.id) return adminProfile.fullName;
                                        const profileObj = adminProfiles.find(ap => ap.id === modifierId);
                                        if (profileObj) return profileObj.fullName;
                                      }
                                      if (modifierName && !isPlaceholder(modifierName)) {
                                        return modifierName;
                                      }
                                      if (modifierId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(modifierId)) {
                                        return modifierId;
                                      }
                                      
                                      const creatorName = currentAssignObj.createdByName;
                                      if (creatorName && !isPlaceholder(creatorName)) {
                                        return creatorName;
                                      }
                                      return 'Unknown User';
                                    })()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Extension Banner & Form */}
                          <div className="border-t border-slate-900/60 pt-4 mt-3 space-y-4">
                            {/* Deadline Extended banner */}
                            {currentAssignObj.originalDeadline && (
                              <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl space-y-2 animate-fade-in text-xs">
                                <span className="font-extrabold uppercase text-[10.5px] tracking-wider text-emerald-400 block flex items-center space-x-1">
                                  <span>🚀 Deadline Extended</span>
                                </span>
                                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 font-sans">
                                  <div>
                                    <span className="text-slate-500 font-bold block uppercase text-[8.5px] tracking-wider">Original Deadline:</span>
                                    <span className="font-mono">{new Date(currentAssignObj.originalDeadline).toLocaleString()}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 font-bold block uppercase text-[8.5px] tracking-wider">Current Extension:</span>
                                    <span className="font-mono text-cyan-400 font-bold">{new Date(currentAssignObj.deadline).toLocaleString()}</span>
                                  </div>
                                  {currentAssignObj.extendedByName && (
                                    <div className="col-span-2 border-t border-slate-900/40 pt-1.5 mt-0.5">
                                      <span className="text-slate-400">
                                        Extended by <span className="text-white font-bold">{currentAssignObj.extendedByName}</span>
                                        {currentAssignObj.extendedAt && <> on <span className="font-mono text-slate-350">{new Date(currentAssignObj.extendedAt).toLocaleString()}</span></>}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Accordion or button trigger */}
                            {!isExtendingAssignment ? (
                              <button
                                type="button"
                                onClick={() => setIsExtendingAssignment(true)}
                                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/30 hover:bg-slate-850 text-slate-300 hover:text-cyan-400 font-bold text-xs cursor-pointer flex items-center justify-center space-x-1.5 transition-all"
                              >
                                <Clock className="h-4 w-4 text-cyan-500" />
                                <span>Extend Assignment Deadline</span>
                              </button>
                            ) : (
                              <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-900 space-y-3.5 animate-fade-in">
                                <div className="text-xs font-bold text-white flex items-center justify-between border-b border-slate-900/40 pb-2">
                                  <span>Extend Submission Deadline</span>
                                  <span className="text-[10px] text-slate-400 font-normal">Select duration</span>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                  {(['1h', '6h', '12h', '1d', '2d', 'custom'] as const).map(type => {
                                    const labels: Record<typeof type, string> = {
                                      '1h': '+1 Hour',
                                      '6h': '+6 Hours',
                                      '12h': '+12 Hours',
                                      '1d': '+1 Day',
                                      '2d': '+2 Days',
                                      'custom': 'Custom Date'
                                    };
                                    return (
                                      <button
                                        key={type}
                                        type="button"
                                        onClick={() => setExtensionDurationType(type)}
                                        className={`py-2 px-3 rounded-lg text-center text-[11px] font-bold border transition-all cursor-pointer ${
                                          extensionDurationType === type
                                            ? 'bg-cyan-500 border-cyan-500 text-slate-950 font-extrabold'
                                            : 'bg-slate-950 border-slate-900 text-slate-400 hover:text-white hover:bg-slate-900'
                                        }`}
                                      >
                                        {labels[type]}
                                      </button>
                                    );
                                  })}
                                </div>

                                {extensionDurationType === 'custom' && (
                                  <div className="space-y-1.5 animate-fade-in">
                                    <label className="text-[10.5px] text-slate-500 font-mono uppercase block">Target Date & Time:</label>
                                    <input
                                      type="datetime-local"
                                      value={customExtensionDateTime}
                                      onChange={e => setCustomExtensionDateTime(e.target.value)}
                                      className="w-full bg-slate-950 border border-slate-900 text-xs px-3 py-2 text-white rounded-lg focus:outline-none focus:border-cyan-500"
                                    />
                                  </div>
                                )}

                                <div className="flex space-x-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => handleExtendDeadline(currentAssignObj.id)}
                                    className="flex-1 py-2 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs cursor-pointer transition-all"
                                  >
                                    Schedule Extension
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsExtendingAssignment(false);
                                      setExtensionDurationType('1h');
                                      setCustomExtensionDateTime('');
                                    }}
                                    className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-xs cursor-pointer border border-slate-800 transition-all"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="space-y-3">
                            <h4 className="font-semibold text-xs text-slate-200">Active Submissions ({assignSubs.length})</h4>
                            
                            {assignSubs.length > 0 ? (
                              assignSubs.map(sub => (
                                <div key={sub.id} className="bg-slate-950/60 border border-slate-900 p-4 rounded-xl space-y-3">
                                  <div className="flex flex-col sm:flex-row justify-between items-start gap-2 border-b border-slate-900/40 pb-2.5">
                                    <div>
                                      <div className="font-semibold text-xs text-white">{sub.studentName}</div>
                                      <div className="text-[10.5px] font-mono text-cyan-400">{sub.studentUsn}</div>
                                    </div>
                                    <div className="text-left sm:text-right text-[9.5px] font-mono text-slate-400 space-y-0.5 sm:self-center">
                                      <div><span className="text-slate-500 uppercase font-bold text-[8.5px]">Initial Hand-In:</span> {new Date(sub.submittedAt).toLocaleString()}</div>
                                      <div><span className="text-slate-500 uppercase font-bold text-[8.5px]">Last Updated:</span> {sub.lastUpdatedAt ? new Date(sub.lastUpdatedAt).toLocaleString() : new Date(sub.submittedAt).toLocaleString()}</div>
                                      <div><span className="text-slate-500 uppercase font-bold text-[8.5px]">Attempt Logs:</span> <span className="text-purple-400 font-bold">v{sub.version || 1} active submission</span></div>
                                    </div>
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
          );
        })()}

          {/* 4. SUMMARIES & REFLECTIONS TAB */}
          {activeTab === 'summaries' && (() => {
            const currentSubmissions = summaries.filter(s => !selectedSessionId || s.sessionId === selectedSessionId);
            const totalCount = currentSubmissions.length;
            
            // Calculate average sub-ratings
            const getAverage = (key: 'rating' | 'contentQualityRating' | 'instructorRating' | 'relevanceRating' | 'engagementRating') => {
              if (totalCount === 0) return '0.0';
              const sumVal = currentSubmissions.reduce((acc, curr) => {
                const val = curr[key] !== undefined && curr[key] !== null ? curr[key] : (curr.rating || 0);
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
                  
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={exportFeedbackReportCSV}
                      className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 text-xs font-bold hover:bg-slate-800 flex items-center space-x-1 cursor-pointer"
                    >
                      <Download className="h-4 w-4" />
                      <span>Export CSV</span>
                    </button>
                    <button
                      onClick={exportFeedbackReportExcel}
                      className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-cyan-400 text-xs font-bold hover:bg-slate-800 flex items-center space-x-1 cursor-pointer"
                    >
                      <Download className="h-4 w-4" />
                      <span>Export Excel</span>
                    </button>
                    <div className="bg-slate-900/60 border border-slate-800/85 px-4 py-2.5 rounded-xl shrink-0 flex items-center space-x-3">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total Evaluations</span>
                      <span className="font-mono text-xl font-extrabold text-cyan-405">{totalCount}</span>
                    </div>
                  </div>
                </div>

                {/* Feedback Deadline & Status Panel */}
                {(() => {
                  const selectedSessionObj = sessions.find(s => s.id === selectedSessionId) || (sessions.length > 0 ? sessions[0] : null);
                  if (!selectedSessionObj) {
                    return null;
                  }

                  const windowStatus = getFeedbackWindowStatus(selectedSessionObj);
                  const formattedTime = windowStatus.deadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const formattedDate = windowStatus.deadline.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
                  const displayTime = `${formattedTime} (${formattedDate})`;

                  return (
                    <div className={`glass-panel p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      windowStatus.isExpired
                        ? 'bg-rose-500/5 border-rose-500/20'
                        : windowStatus.isLocked
                        ? 'bg-amber-500/5 border-amber-500/20'
                        : 'bg-emerald-500/5 border-emerald-500/20'
                    }`}>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Feedback Status</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-extrabold ${windowStatus.badgeClass}`}>
                            {windowStatus.statusText}
                          </span>
                        </div>

                        <div className="text-xs text-slate-300 flex flex-wrap items-center gap-2">
                          <span className="text-slate-400 font-medium">
                            {windowStatus.isExpired ? 'Closed At:' : 'Available Until:'}
                          </span>
                          <span className="font-mono font-bold text-white">{displayTime}</span>
                          {!windowStatus.isExpired && !windowStatus.isLocked && (
                            <span className="text-[11px] text-emerald-400 font-semibold font-mono">
                              ({windowStatus.remainingText})
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        {windowStatus.isExpired ? (
                          <button
                            type="button"
                            onClick={() => handleOpenExtendFeedbackModal(selectedSessionObj)}
                            className="px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 hover:text-white text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            <span>Reopen Feedback</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenExtendFeedbackModal(selectedSessionObj)}
                            className="px-3.5 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 hover:text-white text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm"
                          >
                            <Clock className="h-3.5 w-3.5" />
                            <span>Extend Time</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

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
          {activeTab === 'analytics' && (() => {
            const now = new Date();
            
            const filteredSessionsForAnalytics = sessions.filter(s => {
              if (analyticsRange === 'all') return true;
              const sessDate = new Date(s.date);
              const diffTime = Math.abs(now.getTime() - sessDate.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              
              if (analyticsRange === 'daily') {
                return diffDays <= 1 || s.date === now.toISOString().split('T')[0];
              } else if (analyticsRange === 'weekly') {
                return diffDays <= 7;
              } else if (analyticsRange === 'monthly') {
                return diffDays <= 30;
              }
              return true;
            });

            const filteredSessIds = filteredSessionsForAnalytics.map(s => s.id);
            
            const filteredAttendanceForAnalytics = attendance.filter(a => filteredSessIds.includes(a.sessionId));
            
            const filteredSubmissionsForAnalytics = submissions.filter(sub => {
              const matchAssign = assignments.find(asg => asg.id === sub.assignmentId);
              return matchAssign && filteredSessIds.includes(matchAssign.sessionId || '');
            });

            return (
              <div className="space-y-6">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display text-2xl font-bold text-white flex items-center">
                      <BarChart3 className="h-5.5 w-5.5 text-cyan-400 mr-2" />
                      Educational Analytics Dashboard
                    </h2>
                    <p className="text-slate-400 text-xs text-left">A comprehensive operational perspective tracking student attendance curves, tasks and active sessions.</p>
                  </div>

                  <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-900/80 max-w-sm">
                    {(['all', 'daily', 'weekly', 'monthly'] as const).map(range => (
                      <button
                        key={range}
                        type="button"
                        onClick={() => setAnalyticsRange(range)}
                        className={`flex-grow py-1.5 px-3 rounded-lg font-bold uppercase transition-all text-[9.5px] cursor-pointer ${
                          analyticsRange === range
                            ? 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.25)] font-extrabold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {range === 'all' ? 'All Time' : range === 'daily' ? 'Daily' : range === 'weekly' ? 'Weekly' : 'Monthly'}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredSessionsForAnalytics.length === 0 ? (
                  <div className="glass-panel p-12 text-center text-slate-500 rounded-2xl font-semibold">
                    No Session Data Available for the Selected Range ({analyticsRange.toUpperCase()})
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
                            {filteredAttendanceForAnalytics.length > 0 && studentProfiles.length > 0 
                              ? `${Math.round((filteredAttendanceForAnalytics.length / (filteredSessionsForAnalytics.length * studentProfiles.filter(p => p.accountStatus === 'Approved').length || 1)) * 100)}%` 
                              : '0%'}
                          </span>
                          <span className="text-xs text-slate-400 block mt-1">Average system classroom presence</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">Based on ({analyticsRange}) data</div>
                      </div>

                      <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border-slate-800">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] uppercase font-bold tracking-widest text-purple-400">Task Completion Rate</span>
                          <CheckCircle className="h-4 w-4 text-purple-400" />
                        </div>
                        <div className="my-3">
                          <span className="font-display text-4xl font-extrabold text-white">
                            {assignments.length > 0 
                              ? `${Math.round((filteredSubmissionsForAnalytics.length / (assignments.filter(asg => filteredSessIds.includes(asg.sessionId || '')).length * studentProfiles.filter(p => p.accountStatus === 'Approved').length || 1)) * 100)}%` 
                              : '0%'}
                          </span>
                          <span className="text-xs text-slate-400 block mt-1">Assignment submission compliance</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">Based on ({analyticsRange}) data</div>
                      </div>

                      <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border-slate-800">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400">Interactive Feedbacks</span>
                          <Award className="h-4 w-4 text-emerald-400" />
                        </div>
                        <div className="my-3">
                          {(() => {
                            const rangeSummaries = summaries.filter(sum => filteredSessIds.includes(sum.sessionId));
                            const feedbackCount = rangeSummaries.length;
                            const totalRatingSum = rangeSummaries.reduce((acc, curr) => acc + (curr.rating || 0), 0);
                            const averageFeedbackRating = feedbackCount > 0 ? (totalRatingSum / feedbackCount).toFixed(1) : null;

                            return feedbackCount === 0 ? (
                              <>
                                <span className="font-display text-2xl font-extrabold text-white block">
                                  No Feedback Yet
                                </span>
                                <span className="text-xs text-slate-400 block mt-1">0 Responses</span>
                              </>
                            ) : (
                              <>
                                <span className="font-display text-4xl font-extrabold text-white block">
                                  {averageFeedbackRating} / 5
                                </span>
                                <span className="text-xs text-slate-400 block mt-1">{feedbackCount} {feedbackCount === 1 ? 'Response' : 'Responses'}</span>
                              </>
                            );
                          })()}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">Based on ({analyticsRange}) data</div>
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
                        <div className="flex justify-between items-center text-rose-450">
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
                          {filteredSessionsForAnalytics.slice(0, 5).map(s => {
                            const approvedCount = studentProfiles.filter(p => p.accountStatus === 'Approved').length || 1;
                            const counts = filteredAttendanceForAnalytics.filter(a => a.sessionId === s.id).length;
                            const ratio = Math.min((counts / approvedCount) * 100, 100);

                            return (
                              <div key={s.id} className="space-y-1">
                                <div className="flex justify-between text-xs">
                                  <span className="text-slate-300 font-semibold truncate max-w-xs">{s.name}</span>
                                  <span className="font-mono text-cyan-400">{counts} verified</span>
                                </div>
                                <div className="h-2.5 bg-slate-900 border border-slate-800 rounded-full overflow-hidden">
                                  <div 
                                    className="bg-cyan-500 h-full rounded-full shadow-[0_0_8px_rgba(6,182,212,0.4)]"
                                    style={{ width: `${ratio}%` }}
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
                          {(() => {
                            const stats: Array<{ name: string; percentage: number }> = [];
                            const depts = Array.from(new Set(filteredAttendanceForAnalytics.map(a => a.studentDept))).filter(Boolean) as string[];
                            const total = filteredAttendanceForAnalytics.length;
                            if (total > 0) {
                              depts.forEach(d => {
                                const deptCount = filteredAttendanceForAnalytics.filter(a => a.studentDept === d).length;
                                stats.push({
                                  name: d,
                                  percentage: Math.round((deptCount / total) * 100)
                                });
                              });
                            }
                            
                            return stats.length > 0 ? (
                              stats.map(d => (
                                <div key={d.name} id={`dept-${d.name.toLowerCase().replace(/\s+/g, '-')}`} className="flex justify-between items-center text-slate-400">
                                  <span className="truncate max-w-[150px]">{d.name}</span>
                                  <span className="text-white font-mono font-bold">{d.percentage}%</span>
                                </div>
                              ))
                            ) : (
                              <div id="no-department-data-msg" className="text-slate-500 text-[11px] py-4 text-center italic">
                                No Department Participation Data Available for the Selected Range
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                    </div>
                  </>
                )}

              </div>
            );
          })()}

          {/* 6. STUDENT APPROVALS TAB */}
          {activeTab === 'approvals' && (
            <div className="space-y-4">
              
              <div>
                <h2 className="font-display text-2xl font-bold text-white flex items-center">
                  <Award className="h-5.5 w-5.5 text-cyan-400 mr-2" />
                  Student Approvals & Account Statuses
                </h2>
                <p className="text-slate-400 text-xs text-left">Manage student registration request pipelines and configure active account statuses. You can approve pending requests, temporarily suspend active accounts, or reject applications.</p>
              </div>

              {/* Status Tabs Filter Bar */}
              <div className="flex flex-wrap gap-2 pb-2">
                {(['All', 'Pending', 'Approved', 'Suspended', 'Rejected'] as const).map(filterTab => {
                  const count = filterTab === 'All' 
                    ? studentProfiles.length 
                    : studentProfiles.filter(p => {
                        const s = p.accountStatus || 'Pending';
                        return s.toLowerCase() === filterTab.toLowerCase();
                      }).length;

                  return (
                    <button
                      key={filterTab}
                      onClick={() => setApprovalStatusFilter(filterTab)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                        approvalStatusFilter === filterTab
                          ? 'bg-cyan-500 text-slate-950 font-extrabold shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                          : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-900'
                      }`}
                    >
                      <span>{filterTab}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded ${
                        approvalStatusFilter === filterTab 
                          ? 'bg-slate-950/20 text-slate-950' 
                          : 'bg-slate-950/40 text-slate-500'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
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
                      {(() => {
                        const filteredProfiles = studentProfiles.filter(p => {
                          const s = p.accountStatus || 'Pending';
                          const matchesStatus = approvalStatusFilter === 'All' || s.toLowerCase() === approvalStatusFilter.toLowerCase();
                          if (!matchesStatus) return false;

                          if (searchQuery) {
                            const q = searchQuery.toLowerCase().trim();
                            const nameMatch = p.fullName.toLowerCase().includes(q);
                            const usnMatch = (p.usn || '').toLowerCase().includes(q);
                            const emailMatch = (p.email || '').toLowerCase().includes(q);
                            return nameMatch || usnMatch || emailMatch;
                          }
                          return true;
                        });

                        if (filteredProfiles.length > 0) {
                          return filteredProfiles.map(p => {
                            const status = p.accountStatus || 'Pending';
                            return (
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
                                    status === 'Approved' 
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                      : status === 'Suspended'
                                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                      : status === 'Rejected'
                                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                      : 'bg-blue-500/10 text-blue-400 border-blue-500/20' // 'Pending'
                                  }`}>
                                    {status.toUpperCase()}
                                  </span>
                                </td>
                                <td className="p-4 text-right">
                                  <div className="flex justify-end space-x-1.5">
                                    {status === 'Pending' && (
                                      <>
                                        <button
                                          onClick={() => handleApproveStudent(p.id)}
                                          className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-bold transition-all shadow-[0_0_8px_rgba(16,185,129,0.2)] cursor-pointer"
                                        >
                                          Approve
                                        </button>
                                        <button
                                          onClick={() => handleRejectStudent(p.id)}
                                          className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold transition-all cursor-pointer"
                                        >
                                          Reject
                                        </button>
                                      </>
                                    )}
                                    {status === 'Approved' && (
                                      <>
                                        <button
                                          onClick={() => handleSuspendStudent(p.id)}
                                          className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-bold transition-all shadow-[0_0_8px_rgba(245,158,11,0.2)] cursor-pointer"
                                        >
                                          Suspend
                                        </button>
                                        <button
                                          onClick={() => handleRejectStudent(p.id)}
                                          className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold transition-all cursor-pointer"
                                        >
                                          Reject
                                        </button>
                                      </>
                                    )}
                                    {status === 'Suspended' && (
                                      <>
                                        <button
                                          onClick={() => handleReactivateStudent(p.id)}
                                          className="px-2.5 py-1 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-[10px] font-bold transition-all shadow-[0_0_8px_rgba(6,182,212,0.2)] cursor-pointer"
                                        >
                                          Reactivate
                                        </button>
                                        <button
                                          onClick={() => handleRejectStudent(p.id)}
                                          className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold transition-all cursor-pointer"
                                        >
                                          Reject
                                        </button>
                                      </>
                                    )}
                                    {status === 'Rejected' && (
                                      <>
                                        <button
                                          onClick={() => handleReactivateStudent(p.id)}
                                          className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-bold transition-all shadow-[0_0_8px_rgba(16,185,129,0.2)] cursor-pointer"
                                        >
                                          Reactivate
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          });
                        } else {
                          return (
                            <tr>
                              <td colSpan={7} className="p-12 text-center text-slate-500">
                                <div className="text-sm font-extrabold text-slate-300 font-sans mb-1">
                                  {searchQuery ? "No matching results found." : (approvalStatusFilter === 'Pending' ? 'No pending student approvals.' : 'No Student Records Found')}
                                </div>
                                <div className="text-xs text-slate-400 font-sans">
                                  {searchQuery 
                                    ? 'Adjust your search parameters to locate specific registered profiles.'
                                    : (approvalStatusFilter === 'Pending' 
                                      ? 'All student registration requests have been processed.' 
                                      : `No student accounts match the filter status "${approvalStatusFilter}".`)}
                                </div>
                              </td>
                            </tr>
                          );
                        }
                      })()}
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
                    <div className="icon-input-container flex-1 bg-slate-900/90 border border-slate-800 rounded-xl h-10.5">
                      <div className="flex items-center justify-center w-11 h-10.5 shrink-0 text-slate-500 border-r border-slate-800/40">
                        <Search className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        placeholder="Search students by name, USN, or email..."
                        value={reportsSearch}
                        onChange={(e) => setReportsSearch(e.target.value)}
                        className="transparent-input-field text-xs text-slate-100 font-sans"
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
                            const q = (searchQuery || reportsSearch).toLowerCase().trim();
                            const matchesSearch = p.fullName.toLowerCase().includes(q) || 
                                                  (p.usn && p.usn.toLowerCase().includes(q)) ||
                                                  (p.email && p.email.toLowerCase().includes(q));
                            const matchesDept = !reportsDeptFilter || (p.department && normalizeDepartmentName(p.department).toUpperCase() === normalizeDepartmentName(reportsDeptFilter).toUpperCase());
                            return matchesSearch && matchesDept;
                          }).length > 0 ? (
                            studentProfiles.filter(p => {
                              const q = (searchQuery || reportsSearch).toLowerCase().trim();
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
                                  No matching results found.
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

          {activeTab === 'profile' && (
            <div className="space-y-6 max-w-2xl animation-fade-in text-left">
              <div>
                <h2 className="font-display text-2xl font-bold text-white flex items-center bg-transparent">
                  <ShieldCheck className="h-5.5 w-5.5 text-cyan-400 mr-2" />
                  Security & Profile Center
                </h2>
                <p className="text-slate-400 text-xs text-left">
                  Manage your personal details, workspace credentials, and update/regenerate your secure multi-factor login token.
                </p>
              </div>

              {/* Personal Details Layout Card */}
              <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="h-14 w-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <UserIcon className="h-6 w-6" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-bold text-white">{localAdminProfile.fullName}</h3>
                    <p className="text-xs text-slate-400">Workspace Administrator / Faculty</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-900/40">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center">
                      <Mail className="h-3 w-3 mr-1" /> Email Address
                    </span>
                    <p className="text-sm font-semibold text-slate-200">{localAdminProfile.email}</p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center">
                      <Shield className="h-3 w-3 mr-1" /> Admin Access ID
                    </span>
                    <p className="text-sm font-semibold text-slate-200 font-mono">{localAdminProfile.adminId || 'N/A'}</p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center">
                      <Clock className="h-3 w-3 mr-1" /> Account Created
                    </span>
                    <p className="text-sm font-semibold text-slate-200">
                      {localAdminProfile.createdAt ? new Date(localAdminProfile.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Security Center: Authentication Code Card */}
              <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 h-28 w-28 bg-gradient-to-br from-purple-500/5 to-transparent blur-2xl pointer-events-none" />
                
                <div className="flex items-start justify-between">
                  <div className="space-y-1 text-left">
                    <h3 className="text-base font-bold text-white flex items-center">
                      <KeyRound className="h-4 w-4 mr-2 text-purple-400" />
                      Two-Factor Authentication Code
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      This unique code must be supplied during login to verify your identity.
                    </p>
                  </div>
                </div>

                {/* Displaying Current Auth Code block */}
                <div className="bg-slate-950 border border-slate-900 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                      {profileCodeVisible ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                    </div>
                    <div className="text-left">
                      <div className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Your Current Secure Token</div>
                      <div className="font-mono text-xl font-bold tracking-widest text-slate-100 mt-0.5">
                        {profileCodeVisible ? (
                          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 font-black">
                            {localAdminProfile.authenticationCode || 'NOT_FOUND'}
                          </span>
                        ) : (
                          <span className="text-slate-600 font-black tracking-widest">•••••••••••</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setProfileCodeVisible(!profileCodeVisible)}
                      className="px-3 py-1.5 rounded-lg bg-slate-905 hover:bg-slate-850 border border-slate-800 text-xs font-semibold text-slate-300 transition-all cursor-pointer"
                    >
                      {profileCodeVisible ? 'Mask Code' : 'Reveal Code'}
                    </button>

                    <button
                      type="button"
                      disabled={!localAdminProfile.authenticationCode}
                      onClick={() => {
                        if (localAdminProfile.authenticationCode) {
                          navigator.clipboard.writeText(localAdminProfile.authenticationCode);
                          setProfileCodeCopied(true);
                          setTimeout(() => setProfileCodeCopied(false), 2000);
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-905 hover:bg-slate-850 border border-slate-800 text-xs font-semibold text-slate-300 transition-all cursor-pointer flex items-center space-x-1"
                    >
                      {profileCodeCopied ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Regenerate Code Warning & Action */}
                <div className="border-t border-slate-950/80 pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="text-left text-xs text-slate-500 max-w-sm leading-relaxed">
                    <strong>Warning:</strong> Regenerating your code will immediately invalidate your previous one. Ensure you record and copy the newly generated code below. No bypass is permitted.
                  </div>
                  
                  <button
                    type="button"
                    disabled={refreshCodeLoading}
                    onClick={promptRegenerateCode}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-white tracking-wide transition-all cursor-pointer shadow-[0_0_10px_rgba(139,92,246,0.15)] flex items-center justify-center space-x-1.5"
                  >
                    {refreshCodeLoading ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    <span>Regenerate Code</span>
                  </button>
                </div>
              </div>

              {/* Workspace Administrators Directory */}
              <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-900/60 pb-3">
                  <div className="text-left">
                    <h3 className="text-base font-bold text-white flex items-center">
                      <Shield className="h-4 w-4 mr-2 text-cyan-400" />
                      Workspace Administrators Directory
                    </h3>
                    <p className="text-xs text-slate-400">
                      Co-administrators and faculty members registered in this hub workspace.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900/40 text-[10px] uppercase font-bold tracking-widest text-slate-500 border-b border-slate-900/80">
                        <th className="p-3">Full Name</th>
                        <th className="p-3">Admin ID / Access ID</th>
                        <th className="p-3">Email Address</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs divide-y divide-slate-950">
                      {(() => {
                        const filteredAdmins = adminProfiles.filter(ap => {
                          if (!searchQuery) return true;
                          const q = searchQuery.toLowerCase().trim();
                          const nameMatch = ap.fullName.toLowerCase().includes(q);
                          const adminIdMatch = (ap.adminId || ap.usn || '').toLowerCase().includes(q);
                          return nameMatch || adminIdMatch;
                        });

                        if (filteredAdmins.length > 0) {
                          return filteredAdmins.map(ap => (
                            <tr key={ap.id} className="hover:bg-slate-900/20 transition-colors">
                              <td className="p-3 font-semibold text-slate-200">
                                {ap.fullName} {ap.id === adminProfile.id && <span className="text-[10px] font-mono text-cyan-400 bg-cyan-400/10 px-1.5 py-0.2 rounded ml-1.5">YOU</span>}
                              </td>
                              <td className="p-3 font-mono text-cyan-400 font-bold">{ap.adminId || ap.usn || 'N/A'}</td>
                              <td className="p-3 text-slate-400 font-mono text-[11px]">{ap.email || 'N/A'}</td>
                            </tr>
                          ));
                        } else {
                          return (
                            <tr>
                              <td colSpan={3} className="p-8 text-center text-slate-500">
                                <div className="text-sm font-extrabold text-slate-300 font-sans mb-1">
                                  No matching results found.
                                </div>
                                <div className="text-xs text-slate-400 font-sans">
                                  Adjust your search query to find registered administrators.
                                </div>
                              </td>
                            </tr>
                          );
                        }
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 9. ABSENCE REGULARIZATION REVIEW TAB */}
          {activeTab === 'absences' && (
            <div className="space-y-6 text-left animate-fade-in font-sans">
              
              <div>
                <h2 className="font-display text-2xl font-bold text-white flex items-center bg-transparent">
                  <AlertCircle className="h-5.5 w-5.5 text-cyan-400 mr-2" />
                  Absence Regularization Manager
                </h2>
                <p className="text-slate-400 text-xs">
                  Review claims submitted by absent or excused students, view attached supporting documents, and approve/reject claims.
                </p>
              </div>

              {/* Filtering HUD */}
              <div className="glass-panel p-4 rounded-2xl border border-slate-900 bg-slate-950/40 flex flex-col md:flex-row gap-4 items-center justify-between">
                
                {/* Search */}
                <div className="relative w-full md:w-96">
                  <input
                    type="text"
                    value={absenceSearchQuery}
                    onChange={(e) => setAbsenceSearchQuery(e.target.value)}
                    placeholder="Search by Student Name, USN, or Session..."
                    className="w-full bg-slate-950 border border-slate-900 text-slate-100 text-xs rounded-xl py-2 px-3 outline-none focus:border-cyan-500 font-sans font-medium"
                  />
                </div>

                {/* Status Switcher filters */}
                <div className="flex items-center space-x-2 w-full md:w-auto overflow-x-auto">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider shrink-0 mr-1">Status:</span>
                  {(['All', 'Pending', 'Approved', 'Rejected'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setAbsenceStatusFilter(status)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition cursor-pointer select-none border-none ${
                        absenceStatusFilter === status
                          ? 'bg-cyan-500 text-slate-950 font-black shadow-[0_0_10px_rgba(6,182,212,0.15)]'
                          : 'bg-slate-950/60 text-slate-400 hover:text-white border border-slate-900'
                      }`}
                    >
                      {status} ({
                        status === 'All' 
                          ? absenceRequests.length 
                          : absenceRequests.filter(r => r.status === status).length
                      })
                    </button>
                  ))}
                </div>
              </div>

              {/* Request List Grid */}
              {filteredAbsences.length === 0 ? (
                <div className="glass-panel p-12 rounded-3xl border border-slate-900 bg-slate-950/40 text-center flex flex-col items-center justify-center space-y-3">
                  <AlertCircle className="h-10 w-10 text-slate-500" />
                  <div className="space-y-1">
                    <h3 className="font-bold text-slate-300 text-sm">No Absence Claims Found</h3>
                    <p className="text-slate-500 text-xs">No claims match your selected status filters or search keywords.</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {filteredAbsences.map((req) => (
                    <div key={req.requestId} className="glass-panel p-5 rounded-2xl border border-slate-900 bg-slate-950/45 flex flex-col space-y-4">
                      
                      {/* Request Header */}
                      <div className="flex items-start justify-between border-b border-slate-900 pb-3">
                        <div className="space-y-0.5 max-w-[75%]">
                          <h3 className="font-display font-extrabold text-sm text-slate-100">{req.studentName}</h3>
                          <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-slate-400 font-mono font-bold uppercase">
                            <span>USN: {req.studentUsn}</span>
                            <span>•</span>
                            <span className="text-cyan-400 truncate">{req.sessionName}</span>
                          </div>
                          <span className="text-[9px] font-mono text-slate-500 uppercase block">
                            Submitted At: {new Date(req.createdAt).toLocaleString()}
                          </span>
                        </div>

                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[9px] font-mono uppercase font-black ${
                          req.status === 'Approved'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : req.status === 'Rejected'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {req.status}
                        </span>
                      </div>

                      {/* Request Reason: Read-only multiline textarea, proper spacing, never truncated, scrollable if long */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Provide the reason:</label>
                        <textarea
                          readOnly
                          value={req.reason}
                          className="w-full h-28 bg-slate-950/80 border border-slate-900 text-slate-200 text-xs rounded-xl p-3 outline-none resize-none overflow-y-auto leading-relaxed font-sans"
                        />
                      </div>

                      {/* Attached Proof File */}
                      <div className="flex items-center justify-between bg-slate-950/45 p-2.5 rounded-xl border border-slate-900/60 text-[10px]">
                        <span className="text-slate-400 font-mono">Proof File URL/Attachment:</span>
                        {req.attachmentUrl ? (
                          <button
                            type="button"
                            onClick={() => handleFilePreview(req.attachmentUrl!, req.attachmentUrl!.split('/').pop() || 'Proof Document')}
                            className="inline-flex items-center space-x-1 px-3 py-1 bg-cyan-500/10 hover:bg-cyan-500 hover:text-slate-950 text-cyan-400 font-bold uppercase rounded-lg transition border border-cyan-500/15 cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Preview proof</span>
                          </button>
                        ) : (
                          <span className="text-slate-550 font-mono italic">No supporting document provided</span>
                        )}
                      </div>

                      {/* Audit Review Details / Action box */}
                      {req.status === 'Pending' ? (
                        <div className="border-t border-slate-900 pt-4 space-y-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block" htmlFor={`remarks-${req.requestId}`}>
                              Decision Remarks (Visible to Student):
                            </label>
                            <input
                              id={`remarks-${req.requestId}`}
                              type="text"
                              value={adminRemarksMap[req.requestId] || ''}
                              onChange={(e) => setAdminRemarksMap({
                                ...adminRemarksMap,
                                [req.requestId]: e.target.value
                              })}
                              placeholder="e.g., Medical certificate verified. Excusal approved."
                              className="w-full bg-slate-950 border border-slate-900 text-slate-100 text-xs rounded-lg py-2 px-3 outline-none focus:border-cyan-500 font-sans"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3 pt-1">
                            <button
                              type="button"
                              onClick={() => handleAbsenceReview(req.requestId, 'Approved', adminRemarksMap[req.requestId] || '', req)}
                              className="py-2.5 bg-emerald-500 hover:bg-emerald-600 font-bold uppercase text-[10px] text-slate-950 tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center space-x-1.5 border-none shadow-[0_0_10px_rgba(16,185,129,0.15)]"
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>Approve Excusal</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleAbsenceReview(req.requestId, 'Rejected', adminRemarksMap[req.requestId] || '', req)}
                              className="py-2.5 bg-rose-500 hover:bg-rose-600 font-bold uppercase text-[10px] text-white tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center space-x-1.5 border-none shadow-[0_0_10px_rgba(239,68,68,0.15)]"
                            >
                              <X className="h-3.5 w-3.5" />
                              <span>Reject Claim</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3 pt-3">
                          <div className="bg-slate-950/20 p-3 rounded-xl border border-slate-900 space-y-1.5 font-mono text-[10px]">
                            {req.status === 'Approved' ? (
                              <>
                                <div className="flex items-center justify-between text-slate-400">
                                  <span>Approved By:</span>
                                  <span className="font-bold text-slate-200">{req.approvedByName || 'System Creator'}</span>
                                </div>
                                {req.approvedAt && (
                                  <div className="flex items-center justify-between text-slate-500">
                                    <span>Approved At:</span>
                                    <span>{new Date(req.approvedAt).toLocaleString()}</span>
                                  </div>
                                )}
                                {req.adminRemarks && (
                                  <div className="pt-2 border-t border-slate-900/40 text-[11px] text-slate-300 italic font-sans leading-relaxed">
                                    " {req.adminRemarks} "
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                <div className="flex items-center justify-between text-slate-400">
                                  <span>Rejected By:</span>
                                  <span className="font-bold text-slate-200">{req.approvedByName || 'System Creator'}</span>
                                </div>
                                {req.approvedAt && (
                                  <div className="flex items-center justify-between text-slate-500">
                                    <span>Rejected At:</span>
                                    <span>{new Date(req.approvedAt).toLocaleString()}</span>
                                  </div>
                                )}
                                {req.adminRemarks && (
                                  <div className="pt-2 border-t border-slate-900/40 text-[11px] text-rose-350 italic font-sans leading-relaxed">
                                    <span className="font-semibold block font-mono text-[9px] uppercase tracking-wider text-rose-450 not-italic mb-1">Rejection Remarks:</span>
                                    " {req.adminRemarks} "
                                  </div>
                                )}
                              </>
                            )}

                            {/* Timeline audit indicator */}
                            {(req.previousStatus || req.statusChangedAt) && (
                              <div className="pt-2 mt-2 border-t border-slate-900/40 text-[9px] text-slate-500 space-y-0.5">
                                <div className="flex justify-between">
                                  <span>Audit Track:</span>
                                  <span className="text-slate-400 uppercase font-bold text-[8px]">Regularized State</span>
                                </div>
                                {req.previousStatus && (
                                  <div className="flex justify-between">
                                    <span>Previous Status:</span>
                                    <span className="text-slate-450">{req.previousStatus}</span>
                                  </div>
                                )}
                                {req.statusChangedAt && (
                                  <div className="flex justify-between">
                                    <span>Last Status Update:</span>
                                    <span>{new Date(req.statusChangedAt).toLocaleString()}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Move To Pending Button */}
                          <button
                            type="button"
                            disabled={!!savingRequests[req.requestId]}
                            onClick={() => handleUndoAbsenceReview(req)}
                            className="w-full py-2 bg-slate-900 hover:bg-slate-850 disabled:opacity-50 text-slate-350 hover:text-slate-200 font-bold uppercase text-[9px] tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center space-x-1.5 border border-slate-800"
                          >
                            <RefreshCw className={`h-3 w-3 ${savingRequests[req.requestId] ? 'animate-spin' : ''}`} />
                            <span>{savingRequests[req.requestId] ? 'Reverting...' : 'Move To Pending'}</span>
                          </button>
                        </div>
                      )}

                      {/* Timeline History Section */}
                      <div className="mt-3 bg-slate-950/40 p-3.5 rounded-2xl border border-slate-900/60 space-y-3">
                        <span className="text-[9px] font-mono text-slate-450 uppercase tracking-widest font-black block">
                          Absence Claim Timeline
                        </span>
                        <div className="relative pl-4 border-l border-slate-900 space-y-3.5">
                          {/* Point 1: Submission */}
                          <div className="relative text-[10px] font-mono">
                            <span className="absolute -left-[20.5px] top-1 h-2 w-2 rounded-full bg-cyan-500 ring-4 ring-cyan-950/50"></span>
                            <div className="flex items-center justify-between text-slate-300">
                              <span className="font-bold">Claim Submitted</span>
                              <span className="text-slate-550 font-normal">{new Date(req.createdAt).toLocaleString()}</span>
                            </div>
                            <div className="text-slate-505 text-[9px] mt-0.5">Student requested excusal for: "{req.sessionName}"</div>
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
                                <span className="text-slate-555 font-normal">
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
                                      ? 'bg-emerald-950/10 text-emerald-350 border-emerald-950/20 font-sans' 
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
                                <span className="font-bold uppercase tracking-wider">Awaiting Review</span>
                                <span className="text-slate-555 italic text-[9px]">Review Pending</span>
                              </div>
                              <div className="text-slate-500 text-[9px] mt-0.5">Awaiting Administrator review and verification of proof.</div>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              )}

            </div>
          )}

        </div>

      </div>

      {/* ============================================================================
          DYNAMIC FLOATING MODALS
          ============================================================================ */}

      {/* CODE REGENERATION CHOICE MODAL */}
      {showRegenModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 font-sans text-slate-100">
          <div className="glass-panel max-w-sm w-full p-6 rounded-2xl relative text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Shield className="h-8 w-8" />
            </div>

            <div className="space-y-1.5">
              <h3 className="font-display font-bold text-lg text-white">Select Regenerated Code</h3>
              <p className="text-xs text-slate-400">
                Choose <strong>ONE</strong> of the new system-generated authentication codes. Confirming will make all other choices and your old code invalid.
              </p>
            </div>

            <div className="space-y-2.5">
              {regenOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setSelectedRegenOption(opt)}
                  className={`w-full p-3 rounded-xl border flex items-center justify-between font-mono transition-all duration-200 text-left ${
                    selectedRegenOption === opt
                      ? 'border-purple-500 bg-purple-500/10 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.15)] font-bold scale-[1.01]'
                      : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <span className="text-xs tracking-wider font-semibold">{opt}</span>
                  <span className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                    selectedRegenOption === opt ? 'border-purple-400 bg-purple-600' : 'border-slate-700 bg-slate-900'
                  }`}>
                    {selectedRegenOption === opt && <Check className="h-2.5 w-2.5 text-slate-950 stroke-[4px]" />}
                  </span>
                </button>
              ))}
            </div>

            <div className="pt-2 flex gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setShowRegenModal(false)}
                className="w-1/3 py-2.5 rounded-xl bg-slate-900 border border-slate-850 text-slate-400 hover:text-white transition-all font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleRegenerateCode(selectedRegenOption)}
                className="w-2/3 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_15px_rgba(139,92,246,0.20)] flex items-center justify-center space-x-1.5 transition-all font-bold cursor-pointer"
              >
                <span>Confirm Choice</span>
                <Check className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. SCHEDULE / EDIT SESSION MODAL */}
      {showSessionModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 font-sans text-slate-100">
          <form 
            onSubmit={handleSessionSubmit} 
            className="glass-panel max-w-lg w-full flex flex-col max-h-[90vh] rounded-2xl relative overflow-hidden"
          >
            {/* Modal Header */}
            <div className="p-6 pb-4 border-b border-slate-900/40 flex items-center justify-between">
              <h3 className="font-display font-bold text-lg text-white">
                {editingSession ? `Edit Session "${editingSession.name}"` : 'Schedule Session'}
              </h3>
              <button 
                type="button"
                onClick={() => setShowSessionModal(false)}
                className="text-slate-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
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

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase block mb-1.5">Feedback Requirement</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSessionForm({...sessionForm, feedbackRequirement: 'mandatory'})}
                    className={`p-2.5 rounded-xl text-xs font-bold text-center border cursor-pointer transition-all ${
                      sessionForm.feedbackRequirement === 'mandatory'
                        ? 'bg-purple-500/10 border-purple-500 text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.15)]'
                        : 'bg-slate-950/40 border-slate-900 text-slate-400 hover:border-slate-800'
                    }`}
                  >
                    Mandatory
                  </button>
                  <button
                    type="button"
                    onClick={() => setSessionForm({...sessionForm, feedbackRequirement: 'optional'})}
                    className={`p-2.5 rounded-xl text-xs font-bold text-center border cursor-pointer transition-all ${
                      sessionForm.feedbackRequirement === 'optional'
                        ? 'bg-purple-500/10 border-purple-500 text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.15)]'
                        : 'bg-slate-950/40 border-slate-900 text-slate-400 hover:border-slate-800'
                    }`}
                  >
                    Optional
                  </button>
                </div>
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
                    disabled={isTimelineLocked}
                    className="glass-input w-full p-2.5 rounded-xl text-xs mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    disabled={isTimelineLocked}
                    className="glass-input w-full p-2.5 rounded-xl text-xs mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
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
                          <span className="text-[10px] text-slate-555 w-18 shrink-0">Volunteer {idx + 1}:</span>
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

              {/* Authorized Admins Selector */}
              <div className="space-y-2 border-t border-slate-900/60 pt-3">
                <label className="text-xs font-bold text-slate-400 uppercase block">Authorized Admins / Faculty Permissions</label>
                <p className="text-[10px] text-slate-500 leading-normal">
                  Select other Admins or Faculty who are allowed to view, mark, and verify student attendance for this session.
                </p>
                {(() => {
                  const currentOwnerId = editingSession ? (editingSession.sessionOwnerId || adminProfile.id) : adminProfile.id;
                  const eligibleAdmins = adminProfiles.filter(ap => ap.id !== currentOwnerId);
                  if (eligibleAdmins.length > 0) {
                    return (
                      <div className="grid grid-cols-2 gap-2 max-h-28 overflow-y-auto bg-slate-900/30 p-2.5 rounded-xl border border-slate-900">
                        {eligibleAdmins.map(ap => {
                          const isChecked = sessionForm.authorizedAdminIds?.includes(ap.id);
                          return (
                            <label key={ap.id} className="flex items-center space-x-2 text-xs cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  const updated = checked
                                    ? [...(sessionForm.authorizedAdminIds || []), ap.id]
                                    : (sessionForm.authorizedAdminIds || []).filter(id => id !== ap.id);
                                  setSessionForm({ ...sessionForm, authorizedAdminIds: updated });
                                }}
                                className="rounded text-cyan-500 focus:ring-cyan-500 bg-slate-950 border-slate-800"
                              />
                              <span className="text-slate-300 truncate" title={`${ap.fullName} (${ap.adminId || 'No ID'})`}>
                                {ap.fullName} <span className="text-slate-500 text-[10px]">({ap.adminId || 'No ID'})</span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    );
                  }
                  return <p className="text-[10px] text-slate-500 italic">No other active Admin/Faculty users found in the system.</p>;
                })()}
              </div>
            </div>

            {/* Modal Footer */}
            {showDuplicateWarning && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-3 text-xs flex flex-col space-y-2 animate-fade-in mx-6 mt-3 text-left">
                <div className="flex items-center space-x-2 text-amber-400">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-bold">Duplicate Name Warning</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  A session with the name "{sessionForm.name}" already exists. Do you want to authorize duplicate session name publishing?
                </p>
                <label className="flex items-center space-x-2 cursor-pointer select-none text-[11px] text-amber-300 font-bold">
                  <input
                    type="checkbox"
                    checked={approvedDuplicateName === sessionForm.name.trim().toLowerCase()}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setApprovedDuplicateName(sessionForm.name.trim().toLowerCase());
                      } else {
                        setApprovedDuplicateName('');
                      }
                    }}
                    className="rounded text-amber-500 focus:ring-amber-500 bg-slate-950 border-slate-800"
                  />
                  <span>Bypass name restrictions</span>
                </label>
              </div>
            )}

            <div className="p-6 pt-4 border-t border-slate-900/40 flex justify-end space-x-2 text-xs font-bold bg-slate-950/20">
              <button
                type="button"
                onClick={() => setShowSessionModal(false)}
                disabled={isCreatingSession}
                className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreatingSession}
                className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {isCreatingSession ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Creating session...</span>
                  </>
                ) : (
                  <span>Confirm & Write</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. MANUAL CHECK-IN ENTRY MODAL */}
      {showManualCheckInModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 font-sans text-slate-100">
          <div className="glass-panel max-w-md w-full p-6 rounded-2xl relative">
            <button 
              onClick={() => {
                resetManualAttendanceForm();
                setShowManualCheckInModal(false);
              }}
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
                <label className="text-xs font-bold text-slate-400 uppercase">Student USN ID</label>
                <input
                  type="text"
                  required
                  placeholder="Enter USN"
                  value={manualCheckIn.usn}
                  onChange={(e) => setManualCheckIn({...manualCheckIn, usn: e.target.value})}
                  className="glass-input w-full p-2.5 rounded-xl text-xs mt-1"
                />
                
                {manualCheckIn.isSearching && (
                  <p className="text-[10px] text-cyan-400 animate-pulse mt-1 flex items-center">
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    Searching profiles table...
                  </p>
                )}
                
                {manualCheckIn.isValidStudent === true && (
                  <p className="text-[10px] text-emerald-400 font-bold mt-1 flex items-center">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Verified student profile found
                  </p>
                )}

                {manualCheckIn.isValidStudent === false && (
                  <p className="text-[10px] text-rose-400 font-bold mt-1 flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {manualCheckIn.searchError || 'Student not found'}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Student Full Name</label>
                <input
                  type="text"
                  readOnly
                  required
                  placeholder="Auto-filled after USN lookup"
                  value={manualCheckIn.fullName}
                  className="glass-input w-full p-2.5 rounded-xl text-xs mt-1 bg-slate-900/50 border-slate-900 text-slate-400 cursor-not-allowed select-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Student Email (Optional)</label>
                <input
                  type="email"
                  readOnly
                  placeholder="Auto-filled after USN lookup"
                  value={manualCheckIn.email}
                  className="glass-input w-full p-2.5 rounded-xl text-xs mt-1 bg-slate-900/50 border-slate-900 text-slate-400 cursor-not-allowed select-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Student Department</label>
                <input
                  type="text"
                  readOnly
                  required
                  placeholder="Auto-filled after USN lookup"
                  value={manualCheckIn.department}
                  className="glass-input w-full p-2.5 rounded-xl text-xs mt-1 bg-slate-900/50 border-slate-950 text-slate-400 cursor-not-allowed select-none"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    resetManualAttendanceForm();
                    setShowManualCheckInModal(false);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={manualCheckIn.isValidStudent !== true || manualCheckIn.isSearching}
                  className={`px-5 py-2.5 rounded-xl text-slate-950 font-extrabold shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all cursor-pointer ${
                    manualCheckIn.isValidStudent === true && !manualCheckIn.isSearching
                      ? 'bg-cyan-500 hover:bg-cyan-400 opacity-100'
                      : 'bg-slate-800 text-slate-500 border border-slate-900 cursor-not-allowed opacity-50 shadow-none'
                  }`}
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
                disabled={deleteConfirm.isDeleting}
                onClick={() => setDeleteConfirm(null)}
                className="py-2.5 rounded-xl border border-slate-800 hover:bg-slate-900 text-xs font-semibold text-slate-400 hover:text-white transition-all cursor-pointer font-sans disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                id="btn-delete-confirm"
                type="button"
                disabled={deleteConfirm.isDeleting}
                onClick={async () => {
                  setDeleteConfirm(prev => prev ? { ...prev, isDeleting: true } : null);
                  const onConfirm = deleteConfirm.onConfirm;
                  try {
                    await onConfirm();
                  } finally {
                    setDeleteConfirm(null);
                  }
                }}
                className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(244,63,94,0.2)] cursor-pointer font-sans disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1.5"
              >
                {deleteConfirm.isDeleting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete</span>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* CUSTOM ASSIGNMENT DELETE / ARCHIVE DIALOG */}
      {assignmentDeleteState && assignmentDeleteState.isOpen && (
        <div id="assignment-delete-confirm-modal" className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 font-sans text-slate-100 animate-fade-in animate-duration-200">
          <div className="glass-panel max-w-md w-full p-6 md:p-8 rounded-2xl relative flex flex-col bg-slate-950 border border-slate-900 space-y-4 text-left">
            
            <div className="flex items-center space-x-3.5 border-b border-slate-900 pb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center shadow-[0_0_15px_rgba(244,63,94,0.15)]">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-white text-base">Delete Assignment</h3>
                <p className="text-[10.5px] text-slate-400 font-semibold truncate max-w-[280px]">
                  {assignmentDeleteState.assignmentTitle}
                </p>
              </div>
            </div>

            {!assignmentDeleteState.hasSubmissions ? (
              // Case 1: No submissions
              <div className="space-y-4">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Are you sure you want to permanently delete this assignment? This action cannot be undone.
                </p>
                <div className="grid grid-cols-2 gap-3.5 w-full pt-1">
                  <button
                    type="button"
                    onClick={() => setAssignmentDeleteState(null)}
                    className="py-2.5 rounded-xl border border-slate-800 hover:bg-slate-900 text-xs font-semibold text-slate-400 hover:text-white transition-all cursor-pointer font-sans"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const id = assignmentDeleteState.assignmentId;
                      setAssignmentDeleteState(null);
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
                    }}
                    className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(244,63,94,0.2)] cursor-pointer font-sans"
                  >
                    Delete Permanently
                  </button>
                </div>
              </div>
            ) : (
              // Case 2: Submissions exist
              <div className="space-y-4 text-xs text-slate-300">
                {!assignmentDeleteState.showDeleteVerification ? (
                  <>
                    <p className="leading-relaxed text-slate-400">
                      This assignment contains <span className="text-cyan-400 font-bold">{assignmentDeleteState.submissionsCount}</span> student submissions.
                      To preserve student academic records, we recommend <span className="text-emerald-400 font-bold">Archiving</span>.
                      Deleting will permanently destroy all records, including grading files and submitted homework.
                    </p>
                    <div className="flex flex-col space-y-2.5 pt-2">
                      <button
                        type="button"
                        onClick={async () => {
                          const id = assignmentDeleteState.assignmentId;
                          setAssignmentDeleteState(null);
                          try {
                            const res = await assignmentService.archiveAssignment(id, adminProfile.id, adminProfile.fullName);
                            if (res) {
                              showToast('Assignment archived successfully.', 'success');
                              await loadAdminMetrics();
                            } else {
                              showToast('Unable to archive assignment. Please try again.', 'error');
                            }
                          } catch (err: any) {
                            showToast(err?.message || 'Unable to archive assignment. Please try again.', 'error');
                          }
                        }}
                        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-extrabold transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] cursor-pointer text-center font-sans"
                      >
                        🗄️ Archive Assignment (Recommended)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAssignmentDeleteState({
                            ...assignmentDeleteState,
                            showDeleteVerification: true
                          });
                        }}
                        className="w-full py-2.5 rounded-xl border border-rose-500/30 hover:bg-rose-500/10 text-rose-400 text-xs font-semibold transition-all cursor-pointer text-center font-sans"
                      >
                        🗑️ Delete Permanently anyway
                      </button>
                      <button
                        type="button"
                        onClick={() => setAssignmentDeleteState(null)}
                        className="w-full py-2.5 rounded-xl border border-slate-800 hover:bg-slate-900 text-slate-500 hover:text-white transition-all cursor-pointer text-center font-sans"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  // Secondary Verification
                  <div className="space-y-4">
                    <p className="text-rose-400 font-bold">
                      CRITICAL ACTION WARNING:
                    </p>
                    <p className="leading-relaxed text-slate-400">
                      You are about to permanently delete this assignment and ALL student submissions. This cannot be undone.
                      Please type <span className="font-mono text-white bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">DELETE</span> below to confirm.
                    </p>
                    <input
                      type="text"
                      placeholder="Type DELETE"
                      value={assignmentDeleteState.verificationText}
                      onChange={(e) => {
                        setAssignmentDeleteState({
                          ...assignmentDeleteState,
                          verificationText: e.target.value
                        });
                      }}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-rose-500 font-mono text-center text-xs tracking-wider"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setAssignmentDeleteState({
                            ...assignmentDeleteState,
                            showDeleteVerification: false,
                            verificationText: ''
                          });
                        }}
                        className="py-2.5 rounded-xl border border-slate-800 hover:bg-slate-900 text-xs font-semibold text-slate-400 hover:text-white transition-all cursor-pointer font-sans"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        disabled={assignmentDeleteState.verificationText !== 'DELETE'}
                        onClick={async () => {
                          const id = assignmentDeleteState.assignmentId;
                          setAssignmentDeleteState(null);
                          try {
                            const res = await assignmentService.deleteAssignment(id);
                            if (res) {
                              showToast('Assignment deleted permanently.', 'success');
                              loadAdminMetrics();
                            } else {
                              showToast('Unable to delete assignment. Please try again.', 'error');
                            }
                          } catch (err) {
                            showToast('Unable to delete assignment. Please try again.', 'error');
                          }
                        }}
                        className={`py-2.5 rounded-xl text-xs font-bold transition-all font-sans cursor-pointer ${
                          assignmentDeleteState.verificationText === 'DELETE'
                            ? 'bg-rose-600 text-white hover:bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                            : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
                        }`}
                      >
                        Confirm Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

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
                className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition flex items-center gap-1.5"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Open Direct View</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Extend / Reopen Feedback Deadline Modal */}
      {showExtendFeedbackModal && extendFeedbackSession && (() => {
        const windowStatus = getFeedbackWindowStatus(extendFeedbackSession);
        const now = new Date();
        const currentDeadline = windowStatus.deadline;
        const isExpired = windowStatus.isExpired || now > currentDeadline;
        const baseTime = isExpired ? now : currentDeadline;

        let calculatedTarget: Date;
        if (extendFeedbackOption === 'plus_15') {
          calculatedTarget = new Date(baseTime.getTime() + 15 * 60 * 1000);
        } else if (extendFeedbackOption === 'plus_30') {
          calculatedTarget = new Date(baseTime.getTime() + 30 * 60 * 1000);
        } else if (extendFeedbackOption === 'plus_60') {
          calculatedTarget = new Date(baseTime.getTime() + 60 * 60 * 1000);
        } else {
          calculatedTarget = new Date(extendFeedbackCustomTime);
        }

        const isTargetValid = !isNaN(calculatedTarget.getTime());

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="glass-panel w-full max-w-md p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-5 shadow-2xl relative animate-in fade-in zoom-in duration-200">
              {/* Header */}
              <div className="flex justify-between items-start border-b border-slate-900 pb-3">
                <div>
                  <h3 className="font-display font-extrabold text-base text-white flex items-center space-x-2">
                    <Clock className="h-5 w-5 text-cyan-400" />
                    <span>{isExpired ? 'Reopen Feedback Submission' : 'Extend Feedback Deadline'}</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">{extendFeedbackSession.name} ({extendFeedbackSession.date})</p>
                </div>
                <button
                  onClick={() => {
                    setShowExtendFeedbackModal(false);
                    setExtendFeedbackSession(null);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Current Deadline Display */}
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 text-xs space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Current Deadline</span>
                <div className="font-mono font-bold text-slate-200 flex items-center justify-between">
                  <span>{currentDeadline.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at {currentDeadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {isExpired ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 font-sans border border-rose-500/20">Closed</span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-sans border border-emerald-500/20">Active</span>
                  )}
                </div>
              </div>

              {/* Extension Options */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase block">
                  {isExpired ? 'Reopen Duration' : 'Extend By'}
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setExtendFeedbackOption('plus_15')}
                    className={`p-3 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      extendFeedbackOption === 'plus_15'
                        ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    +15 Minutes
                  </button>

                  <button
                    type="button"
                    onClick={() => setExtendFeedbackOption('plus_30')}
                    className={`p-3 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      extendFeedbackOption === 'plus_30'
                        ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    +30 Minutes
                  </button>

                  <button
                    type="button"
                    onClick={() => setExtendFeedbackOption('plus_60')}
                    className={`p-3 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      extendFeedbackOption === 'plus_60'
                        ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    +1 Hour
                  </button>

                  <button
                    type="button"
                    onClick={() => setExtendFeedbackOption('custom')}
                    className={`p-3 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      extendFeedbackOption === 'custom'
                        ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    Custom Date & Time
                  </button>
                </div>

                {extendFeedbackOption === 'custom' && (
                  <div className="pt-2">
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Select Custom Closing Date & Time</label>
                    <input
                      type="datetime-local"
                      value={extendFeedbackCustomTime}
                      onChange={(e) => setExtendFeedbackCustomTime(e.target.value)}
                      className="glass-input w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-slate-800 text-white focus:border-cyan-500/60 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Calculated New Deadline Preview */}
              <div className="bg-cyan-950/20 p-3 rounded-xl border border-cyan-900/40 text-xs space-y-1">
                <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider block">New Feedback Deadline</span>
                <div className="font-mono font-black text-white text-sm">
                  {isTargetValid ? (
                    `${calculatedTarget.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at ${calculatedTarget.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  ) : (
                    <span className="text-rose-400 text-xs font-sans font-normal">Please enter a valid date and time</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-900">
                <button
                  type="button"
                  onClick={() => {
                    setShowExtendFeedbackModal(false);
                    setExtendFeedbackSession(null);
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSavingFeedbackExtension || !isTargetValid}
                  onClick={handleSaveFeedbackExtension}
                  className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1.5"
                >
                  {isSavingFeedbackExtension ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Confirm & Save</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <Footer />

    </div>
  );
}
