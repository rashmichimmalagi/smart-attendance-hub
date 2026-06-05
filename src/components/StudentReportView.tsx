import React, { useMemo } from 'react';
import { 
  FileText, Calendar, CheckSquare, Award, Download, ArrowLeft, 
  User, Mail, Phone, BookOpen, Clock, AlertTriangle, CheckCircle2, 
  HelpCircle, Sparkles, TrendingUp
} from 'lucide-react';
import { Profile, Session, AttendanceRecord, Assignment, AssignmentSubmission, SessionSummary } from '../types';

interface StudentReportViewProps {
  profile: Profile;
  sessions: Session[];
  attendance: AttendanceRecord[];
  assignments: Assignment[];
  submissions: AssignmentSubmission[];
  summaries: SessionSummary[];
  onBack?: () => void;
  isAdminMode?: boolean;
}

export default function StudentReportView({
  profile,
  sessions,
  attendance,
  assignments,
  submissions,
  summaries,
  onBack,
  isAdminMode = false
}: StudentReportViewProps) {

  // --- STATS COMPUTATIONS (MOCK-FREE, DIRECT FROM PROPS) ---

  // 1. Attendance Metrics
  const totalSessions = sessions.length;
  
  const studentAttendance = useMemo(() => {
    return attendance.filter(a => a.studentId === profile.id);
  }, [attendance, profile.id]);

  const attendedSessions = studentAttendance.length;
  const missedSessions = Math.max(0, totalSessions - attendedSessions);
  const attendancePercentage = totalSessions > 0 
    ? Math.round((attendedSessions / totalSessions) * 100) 
    : 0;

  // 2. Assignment Metrics
  const totalAssignments = assignments.length;
  
  const studentSubmissions = useMemo(() => {
    return submissions.filter(s => s.studentId === profile.id);
  }, [submissions, profile.id]);

  const submittedCount = studentSubmissions.length;
  const pendingCount = Math.max(0, totalAssignments - submittedCount);

  // Late Submission calculation
  const lateCount = useMemo(() => {
    let late = 0;
    studentSubmissions.forEach(sub => {
      const parentAssign = assignments.find(a => a.id === sub.assignmentId);
      if (parentAssign) {
        const subDate = new Date(sub.submittedAt);
        const deadlineDate = new Date(parentAssign.deadline);
        if (subDate > deadlineDate) {
          late++;
        }
      }
    });
    return late;
  }, [studentSubmissions, assignments]);

  // 3. Feedback Metrics
  const studentSummaries = useMemo(() => {
    return summaries.filter(s => s.studentId === profile.id);
  }, [summaries, profile.id]);

  const feedbackCount = studentSummaries.length;
  const reflectionsCount = useMemo(() => {
    return studentSummaries.filter(s => s.reflections && s.reflections.trim().length > 0).length;
  }, [studentSummaries]);

  // --- HISTORY COMPILATION ---

  // Attendance History: every session with a present/absent status
  const attendanceHistory = useMemo(() => {
    return sessions.map(session => {
      const record = studentAttendance.find(a => a.sessionId === session.id);
      return {
        id: session.id,
        name: session.name,
        date: session.date,
        venue: session.venue,
        status: record ? 'Present' : 'Absent',
        checkInTime: record ? new Date(record.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A',
        method: record ? record.method : 'N/A'
      };
    });
  }, [sessions, studentAttendance]);

  // Assignment History
  const assignmentHistory = useMemo(() => {
    return assignments.map(assign => {
      const sub = studentSubmissions.find(s => s.assignmentId === assign.id);
      let status: 'Pending' | 'Submitted' | 'Submitted (Late)' = 'Pending';
      if (sub) {
        const subDate = new Date(sub.submittedAt);
        const deadlineDate = new Date(assign.deadline);
        status = subDate > deadlineDate ? 'Submitted (Late)' : 'Submitted';
      }
      return {
        id: assign.id,
        name: assign.title,
        deadline: new Date(assign.deadline).toLocaleDateString(),
        submittedAt: sub ? new Date(sub.submittedAt).toLocaleDateString() + ' ' + new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A',
        status
      };
    });
  }, [assignments, studentSubmissions]);


  // --- EXPORT FUNCTIONALITIES ---

  const escapeXML = (str: any) => {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const exportToCSV = () => {
    // 1. Clearly separated report sections with specific structure and headings
    const rows = [
      ['Section 1:'],
      ['STUDENT INFORMATION'],
      [],
      ['Student Name', profile.fullName],
      ['USN', profile.usn || 'Not Available'],
      ['Department', profile.department || 'Not Available'],
      ['Email', profile.email],
      ['Approval Status', profile.accountStatus || 'Pending'],
      [],
      ['Section 2:'],
      ['PERFORMANCE SUMMARY'],
      [],
      ['Metric', 'Value'],
      ['Attendance Percentage', `${attendancePercentage}%`],
      ['Assignments Completed', String(submittedCount)],
      ['Assignments Pending', String(pendingCount)],
      [],
      ['Section 3:'],
      ['ATTENDANCE HISTORY'],
      [],
      ['Session Name', 'Session Date', 'Venue', 'Status', 'Check-In Time', 'Method'],
      ...attendanceHistory.map(h => [
        h.name,
        h.date,
        h.venue === 'N/A' || !h.venue ? 'Not Available' : h.venue,
        h.status,
        h.checkInTime === 'N/A' ? 'Not Available' : h.checkInTime,
        h.method === 'qr' ? 'QR Code' : h.method === 'manual' ? 'Manual' : 'Not Available'
      ]),
      [],
      ['Section 4:'],
      ['ASSIGNMENT STATUS'],
      [],
      ['Assignment Title', 'Due Date', 'Submitted At', 'Completion Status'],
      ...assignmentHistory.map(a => [
        a.name,
        a.deadline,
        a.submittedAt === 'N/A' ? 'Not Submitted' : a.submittedAt,
        a.status
      ])
    ];

    const csvContent = rows.map(e => e.map(val => {
      const clean = (val === null || val === undefined) ? '' : String(val).replace(/"/g, '""');
      return clean.includes(',') || clean.includes('\n') || clean.includes('"') ? `"${clean}"` : clean;
    }).join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `student_report_${profile.usn || profile.fullName.replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportToExcel = () => {
    // Generate an XML Spreadsheet (Excel SpreadsheetML) with requested worksheets
    const xmlContent = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Author>Smart Attendance Hub</Author>
    <Created>${new Date().toISOString()}</Created>
  </DocumentProperties>
  <Worksheet ss:Name="Student Information">
    <Table>
      <Row ss:Height="22">
        <Cell><Data ss:Type="String">Field</Data></Cell>
        <Cell><Data ss:Type="String">Value</Data></Cell>
      </Row>
      <Row ss:Height="18">
        <Cell><Data ss:Type="String">Student Name</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXML(profile.fullName)}</Data></Cell>
      </Row>
      <Row ss:Height="18">
        <Cell><Data ss:Type="String">USN</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXML(profile.usn || 'Not Available')}</Data></Cell>
      </Row>
      <Row ss:Height="18">
        <Cell><Data ss:Type="String">Department</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXML(profile.department || 'Not Available')}</Data></Cell>
      </Row>
      <Row ss:Height="18">
        <Cell><Data ss:Type="String">Email</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXML(profile.email)}</Data></Cell>
      </Row>
      <Row ss:Height="18">
        <Cell><Data ss:Type="String">Approval Status</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXML(profile.accountStatus || 'Pending')}</Data></Cell>
      </Row>
    </Table>
  </Worksheet>
  <Worksheet ss:Name="Performance Summary">
    <Table>
      <Row ss:Height="22">
        <Cell><Data ss:Type="String">Metric</Data></Cell>
        <Cell><Data ss:Type="String">Value</Data></Cell>
      </Row>
      <Row ss:Height="20">
        <Cell><Data ss:Type="String">Attendance Percentage</Data></Cell>
        <Cell><Data ss:Type="String">${attendancePercentage}%</Data></Cell>
      </Row>
      <Row ss:Height="20">
        <Cell><Data ss:Type="String">Assignments Completed</Data></Cell>
        <Cell><Data ss:Type="Number">${submittedCount}</Data></Cell>
      </Row>
      <Row ss:Height="20">
        <Cell><Data ss:Type="String">Assignments Pending</Data></Cell>
        <Cell><Data ss:Type="Number">${pendingCount}</Data></Cell>
      </Row>
    </Table>
  </Worksheet>
  <Worksheet ss:Name="Attendance History">
    <Table>
      <Row ss:Height="22">
        <Cell><Data ss:Type="String">Session Name</Data></Cell>
        <Cell><Data ss:Type="String">Session Date</Data></Cell>
        <Cell><Data ss:Type="String">Venue</Data></Cell>
        <Cell><Data ss:Type="String">Status</Data></Cell>
        <Cell><Data ss:Type="String">Check-In Time</Data></Cell>
        <Cell><Data ss:Type="String">Method</Data></Cell>
      </Row>
      ${attendanceHistory.map(h => `
      <Row ss:Height="18">
        <Cell><Data ss:Type="String">${escapeXML(h.name)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXML(h.date)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXML(h.venue === 'N/A' || !h.venue ? 'Not Available' : h.venue)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXML(h.status)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXML(h.checkInTime === 'N/A' ? 'Not Available' : h.checkInTime)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXML(h.method === 'qr' ? 'QR Code' : h.method === 'manual' ? 'Manual' : 'Not Available')}</Data></Cell>
      </Row>`).join('')}
    </Table>
  </Worksheet>
  <Worksheet ss:Name="Assignment Status">
    <Table>
      <Row ss:Height="22">
        <Cell><Data ss:Type="String">Assignment Title</Data></Cell>
        <Cell><Data ss:Type="String">Due Date</Data></Cell>
        <Cell><Data ss:Type="String">Submitted At</Data></Cell>
        <Cell><Data ss:Type="String">Completion Status</Data></Cell>
      </Row>
      ${assignmentHistory.map(a => `
      <Row ss:Height="18">
        <Cell><Data ss:Type="String">${escapeXML(a.name)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXML(a.deadline)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXML(a.submittedAt === 'N/A' ? 'Not Submitted' : a.submittedAt)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXML(a.status)}</Data></Cell>
      </Row>`).join('')}
    </Table>
  </Worksheet>
</Workbook>`;

    const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `student_report_${profile.usn || profile.fullName.replace(/\s+/g, '_')}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div id="printable-report" className="space-y-6 print-card animate-fade-in animate-duration-300">
      
      {/* Header and Back Button controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-900/60 pb-5 print-hide">
        <div className="flex items-center space-x-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl hover:text-white text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
              title="Return to list"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div>
            <h2 className="font-display text-xl font-black text-white flex items-center">
              <FileText className="h-5 w-5 text-cyan-400 mr-2" />
              {isAdminMode ? 'Progressive Student Report Card' : 'My Progress & Metrics'}
            </h2>
            <p className="text-slate-400 text-[11px] font-sans">
              {isAdminMode ? `Consolidated individual records for student tracking` : 'Detailed log of your class attendance, task approvals, feedback summaries.'}
            </p>
          </div>
        </div>

        {/* Export Buttons bar */}
        <div className="flex items-center space-x-2">
          <button
            onClick={exportToCSV}
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-[11px] font-bold rounded-xl text-slate-300 hover:text-white transition-all flex items-center space-x-1 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>CSV</span>
          </button>
          <button
            onClick={exportToExcel}
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-[11px] font-bold rounded-xl text-slate-300 hover:text-white transition-all flex items-center space-x-1 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>EXCEL</span>
          </button>
        </div>
      </div>

      {/* ROW 1: Student Profile information Card layout */}
      <div className="grid md:grid-cols-12 gap-6 print-hide">
        
        {/* Profile Card details */}
        <div className="md:col-span-4 glass-panel p-5.5 rounded-2xl relative border-slate-800 flex flex-col justify-between print-card bg-slate-950/45">
          <div className="space-y-4">
            <span className="text-[9px] uppercase font-bold tracking-widest text-cyan-400 border-b border-slate-900 pb-1.5 block">
              Student Details
            </span>
            <div className="space-y-3.5 font-sans">
              <div className="flex items-start space-x-2.5">
                <User className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
                <div>
                  <div className="text-[9px] text-slate-500 uppercase tracking-wide">Full Name</div>
                  <div className="text-sm font-bold text-white print:text-slate-900">{profile.fullName}</div>
                </div>
              </div>
              <div className="flex items-start space-x-2.5">
                <BookOpen className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
                <div>
                  <div className="text-[9px] text-slate-500 uppercase tracking-wide">USN / ID Code</div>
                  <div className="text-xs font-mono font-bold text-cyan-400 print:text-cyan-800">{profile.usn || 'N/A'}</div>
                </div>
              </div>
              <div className="flex items-start space-x-2.5">
                <TrendingUp className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
                <div>
                  <div className="text-[9px] text-slate-500 uppercase tracking-wide">Department Unit</div>
                  <div className="text-xs font-semibold text-slate-200 print:text-slate-900">{profile.department || 'N/A'}</div>
                </div>
              </div>
              <div className="flex items-start space-x-2.5">
                <Mail className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
                <div>
                  <div className="text-[9px] text-slate-500 uppercase tracking-wide">Email Address</div>
                  <div className="text-xs text-slate-350 truncate max-w-[200px] print:text-slate-900">{profile.email}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3.5 border-t border-slate-900 flex items-center justify-between">
            <span className="text-[9px] text-slate-500 uppercase font-mono">Approval State</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase ${
              profile.accountStatus === 'Approved' 
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' 
                : profile.accountStatus === 'Rejected'
                ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
            }`}>
              {profile.accountStatus || 'Pending'}
            </span>
          </div>
        </div>

        {/* Bento Statistics dashboard */}
        <div className="md:col-span-8 grid sm:grid-cols-3 gap-4">
          
          {/* Attendance metric card */}
          <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border-slate-800 print-card bg-slate-950/30">
            <div className="flex justify-between items-center">
              <span className="text-[9px] uppercase font-bold tracking-widest text-cyan-400">Attendance Summary</span>
              <Calendar className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="my-3.5">
              <div className="font-display text-4xl font-extrabold text-white print:text-slate-900">
                {attendancePercentage}%
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Presence index in sessions</p>
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-500 border-t border-slate-900 pt-2 font-mono">
              <span>{attendedSessions} present</span>
              <span>{missedSessions} missed</span>
            </div>
          </div>

          {/* Assignments compliance card */}
          <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border-slate-800 print-card bg-slate-950/30">
            <div className="flex justify-between items-center">
              <span className="text-[9px] uppercase font-bold tracking-widest text-purple-400">Assignment Summary</span>
              <CheckSquare className="h-4 w-4 text-purple-400" />
            </div>
            <div className="my-3.5">
              <div className="font-display text-4xl font-extrabold text-white print:text-slate-900">
                {submittedCount} <span className="text-xs text-slate-500 font-mono">/ {totalAssignments}</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Complied tasks submission</p>
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-500 border-t border-slate-900 pt-2 font-mono">
              <span>{pendingCount} pending</span>
              <span className={lateCount > 0 ? 'text-rose-400' : ''}>{lateCount} late</span>
            </div>
          </div>

          {/* Reflections and engagement card */}
          <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border-slate-800 print-card bg-slate-950/30">
            <div className="flex justify-between items-center">
              <span className="text-[9px] uppercase font-bold tracking-widest text-emerald-400">Feedback Index</span>
              <Award className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="my-3.5">
              <div className="font-display text-4xl font-extrabold text-white print:text-slate-900">
                {feedbackCount}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Interactions & reviews saved</p>
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-500 border-t border-slate-900 pt-2 font-mono">
              <span>{reflectionsCount} active reflections</span>
            </div>
          </div>

        </div>

      </div>

      {/* ROW 2: Historical listings and tables */}
      <div className="grid md:grid-cols-2 gap-6 print-hide">
        
        {/* Attendance ledger lists */}
        <div className="glass-panel p-5 rounded-2xl border-slate-800 print-card bg-slate-950/20">
          <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-4">
            <h3 className="font-display font-extrabold text-xs text-white uppercase tracking-wider print:text-slate-900">
              Attendance History Ledger
            </h3>
            <span className="text-[9px] font-mono text-slate-500 max-w-xs">{sessions.length} total events</span>
          </div>

          {sessions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 border border-dashed border-slate-900 rounded-xl font-medium text-xs font-sans">
              No Attendance Records Found
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[300px] scrollbar-thin">
              <table className="w-full text-left border-collapse print-table">
                <thead>
                  <tr className="border-b border-slate-900 text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                    <th className="pb-2 font-bold">Session Name</th>
                    <th className="pb-2 font-bold">Date</th>
                    <th className="pb-2 font-bold text-center">Status</th>
                    <th className="pb-2 font-bold text-right print-hide">Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-950/40 text-xs font-sans">
                  {attendanceHistory.map(row => (
                    <tr key={row.id} className="hover:bg-slate-950/20">
                      <td className="py-2.5 font-semibold text-slate-200 truncate max-w-[140px] print:text-slate-900" title={row.name}>{row.name}</td>
                      <td className="py-2.5 text-slate-400 print:text-slate-900">{row.date}</td>
                      <td className="py-2.5 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                          row.status === 'Present' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-slate-500 font-mono text-[10px] print-hide">
                        {row.method === 'qr' ? 'QR Code' : row.method === 'manual' ? 'Manual' : 'Absent'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Assignment submissions history */}
        <div className="glass-panel p-5 rounded-2xl border-slate-800 print-card bg-slate-950/20">
          <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-4">
            <h3 className="font-display font-extrabold text-xs text-white uppercase tracking-wider print:text-slate-900">
              Assignment Submission Status
            </h3>
            <span className="text-[9px] font-mono text-slate-500 max-w-xs">{assignments.length} total tasks</span>
          </div>

          {assignments.length === 0 ? (
            <div className="p-8 text-center text-slate-500 border border-dashed border-slate-900 rounded-xl font-medium text-xs font-sans">
              No Assignment Records Found
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[300px] scrollbar-thin">
              <table className="w-full text-left border-collapse print-table">
                <thead>
                  <tr className="border-b border-slate-900 text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                    <th className="pb-2 font-bold">Assignment Title</th>
                    <th className="pb-2 font-bold">Deadline</th>
                    <th className="pb-2 font-bold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-950/40 text-xs font-sans">
                  {assignmentHistory.map(row => (
                    <tr key={row.id} className="hover:bg-slate-950/20">
                      <td className="py-2.5 font-semibold text-slate-200 truncate max-w-[160px] print:text-slate-900" title={row.name}>{row.name}</td>
                      <td className="py-2.5 text-slate-400 print:text-slate-900">{row.deadline}</td>
                      <td className="py-2.5 text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                          row.status === 'Submitted' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : row.status === 'Submitted (Late)'
                            ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
