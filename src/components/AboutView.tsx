import React from 'react';
import { 
  Info, 
  Sparkles, 
  Cpu, 
  GitBranch, 
  CheckCircle2, 
  User, 
  Clock, 
  Bookmark, 
  ShieldCheck, 
  AlertCircle,
  QrCode, 
  BookOpen, 
  MessageSquare, 
  FileSpreadsheet, 
  Bell, 
  Sun, 
  Moon, 
  Terminal,
  Activity,
  ExternalLink,
  Github,
  Globe
} from 'lucide-react';

const GITHUB_URL = import.meta.env.VITE_GITHUB_URL;
const LIVE_APP_URL = import.meta.env.VITE_APP_URL;

export default function AboutView() {
  return (
    <div className="space-y-8 animation-fade-in text-left">
      {/* Header section */}
      <div>
        <h2 className="font-display text-2xl font-bold text-white flex items-center bg-transparent">
          <Info className="h-5.5 w-5.5 text-cyan-400 mr-2" />
          About Smart Attendance Hub
        </h2>
        <p className="text-slate-400 text-xs">
          Discover the background details, design objectives, features, and release history of our unified campus ecosystem.
        </p>
      </div>

      {/* Main Grid: Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Application Information */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 bg-slate-950/40 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-3.5">
              <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-white text-base">Smart Attendance Hub</h3>
                <p className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">Version 1.0</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              A secure, role-based attendance management system designed for educational institutions. Smart Attendance Hub streamlines session management, QR-based attendance, manual attendance, assignment management, feedback collection, absence regularization, reporting, and administrative workflows.
            </p>
          </div>
          <div className="pt-3 border-t border-slate-900/40 flex items-center justify-end text-[11px] text-slate-500">
            <span>Est. 2026</span>
          </div>
        </div>

        {/* Card 2: Developer Information */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 bg-slate-950/40 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-3.5">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-[0_0_15px_rgba(147,51,234,0.1)]">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-white text-base">Developed By</h3>
                <p className="text-[10px] font-mono text-purple-400 uppercase tracking-widest">Project Developed By</p>
              </div>
            </div>
            <div className="space-y-1 pt-1">
              <h4 className="text-sm font-bold text-slate-200">Rashmi M Chimmalagi</h4>
              <p className="text-xs text-slate-400">Computer Science & Engineering</p>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-sans pt-1">
              Designed and developed as a full-stack academic project to simplify attendance management for educational institutions.
            </p>
          </div>
        </div>
      </div>

      {/* Grid: Technology Stack & Key Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Technology Stack Card */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 bg-slate-950/40 space-y-4">
          <h3 className="font-display font-bold text-white text-sm uppercase tracking-wider border-b border-slate-900/50 pb-2 flex items-center">
            <Cpu className="h-4 w-4 text-cyan-400 mr-2" />
            Technology Stack
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/30 p-3.5 rounded-2xl border border-slate-900 space-y-2">
              <h4 className="text-xs font-black text-cyan-400 uppercase tracking-wider">Frontend</h4>
              <ul className="space-y-1.5 text-xs text-slate-300 font-medium">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-cyan-400 shrink-0" />
                  <span>React</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-cyan-400 shrink-0" />
                  <span>TypeScript</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-cyan-400 shrink-0" />
                  <span>Tailwind CSS</span>
                </li>
              </ul>
            </div>
            <div className="bg-slate-900/30 p-3.5 rounded-2xl border border-slate-900 space-y-2">
              <h4 className="text-xs font-black text-purple-400 uppercase tracking-wider">Backend & Db</h4>
              <ul className="space-y-1.5 text-xs text-slate-300 font-medium">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-purple-400 shrink-0" />
                  <span>Supabase</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-purple-400 shrink-0" />
                  <span>PostgreSQL</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-purple-400 shrink-0" />
                  <span>Vercel (Deployment)</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Key Features Card */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 bg-slate-950/40 space-y-4">
          <h3 className="font-display font-bold text-white text-sm uppercase tracking-wider border-b border-slate-900/50 pb-2 flex items-center">
            <Activity className="h-4 w-4 text-emerald-400 mr-2" />
            Key Features
          </h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-300 font-medium">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>Secure Auth</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>Role-Based RBAC</span>
            </div>
            <div className="flex items-center gap-2">
              <QrCode className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>QR Code Attendance</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>Manual Check-In</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>Session Management</span>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>Assignments System</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>Feedback Loop</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>Absence Regularization</span>
            </div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>CSV & Excel Reports</span>
            </div>
            <div className="flex items-center gap-2">
              <Bell className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>Notifications Engine</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>Dashboard Analytics</span>
            </div>
            <div className="flex items-center gap-2">
              <Sun className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>Dual Dark/Light Theme</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row: Version & Release Information */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-950/40 text-center space-y-1">
          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest block">Current Version</span>
          <span className="font-display font-black text-white text-lg block">Version 1.0</span>
        </div>
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-950/40 text-center space-y-1">
          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest block">Release Year</span>
          <span className="font-display font-black text-cyan-400 text-lg block">2026</span>
        </div>
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-950/40 text-center space-y-1">
          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest block">Deployment Status</span>
          <span className="font-display font-black text-emerald-400 text-lg block flex items-center justify-center gap-1.5">
            🟢 Production Ready
          </span>
        </div>
      </div>

      {/* Version History (Full-Width Card) */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 bg-slate-950/40 space-y-4">
        <h3 className="font-display font-bold text-white text-sm uppercase tracking-wider border-b border-slate-900/50 pb-2 flex items-center">
          <GitBranch className="h-4 w-4 text-purple-400 mr-2" />
          Version History & Changelog
        </h3>
        
        <div className="space-y-4 font-sans text-xs">
          <div className="flex flex-col md:flex-row md:items-start gap-3 md:gap-8 bg-slate-900/20 p-4 border border-slate-900 rounded-2xl">
            <div className="md:w-36 shrink-0">
              <span className="font-extrabold text-white text-sm block">Version 1.0</span>
              <span className="text-[10px] text-slate-500 font-mono block mt-0.5">Initial Production Release</span>
            </div>
            <div className="flex-1 space-y-2 text-slate-300">
              <p className="font-bold text-slate-200">
                Initial stable production release featuring secure authentication, student approval workflow, QR attendance, manual attendance, session management, assignment management, feedback collection, absence regularization, notifications, dashboard analytics, reporting, CSV & Excel exports, and support for both Dark and Light themes.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-semibold text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400"></span>
                  Authentication System
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400"></span>
                  Student Approval Flow
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400"></span>
                  Session Management
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400"></span>
                  QR Attendance
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400"></span>
                  Manual Attendance
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400"></span>
                  Assignment Management
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400"></span>
                  Feedback loop
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400"></span>
                  Notifications System
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400"></span>
                  Reports & Progress Cards
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400"></span>
                  CSV & Excel Export
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400"></span>
                  Dark Theme & Light Theme
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Project Links Section */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 bg-slate-950/40 space-y-4">
        <h3 className="font-display font-bold text-white text-sm uppercase tracking-wider border-b border-slate-900/50 pb-2 flex items-center">
          <ExternalLink className="h-4 w-4 text-cyan-400 mr-2" />
          Project Links
        </h3>
        <div className="flex flex-wrap gap-4">
          <a
            href={GITHUB_URL || "https://github.com/rashmi-mc/smart-attendance-hub"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-200 hover:text-white rounded-xl transition-all shadow-sm cursor-pointer select-none"
          >
            <Github className="h-4 w-4 text-purple-400" />
            <span>GitHub Repository</span>
          </a>
          <a
            href={LIVE_APP_URL || "https://smart-attendance-hub.vercel.app"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-200 hover:text-white rounded-xl transition-all shadow-sm cursor-pointer select-none"
          >
            <Globe className="h-4 w-4 text-cyan-400" />
            <span>Live Application</span>
          </a>
        </div>
      </div>

      {/* Bottom copyright display */}
      <div className="pt-4 border-t border-slate-900/60 text-center text-[11px] text-slate-500 font-medium space-y-1">
        <p>© 2026 Smart Attendance Hub</p>
        <p>Developed by Rashmi M Chimmalagi</p>
        <p>All Rights Reserved.</p>
      </div>
    </div>
  );
}
