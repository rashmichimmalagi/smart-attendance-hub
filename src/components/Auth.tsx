/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Hash, 
  Shield, 
  ShieldCheck,
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Building2, 
  ArrowRight,
  TrendingUp,
  Sparkles,
  RefreshCw,
  ChevronDown,
  Search,
  Sun,
  Moon,
  QrCode,
  Activity,
  MapPin,
  ClipboardCheck,
  BarChart3,
  MessageSquare,
  Check,
  ArrowLeft,
  Calendar,
  Layers,
  Clock,
  LayoutGrid
} from 'lucide-react';
import { authService } from '../supabase';
import { Profile, UserRole } from '../types';
import { DEPARTMENT_OPTIONS, normalizeDepartmentName } from '../utils/departmentUtils';

interface AuthProps {
  onAuthSuccess: (profile: Profile, role: UserRole) => void;
  isCloudConnected: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

type AuthMode = 'landing' | 'login' | 'signup' | 'forgot_password';

interface FormErrors {
  fullName?: string;
  usn?: string;
  adminId?: string;
  department?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export default function Auth({ onAuthSuccess, isCloudConnected, theme, toggleTheme }: AuthProps) {
  const [role, setRole] = useState<UserRole>('student');
  const [mode, setMode] = useState<AuthMode>('landing');
  
  // Field values
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [usn, setUsn] = useState('');
  const [adminId, setAdminId] = useState('');
  const [department, setDepartment] = useState('');
  
  // Custom searchable dropdown states
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [departmentSearch, setDepartmentSearch] = useState('');
  const [highlightedDeptIndex, setHighlightedDeptIndex] = useState(-1);

  // States
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const filteredDepartments = DEPARTMENT_OPTIONS.filter(dept =>
    dept.toLowerCase().includes(departmentSearch.toLowerCase())
  );

  const resetFields = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setUsn('');
    setAdminId('');
    setDepartment('');
    setDepartmentSearch('');
    setHighlightedDeptIndex(-1);
    setShowDepartmentDropdown(false);
    setError(null);
    setSuccess(null);
    setFormErrors({});
  };

  const handleModeChange = (newMode: AuthMode) => {
    resetFields();
    setMode(newMode);
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    let isValid = true;

    if (mode === 'signup') {
      if (!fullName.trim()) {
        errors.fullName = "Please enter your full name";
        isValid = false;
      }

      if (role === 'student') {
        if (!usn.trim()) {
          errors.usn = "Please enter your USN";
          isValid = false;
        }
        if (!department || department === "Select Department" || !DEPARTMENT_OPTIONS.includes(department)) {
          errors.department = "Please select a department";
          isValid = false;
        }
      } else {
        if (!adminId.trim()) {
          errors.adminId = "Please enter your Admin ID";
          isValid = false;
        }
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email.trim() || !emailRegex.test(email)) {
        errors.email = "Please enter a valid email address";
        isValid = false;
      }

      // Password validation
      if (!password) {
        errors.password = "Please enter a password";
        isValid = false;
      } else if (password.length < 8) {
        errors.password = "Password must contain at least 8 characters";
        isValid = false;
      }

      // Confirm Password validation
      if (confirmPassword !== password) {
        errors.confirmPassword = "Passwords do not match";
        isValid = false;
      }
    } else if (mode === 'login') {
      if (!email.trim()) {
        errors.email = "Please enter a valid email address";
        isValid = false;
      }
      if (!password) {
        errors.password = "Please enter a password";
        isValid = false;
      }
    } else if (mode === 'forgot_password') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email.trim() || !emailRegex.test(email)) {
        errors.email = "Please enter a valid email address";
        isValid = false;
      }
      if (!password) {
        errors.password = "Please enter a password";
        isValid = false;
      } else if (password.length < 8) {
        errors.password = "Password must contain at least 8 characters";
        isValid = false;
      }
      if (confirmPassword !== password) {
        errors.confirmPassword = "Passwords do not match";
        isValid = false;
      }
    }

    setFormErrors(errors);
    return isValid;
  };

  const handleDeptSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedDeptIndex(prev => 
        filteredDepartments.length > 0 ? (prev + 1) % filteredDepartments.length : -1
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedDeptIndex(prev => 
        filteredDepartments.length > 0 ? (prev - 1 + filteredDepartments.length) % filteredDepartments.length : -1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedDeptIndex >= 0 && highlightedDeptIndex < filteredDepartments.length) {
        const selected = filteredDepartments[highlightedDeptIndex];
        setDepartment(selected);
        setShowDepartmentDropdown(false);
        setDepartmentSearch('');
        setHighlightedDeptIndex(-1);
        if (formErrors.department) {
          setFormErrors(prev => ({ ...prev, department: undefined }));
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowDepartmentDropdown(false);
    } else if (e.key === 'Tab') {
      setShowDepartmentDropdown(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await authService.signIn(email, password, role);
        if (res.error) {
          setError(res.error);
        } else if (res.profile && res.role) {
          onAuthSuccess(res.profile, res.role);
        } else {
          setError('Authentication returned empty details. Please retry.');
        }
      } 
      else if (mode === 'signup') {
        if (role === 'student') {
          const res = await authService.signUpStudent({
            fullName,
            usn: usn.trim().toUpperCase(),
            department: normalizeDepartmentName(department),
            email,
            password
          });

          if (res.error) {
            setError(res.error);
          } else if (res.profile) {
            setSuccess('Student registration completed! You have been logged in.');
            setTimeout(() => {
              if (res.profile) onAuthSuccess(res.profile, 'student');
            }, 1000);
          }
        } 
        else {
          // Admin signup
          const res = await authService.signUpAdmin({
            fullName,
            adminId: adminId.trim(),
            email,
            password
          });

          if (res.error) {
            setError(res.error);
          } else if (res.profile) {
            setSuccess('Admin account successfully configured! Direct access granted.');
            setTimeout(() => {
              if (res.profile) onAuthSuccess(res.profile, 'admin');
            }, 1000);
          }
        }
      } 
      else if (mode === 'forgot_password') {
        const res = await authService.updatePassword(email, password);
        if (res.error) {
          setError(res.error);
        } else {
          setSuccess('Security alert. Password updated successfully! Please login.');
          setTimeout(() => {
            handleModeChange('login');
          }, 1500);
        }
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected connection error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const passwordsMatch = password === confirmPassword;
  
  // Real-time mismatch validation
  const isMismatch = confirmPassword !== '' && !passwordsMatch;

  // The Create Account / Submit button is disabled in signup mode if passwords don't match, or if either is empty
  const isSubmitDisabled = loading || (mode === 'signup' && (!passwordsMatch || !password || !confirmPassword));

  // Render Landing Page if selected
  if (mode === 'landing') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center relative overflow-hidden font-sans w-full">
        {/* Floating Theme Toggle */}
        <div className="absolute top-6 right-6 z-50">
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all cursor-pointer flex items-center justify-center shadow-lg"
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5 text-amber-400" />}
          </button>
        </div>

        {/* Dynamic Futuristic Neon Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#020617_1px,transparent_1px),linear-gradient(to_bottom,#020617_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-35" />
        
        {/* Decorative Neon Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

        {/* Landing Page Content Wrapper */}
        <div className="w-full max-w-6xl px-6 py-12 md:py-24 relative z-10 flex flex-col space-y-24">
          
          {/* HEADER HERO SECTION */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto space-y-6"
          >
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center shadow-[0_0_24px_rgba(6,182,212,0.4)]">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <span className="font-display font-black text-3xl tracking-tight bg-gradient-to-r from-white via-cyan-200 to-cyan-400 bg-clip-text text-transparent">
                Smart Attendance Hub
              </span>
            </div>

            <div className="space-y-4">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold tracking-widest text-cyan-400 bg-cyan-400/10 uppercase mb-2 border border-cyan-400/20">
                Attendance Management System
              </span>
              <h1 className="font-display text-4xl sm:text-6xl font-extrabold leading-tight tracking-tight text-white animate-pulse">
                Smart Attendance Hub
              </h1>
              <p className="font-display text-xl sm:text-2xl text-cyan-300 font-semibold tracking-wide">
                Manage sessions, attendance, assignments, reports, and analytics from one centralized platform.
              </p>
              <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed text-left sm:text-center">
                A modern platform for attendance tracking, session management, assignments, reports, and student engagement — all in one place.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <button
                onClick={() => setMode('login')}
                className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all font-display tracking-wide shadow-[0_0_25px_rgba(6,182,212,0.4)] flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>Get Started</span>
                <ArrowRight className="h-5 w-5" />
              </button>
              
              <a
                href="#features"
                className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-all font-display tracking-wide flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>Learn More</span>
              </a>
            </div>
          </motion.div>

          {/* FEATURES GRID SECTION */}
          <div id="features" className="space-y-12 pt-12 border-t border-slate-900/60">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <h2 className="font-display text-3xl font-extrabold text-white">Advanced Features Ecosystem</h2>
              <p className="text-slate-400 text-sm">Everything your college needs to maximize classroom metrics and participation levels.</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Feature 1 */}
              <div id="feat-qr" className="glass-panel p-6 rounded-2xl space-y-4 hover:border-cyan-500/30 transition-all group text-left">
                <div className="p-3 w-fit rounded-xl bg-cyan-500/10 text-cyan-400 group-hover:scale-110 transition-transform">
                  <QrCode className="h-6 w-6" />
                </div>
                <h3 className="font-display font-bold text-lg text-white">Secure QR-Based Attendance</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Generate unique QR codes for every session and allow students to mark attendance instantly. Built-in validation helps prevent duplicate entries and unauthorized check-ins.
                </p>
              </div>

              {/* Feature 2 */}
              <div id="feat-live" className="glass-panel p-6 rounded-2xl space-y-4 hover:border-purple-500/30 transition-all group text-left">
                <div className="p-3 w-fit rounded-xl bg-purple-500/10 text-purple-400 group-hover:scale-110 transition-transform">
                  <Activity className="h-6 w-6" />
                </div>
                <h3 className="font-display font-bold text-lg text-white">Live Session Monitoring</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Track active sessions in real time with live status indicators, participant counts, venue details, and attendance updates across all connected devices.
                </p>
              </div>

              {/* Feature 3 */}
              <div id="feat-loc" className="glass-panel p-6 rounded-2xl space-y-4 hover:border-emerald-500/30 transition-all group text-left">
                <div className="p-3 w-fit rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="font-display font-bold text-lg text-white">Secure Attendance Verification</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Mark attendance securely using live session validation, QR verification, approved student accounts, attendance tracking, and duplicate attendance prevention.
                </p>
              </div>

              {/* Feature 4 */}
              <div id="feat-assign" className="glass-panel p-6 rounded-2xl space-y-4 hover:border-rose-500/30 transition-all group text-left">
                <div className="p-3 w-fit rounded-xl bg-rose-500/10 text-rose-400 group-hover:scale-110 transition-transform">
                  <ClipboardCheck className="h-6 w-6" />
                </div>
                <h3 className="font-display font-bold text-lg text-white">Assignment Management</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Create assignments, share resources, collect submissions, and monitor completion progress through a centralized dashboard.
                </p>
              </div>

              {/* Feature 5 */}
              <div id="feat-report" className="glass-panel p-6 rounded-2xl space-y-4 hover:border-cyan-500/30 transition-all group text-left">
                <div className="p-3 w-fit rounded-xl bg-cyan-400/10 text-cyan-400 group-hover:scale-110 transition-transform">
                  <BarChart3 className="h-6 w-6" />
                </div>
                <h3 className="font-display font-bold text-lg text-white">Reports & Analytics</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Gain insights into attendance trends, participation rates, assignment completion, and student engagement through interactive dashboards and exportable reports.
                </p>
              </div>

              {/* Feature 6 */}
              <div id="feat-feedback" className="glass-panel p-6 rounded-2xl space-y-4 hover:border-purple-500/30 transition-all group text-left">
                <div className="p-3 w-fit rounded-xl bg-purple-500/10 text-purple-400 group-hover:scale-110 transition-transform">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <h3 className="font-display font-bold text-lg text-white">Session Feedback & Summaries</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Collect student reflections, feedback, and learning outcomes after every session to improve future events and teaching effectiveness.
                </p>
              </div>

            </div>
          </div>

          {/* STATISTICS SECTION */}
          <div className="space-y-8">
            <div className="text-center max-w-xl mx-auto">
              <span className="text-[10px] font-mono font-bold tracking-widest text-cyan-400 uppercase">Key Indicators</span>
              <h2 className="font-display text-2xl font-extrabold text-white mt-1">Platform Performance Ratios</h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              
              {/* Card 1 */}
              <div className="glass-panel p-5 rounded-2xl text-center space-y-1">
                <p className="text-slate-400 text-xs">Attendance Accuracy</p>
                <p className="font-display text-4xl font-black text-cyan-400">99%</p>
              </div>

              {/* Card 2 */}
              <div className="glass-panel p-5 rounded-2xl text-center space-y-1">
                <p className="text-slate-400 text-xs">Real-Time Synchronization</p>
                <p className="font-display text-3xl font-black text-purple-400 pt-1">Instant</p>
              </div>

              {/* Card 3 */}
              <div className="glass-panel p-5 rounded-2xl text-center space-y-1">
                <p className="text-slate-400 text-xs">Session Management</p>
                <p className="font-display text-3xl font-black text-emerald-400 pt-1">Automated</p>
              </div>

              {/* Card 4 */}
              <div className="glass-panel p-5 rounded-2xl text-center space-y-1">
                <p className="text-slate-400 text-xs">Report Generation</p>
                <p className="font-display text-sm font-bold text-white leading-relaxed pt-2 font-mono text-cyan-200">PDF / EXCEL / CSV</p>
              </div>

            </div>
          </div>

          {/* WHY CHOOSE SMART ATTENDANCE HUB */}
          <div className="grid md:grid-cols-12 gap-8 items-center border-t border-slate-900/60 pt-12">
            <div className="md:col-span-5 space-y-4 text-left">
              <span className="text-xs uppercase font-black text-cyan-400 tracking-wider">Unmatched Advantages</span>
              <h2 className="font-display text-3xl md:text-4xl font-extrabold text-white">Why Choose Smart Attendance Hub?</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Our ecosystem provides an in-situ digital solution built on academic workflows that ensures physical classroom compliance without standard tedious overhead.
              </p>
            </div>

            <div className="md:col-span-1" />

            <div className="md:col-span-6 grid sm:grid-cols-2 gap-4">
              {[
                "Real-Time Attendance Tracking",
                "Secure QR Verification",
                "Duplicate Attendance Prevention",
                "Assignment Management",
                "Session Feedback Collection",
                "Detailed Analytics & Reports",
                "Mobile Friendly Design",
                "Automated Attendance Records",
                "Easy Administration",
                "Centralized Student Management"
              ].map((pt) => (
                <div key={pt} className="flex items-center space-x-2.5 text-xs text-left">
                  <div className="h-5 w-5 shrink-0 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                    <Check className="h-3 w-3" />
                  </div>
                  <span className="text-slate-300 font-semibold">{pt}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CALL TO ACTION SECTION */}
          <div className="glass-panel p-8 md:p-12 rounded-3xl text-center space-y-6 max-w-4xl mx-auto border-cyan-500/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
            <div className="absolute inset-0 bg-cyan-500/[0.02] mix-blend-color-dodge" />
            <div className="space-y-3 relative z-10">
              <h2 className="font-display text-3xl font-extrabold text-white leading-tight">Simplify Attendance Management</h2>
              <p className="text-slate-400 text-sm max-w-xl mx-auto leading-relaxed">
                Create sessions, track attendance, manage assignments, and generate reports from a single intelligent platform.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10 pt-2">
              <button
                onClick={() => setMode('login')}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display tracking-wide shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all cursor-pointer"
              >
                Get Started
              </button>
              <a
                href="#features"
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 font-display tracking-wide transition-all cursor-pointer"
              >
                Learn More
              </a>
            </div>
          </div>

        </div>

        {/* Dynamic Professional Footer */}
        <footer className="py-8 mt-12 border-t border-slate-900/60 w-full text-center text-xs text-slate-500 relative z-10 space-y-2">
          <p>Smart Attendance Hub &bull; All Rights Reserved.</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center relative overflow-hidden font-sans p-4">
      {/* Floating Theme Toggle */}
      <div className="absolute top-6 right-6 z-50">
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all cursor-pointer flex items-center justify-center shadow-lg"
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5 text-amber-400" />}
        </button>
      </div>

      {/* Floating Back to Home button (Only during Auth views) */}
      {mode !== 'landing' && (
        <div className="absolute top-6 left-6 z-50">
          <button
            type="button"
            onClick={() => handleModeChange('landing')}
            className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all cursor-pointer flex items-center space-x-2 shadow-lg"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs font-bold font-display">Back to Home</span>
          </button>
        </div>
      )}

      {/* Invisible backdrop for select outside click */}
      {showDepartmentDropdown && (
        <div 
          className="fixed inset-0 z-40 cursor-default" 
          onClick={() => {
            setShowDepartmentDropdown(false);
            setDepartmentSearch('');
            setHighlightedDeptIndex(-1);
          }}
        />
      )}

      {/* Dynamic Futuristic Neon Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#020617_1px,transparent_1px),linear-gradient(to_bottom,#020617_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-35" />
      
      {/* Decorative Neon Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-5xl grid md:grid-cols-12 gap-8 items-center relative z-10 text-left">
        
        {/* Left column: Visual branding text */}
        <div className="md:col-span-5 flex flex-col space-y-6 text-center md:text-left pr-0 md:pr-4">
          <div className="flex items-center justify-center md:justify-start space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.4)]">
              <Sparkles className="h-5.5 w-5.5 text-white" />
            </div>
            <span className="font-display font-extrabold text-2xl tracking-tight bg-gradient-to-r from-white via-cyan-200 to-cyan-400 bg-clip-text text-transparent">
              Smart Attendance Hub
            </span>
          </div>

          <div className="space-y-4">
            <h1 className="font-display text-4xl md:text-5xl font-extrabold leading-tight tracking-tight text-white">
              The next-gen <span className="bg-gradient-to-r from-cyan-400 via-emerald-400 to-purple-500 bg-clip-text text-transparent">Interactive Classroom</span> ecosystem.
            </h1>
            <p className="text-slate-400 text-base leading-relaxed">
              Verify attendance instantly, manage dynamic assignments, and collect real-time student learning insights — all within one beautiful decentralized workspace.
            </p>
          </div>

          <div className="flex justify-center md:justify-start">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${isCloudConnected ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]' : 'bg-slate-900 text-slate-400 border border-slate-800'}`}>
              <span className={`h-1.5 w-1.5 rounded-full mr-2 ${isCloudConnected ? 'bg-cyan-400 animate-pulse' : 'bg-slate-500'}`} />
              {isCloudConnected ? 'Supabase Connected (Cloud)' : 'Sandbox Mode (In-Memory Database & Storage active)'}
            </span>
          </div>
        </div>

        {/* Right column: Dynamic glassmorphism auth block */}
        <div className="md:col-span-7">
          <motion.div 
            layout
            className="glass-panel p-6 md:p-8 rounded-2xl relative shadow-2xl"
          >
            {/* Corner visual accent */}
            <div className="absolute top-0 right-0 h-16 w-16 overflow-hidden pointer-events-none">
              <div className="absolute top-[-10px] right-[-10px] h-6 w-24 bg-gradient-to-r from-cyan-500 to-purple-500 rotate-45 transform" />
            </div>

            {/* Selector Tab for Client roles (Only visible during Login/Signup) */}
            {mode !== 'forgot_password' && (
              <div className="grid grid-cols-2 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800/60 mb-6">
                <button
                  type="button"
                  id="role-student-btn"
                  onClick={() => { setRole('student'); resetFields(); }}
                  className={`py-2 rounded-lg text-sm font-semibold transition-all duration-300 flex items-center justify-center space-x-2 ${role === 'student' ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.3)] font-bold' : 'text-slate-400 hover:text-white'}`}
                >
                  <User className="h-4 w-4" />
                  <span>Student</span>
                </button>
                <button
                  type="button"
                  id="role-admin-btn"
                  onClick={() => { setRole('admin'); resetFields(); }}
                  className={`py-2 rounded-lg text-sm font-semibold transition-all duration-300 flex items-center justify-center space-x-2 ${role === 'admin' ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(139,92,246,0.3)] font-bold' : 'text-slate-400 hover:text-white'}`}
                >
                  <Shield className="h-4 w-4" />
                  <span>Administrator</span>
                </button>
              </div>
            )}

            {/* Header Title */}
            <div className="mb-6">
              <h2 className="font-display font-extrabold text-2xl text-white mb-1.5">
                {mode === 'login' && `Access as ${role === 'student' ? 'Student' : 'Admin'}`}
                {mode === 'signup' && `Register ${role === 'student' ? 'Student' : 'Admin'} Profile`}
                {mode === 'forgot_password' && 'Reset Security Password'}
              </h2>
              <p className="text-slate-400 text-sm">
                {mode === 'login' && 'Enter credentials into fields to resume session tracking.'}
                {mode === 'signup' && 'Create your localized student or helper account.'}
                {mode === 'forgot_password' && 'Enter your registered details below to set a new password.'}
              </p>
            </div>

            {/* Feedback Alert Banners */}
            <AnimatePresence mode="popLayout">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-4 py-3 rounded-xl text-sm mb-5 flex items-center space-x-2 shadow-sm"
                >
                  <span className="p-1 rounded bg-rose-500/10">&bull;</span>
                  <span className="flex-1 font-medium">{error}</span>
                </motion.div>
              )}
              {success && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 py-3 rounded-xl text-sm mb-5 flex items-center space-x-2 shadow-sm"
                >
                  <span className="p-1 rounded bg-emerald-500/10">&bull;</span>
                  <span className="flex-grow font-semibold">{success}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Full Name for Signup */}
              {mode === 'signup' && (
                <div className="space-y-1.5">
                  <label htmlFor="fullName" className="text-xs uppercase font-bold tracking-wider text-slate-400">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                    <input
                      id="fullName"
                      type="text"
                      placeholder="Enter Full Name"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (formErrors.fullName) {
                          setFormErrors(prev => ({ ...prev, fullName: undefined }));
                        }
                      }}
                      className={`glass-input w-full pl-10 pr-4 py-3 rounded-xl text-sm transition-colors ${
                        formErrors.fullName ? 'border-rose-500/50 focus:border-rose-500 bg-rose-500/5' : ''
                      }`}
                    />
                  </div>
                  {formErrors.fullName && (
                    <p className="text-xs text-rose-400 mt-0.5" id="fullName-error">
                      {formErrors.fullName}
                    </p>
                  )}
                </div>
              )}

              {/* USN for Student Signup */}
              {mode === 'signup' && role === 'student' && (
                <div className="space-y-1.5">
                  <label htmlFor="usn" className="text-xs uppercase font-bold tracking-wider text-slate-400">University Seat Number (USN)</label>
                  <div className="relative">
                    <Hash className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                    <input
                      id="usn"
                      type="text"
                      placeholder="Enter USN"
                      value={usn}
                      onChange={(e) => {
                        setUsn(e.target.value);
                        if (formErrors.usn) {
                          setFormErrors(prev => ({ ...prev, usn: undefined }));
                        }
                      }}
                      className={`glass-input w-full pl-10 pr-4 py-3 rounded-xl text-sm transition-colors ${
                        formErrors.usn ? 'border-rose-500/50 focus:border-rose-500 bg-rose-500/5' : ''
                      }`}
                    />
                  </div>
                  {formErrors.usn && (
                    <p className="text-xs text-rose-400 mt-0.5" id="usn-error">
                      {formErrors.usn}
                    </p>
                  )}
                </div>
              )}

              {/* Admin ID for Admin Signup (Supports Customizable CSE_HOD, Faculty123, etc) */}
              {mode === 'signup' && role === 'admin' && (
                <div className="space-y-1.5">
                  <label htmlFor="adminId" className="text-xs uppercase font-bold tracking-wider text-slate-400">Authorized Admin ID</label>
                  <div className="relative">
                    <Shield className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                    <input
                      id="adminId"
                      type="text"
                      placeholder="Enter Admin ID"
                      value={adminId}
                      onChange={(e) => {
                        setAdminId(e.target.value);
                        if (formErrors.adminId) {
                          setFormErrors(prev => ({ ...prev, adminId: undefined }));
                        }
                      }}
                      className={`glass-input w-full pl-10 pr-4 py-3 rounded-xl text-sm transition-colors ${
                        formErrors.adminId ? 'border-rose-500/50 focus:border-rose-500 bg-rose-500/5' : ''
                      }`}
                    />
                  </div>
                  {formErrors.adminId && (
                    <p className="text-xs text-rose-400 mt-0.5" id="adminId-error">
                      {formErrors.adminId}
                    </p>
                  )}
                </div>
              )}

              {/* Department for Student Signup (Searchable Dropdown) */}
              {mode === 'signup' && role === 'student' && (
                <div className="space-y-1.5 relative">
                  <label htmlFor="department-trigger" className="text-xs uppercase font-bold tracking-wider text-slate-400">Department</label>
                  <div className="relative z-50">
                    <Building2 className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500 pointer-events-none" />
                    <button
                      id="department-trigger"
                      type="button"
                      onClick={() => setShowDepartmentDropdown(!showDepartmentDropdown)}
                      className={`glass-input w-full pl-10 pr-10 py-3 rounded-xl text-sm text-left flex items-center justify-between transition-all ${
                        formErrors.department 
                          ? 'border-rose-500/50 focus:border-rose-500 bg-rose-500/5 text-slate-400' 
                          : department === '' 
                          ? 'text-slate-400' 
                          : 'text-white'
                      }`}
                    >
                      <span className="truncate">{department || "Select Department"}</span>
                      <ChevronDown className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${showDepartmentDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showDepartmentDropdown && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-slate-950/95 border border-slate-800/80 rounded-xl shadow-2xl p-2.5 space-y-2 max-h-80 overflow-hidden flex flex-col z-50 backdrop-blur-xl">
                        <div className="relative shrink-0">
                          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                          <input
                            type="text"
                            id="department-search"
                            placeholder="Type to search department..."
                            value={departmentSearch}
                            onChange={(e) => {
                              setDepartmentSearch(e.target.value);
                              setHighlightedDeptIndex(0);
                            }}
                            className="bg-slate-900 border border-slate-850 rounded-lg py-2 pl-9 pr-3 text-xs w-full text-white focus:outline-none focus:border-cyan-500"
                            autoFocus
                            onKeyDown={handleDeptSearchKeyDown}
                          />
                        </div>
                        <div className="overflow-y-auto max-h-52 space-y-1 text-xs">
                          {filteredDepartments.length === 0 ? (
                            <div className="text-slate-500 p-3 text-center">No matching departments found</div>
                          ) : (
                            filteredDepartments.map((dept, idx) => (
                              <button
                                key={dept}
                                type="button"
                                onClick={() => {
                                  setDepartment(dept);
                                  setShowDepartmentDropdown(false);
                                  setDepartmentSearch('');
                                  setHighlightedDeptIndex(-1);
                                  if (formErrors.department) {
                                    setFormErrors(prev => ({ ...prev, department: undefined }));
                                  }
                                }}
                                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center justify-between ${
                                  department === dept 
                                    ? 'bg-cyan-500/10 text-cyan-400 font-bold border border-cyan-500/20' 
                                    : highlightedDeptIndex === idx 
                                    ? 'bg-slate-800 text-slate-200 font-medium' 
                                    : 'text-slate-404 hover:bg-slate-900 hover:text-slate-200'
                                }`}
                              >
                                <span>{dept}</span>
                                {department === dept && <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {formErrors.department && (
                    <p className="text-xs text-rose-400 mt-0.5" id="department-error">
                      {formErrors.department}
                    </p>
                  )}
                </div>
              )}

              {/* Email Input */}
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-xs uppercase font-bold tracking-wider text-slate-400">
                  {mode === 'login' && role === 'student' && 'USN or Registered Email'}
                  {mode === 'login' && role === 'admin' && 'Admin ID or Registered Email'}
                  {mode === 'signup' && 'Email Address'}
                  {mode === 'forgot_password' && 'Registered Email Address'}
                </label>
                <div className="relative">
                  {mode === 'login' ? (
                    role === 'student' ? (
                      <Hash className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                    ) : (
                      <Shield className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                    )
                  ) : (
                    <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                  )}
                  <input
                    id="email"
                    type={mode === 'login' ? 'text' : 'email'}
                    placeholder={
                      mode === 'login' 
                        ? (role === 'student' ? 'Enter USN or Email' : 'Enter Admin ID or Email')
                        : 'Enter Email Address'
                    }
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (formErrors.email) {
                        setFormErrors(prev => ({ ...prev, email: undefined }));
                      }
                    }}
                    className={`glass-input w-full pl-10 pr-4 py-3 rounded-xl text-sm transition-colors ${
                      formErrors.email ? 'border-rose-500/50 focus:border-rose-500 bg-rose-500/5' : ''
                    }`}
                  />
                </div>
                {formErrors.email && (
                  <p className="text-xs text-rose-400 mt-0.5" id="email-error">
                    {formErrors.email}
                  </p>
                )}
              </div>

              {/* Password Input (Login, Signup, Forgot password) */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label htmlFor="password" className="text-xs uppercase font-bold tracking-wider text-slate-400">
                    {mode === 'forgot_password' ? 'New Password' : 'Password'}
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => handleModeChange('forgot_password')}
                      className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter Password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (formErrors.password) {
                        setFormErrors(prev => ({ ...prev, password: undefined }));
                      }
                      // Clear mismatch design in real-time
                      if (confirmPassword && e.target.value === confirmPassword) {
                        setFormErrors(prev => ({ ...prev, confirmPassword: undefined }));
                      }
                    }}
                    className={`glass-input w-full pl-10 pr-10 py-3 rounded-xl text-sm font-mono transition-colors ${
                      formErrors.password ? 'border-rose-500/50 focus:border-rose-500 bg-rose-500/5' : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3.5 text-slate-500 hover:text-slate-300 pointer-events-auto"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {formErrors.password && (
                  <p className="text-xs text-rose-400 mt-0.5" id="password-error">
                    {formErrors.password}
                  </p>
                )}
              </div>

              {/* Confirm Password for Forgot Password or Signup validations */}
              {(mode === 'signup' || mode === 'forgot_password') && (
                <div className="space-y-1.5">
                  <label htmlFor="confirmPassword" className="text-xs uppercase font-bold tracking-wider text-slate-400">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Re-enter Password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (formErrors.confirmPassword && e.target.value === password) {
                          setFormErrors(prev => ({ ...prev, confirmPassword: undefined }));
                        }
                      }}
                      className={`glass-input w-full pl-10 pr-10 py-3 rounded-xl text-sm font-mono transition-colors ${
                        (formErrors.confirmPassword || isMismatch) ? 'border-rose-500/50 focus:border-rose-500 bg-rose-500/5' : ''
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-3.5 text-slate-500 hover:text-slate-300 pointer-events-auto"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {(formErrors.confirmPassword || isMismatch) && (
                    <p className="text-xs text-rose-400 mt-0.5 font-medium" id="confirmPassword-error">
                      Passwords do not match
                    </p>
                  )}
                </div>
              )}

              {/* Form Buttons */}
              <div className="pt-2 flex flex-col space-y-3">
                <button
                  type="submit"
                  disabled={isSubmitDisabled}
                  className={`w-full py-3 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                    mode === 'forgot_password' 
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                      : (role === 'student' 
                          ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                          : 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_15px_rgba(139,92,246,0.3)]')
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {loading ? (
                    <RefreshCw className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <span>
                        {mode === 'login' && 'Sign In'}
                        {mode === 'signup' && 'Create Account'}
                        {mode === 'forgot_password' && 'Update Password'}
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                {mode === 'forgot_password' && (
                  <button
                    type="button"
                    onClick={() => handleModeChange('login')}
                    className="w-full py-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 font-semibold hover:bg-slate-800 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>

            {/* Account Switchers */}
            <div className="mt-6 pt-4 border-t border-slate-900/60 text-center text-sm">
              {mode === 'login' ? (
                <p className="text-slate-400">
                  New to Smart Attendance Hub?{' '}
                  <button
                    type="button"
                    onClick={() => handleModeChange('signup')}
                    className="text-cyan-400 font-bold hover:underline transition-all"
                  >
                    Sign up now
                  </button>
                </p>
              ) : mode === 'signup' ? (
                <p className="text-slate-400">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => handleModeChange('login')}
                    className="text-cyan-400 font-bold hover:underline transition-all"
                  >
                    Log in here
                  </button>
                </p>
              ) : null}
            </div>

          </motion.div>
        </div>

      </div>

      <footer className="mt-8 relative z-10 text-xs text-slate-500 text-center">
        <div>Smart Attendance Hub &bull; All Rights Reserved.</div>
      </footer>
    </div>
  );
}
