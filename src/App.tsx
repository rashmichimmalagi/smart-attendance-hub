/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { isSupabaseConfigured, authService } from './supabase';
import { Profile, UserRole } from './types';
import Auth from './components/Auth';
import AdminView from './components/AdminView';
import StudentView from './components/StudentView';
import { Info, AlertCircle, CheckCircle, RefreshCw, Clock, LogOut } from 'lucide-react';
import BackgroundBubbles from './components/BackgroundBubbles';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

const OFFLINE_CARDS_BY_CATEGORY = {
  "💻 Coding Tip": [
    "Small daily improvements lead to remarkable results.",
    "Write code for humans first, computers second.",
    "Good variable names reduce future bugs.",
    "Simpler solutions are usually better solutions.",
    "Debugging is a skill, not a punishment.",
    "Comment why, not what.",
    "Test edge cases before deployment.",
    "Readability is a feature.",
    "Refactor regularly to keep code maintainable.",
    "Version control saves projects and careers.",
    "Always validate user input."
  ],
  "🌟 Motivation": [
    "Consistency beats intensity when repeated every day.",
    "Small daily improvements lead to remarkable results.",
    "Success is built from habits, not motivation.",
    "Progress is progress, no matter how small.",
    "Discipline creates opportunities that motivation cannot.",
    "Great achievements begin with small actions.",
    "Every expert was once a beginner.",
    "Stay focused on progress, not perfection.",
    "Persistence often matters more than talent.",
    "Your future is created by what you do today."
  ],
  "📚 Learning Fact": [
    "Active recall improves long-term memory retention.",
    "Active recall improves memory retention.",
    "Spaced repetition strengthens long-term learning.",
    "Teaching others reinforces understanding.",
    "Short focused study sessions improve concentration.",
    "Practice is more effective than passive reading.",
    "Sleep plays a critical role in memory formation.",
    "Understanding concepts beats memorization.",
    "Consistent study habits improve performance.",
    "Reflection helps retain knowledge.",
    "Learning is most effective when applied practically."
  ],
  "🤖 AI Insight": [
    "Machine learning powers many everyday applications.",
    "AI is transforming software development workflows.",
    "Modern AI tools assist developers in writing code.",
    "AI is increasingly used for software testing.",
    "Responsible AI development is becoming essential.",
    "AI literacy is a valuable career skill.",
    "AI can automate repetitive development tasks.",
    "Generative AI is changing content creation.",
    "AI works best when paired with human judgment.",
    "Understanding AI concepts improves adaptability."
  ],
  "🎯 Career Tip": [
    "Projects often speak louder than grades.",
    "Communication is a professional superpower.",
    "Employers value problem-solving abilities.",
    "Networking creates opportunities.",
    "Consistency builds a strong professional profile.",
    "Soft skills and technical skills are equally important.",
    "Continuous learning improves career growth.",
    "Portfolios demonstrate practical ability.",
    "Teamwork is a highly valued skill.",
    "Professionalism leaves a lasting impression."
  ]
};

const OFFLINE_CATEGORIES = [
  "💻 Coding Tip",
  "🌟 Motivation",
  "📚 Learning Fact",
  "🤖 AI Insight",
  "🎯 Career Tip"
];

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const isCloudConnected = isSupabaseConfigured;

  // OFFLINE EXPERIENCE CONTROLS State
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [offlineSeconds, setOfflineSeconds] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(() => localStorage.getItem('last_successful_sync_time') || new Date().toLocaleTimeString());
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(() => Math.floor(Math.random() * OFFLINE_CATEGORIES.length));
  const [currentQuoteText, setCurrentQuoteText] = useState(() => {
    const defaultCat = OFFLINE_CATEGORIES[Math.floor(Math.random() * OFFLINE_CATEGORIES.length)];
    const quotes = OFFLINE_CARDS_BY_CATEGORY[defaultCat as keyof typeof OFFLINE_CARDS_BY_CATEGORY];
    return quotes[Math.floor(Math.random() * quotes.length)];
  });
  const [pendingQueueSize, setPendingQueueSize] = useState(0);
  const [isSyncingOverlay, setIsSyncingOverlay] = useState(false);

  // Modern persistent theme mode state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', next);
      return next;
    });
  }, []);

  // Update HTML class attribute and handle full transitions immediately
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  // Unified customizable Toast notification display list
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Automatically fade out after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Check login authorization on initial mount
  const checkUserSession = useCallback(async (isSilent = false) => {
    try {
      const userRes = await authService.getCurrentUser();
      if (userRes.profile && userRes.role) {
        setProfile(userRes.profile);
        setRole(userRes.role);
        if (!isSilent) {
          showToast(`Welcome back, ${userRes.profile.fullName}!`, 'success');
        }
      } else {
        // Only safely clear credentials when it's NOT a background/silent storage state sync
        if (!isSilent) {
          setProfile(null);
          setRole(null);
        }
      }
    } catch (err) {
      console.error('Session retrieval error:', err);
    } finally {
      setInitializing(false);
    }
  }, [showToast]);

  useEffect(() => {
    checkUserSession();
  }, [checkUserSession]);

  // Sync user state in real-time across components/storage changes
  useEffect(() => {
    const handleSync = () => {
      checkUserSession(true);
    };
    window.addEventListener('storage', handleSync);
    window.addEventListener('storage_sync_update', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('storage_sync_update', handleSync);
    };
  }, [checkUserSession]);

  // Reactive Offline Mode Listeners and Timer tick
  useEffect(() => {
    const handleOnline = () => {
      setIsSyncingOverlay(true);
      setIsOffline(false);
      setOfflineSeconds(0);
      const nowStr = new Date().toLocaleTimeString();
      setLastSyncTime(nowStr);
      localStorage.setItem('last_successful_sync_time', nowStr);
      showToast('Network restored. Local changes synced successfully!', 'success');
      
      const actions = JSON.parse(localStorage.getItem('pending_offline_sync_queue') || '[]');
      setPendingQueueSize(actions.length);

      // Transition screen display for 2.5 seconds
      setTimeout(() => {
        setIsSyncingOverlay(false);
      }, 2500);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setOfflineSeconds(0);
      showToast('Connection interrupted. Offline safe-mode engaged.', 'info');
      
      const actions = JSON.parse(localStorage.getItem('pending_offline_sync_queue') || '[]');
      setPendingQueueSize(actions.length);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Synchronize initial offline queue size count
    const initialActions = JSON.parse(localStorage.getItem('pending_offline_sync_queue') || '[]');
    setPendingQueueSize(initialActions.length);

    const handleQueueUpdate = () => {
      const activeActions = JSON.parse(localStorage.getItem('pending_offline_sync_queue') || '[]');
      setPendingQueueSize(activeActions.length);
    };
    window.addEventListener('pending_actions_updated', handleQueueUpdate);
    window.addEventListener('storage', handleQueueUpdate);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('pending_actions_updated', handleQueueUpdate);
      window.removeEventListener('storage', handleQueueUpdate);
    };
  }, [showToast]);

  useEffect(() => {
    if (!isOffline) {
      return;
    }

    const interval = setInterval(() => {
      setOfflineSeconds((prev) => prev + 5);
      
      // Rotate sequential content with internal category randomization to avoid consecutive duplicates
      setCurrentCategoryIndex((prevIdx) => {
        const nextIdx = (prevIdx + 1) % OFFLINE_CATEGORIES.length;
        const category = OFFLINE_CATEGORIES[nextIdx];
        const quotes = OFFLINE_CARDS_BY_CATEGORY[category as keyof typeof OFFLINE_CARDS_BY_CATEGORY];
        const nextQuote = quotes[Math.floor(Math.random() * quotes.length)];
        setCurrentQuoteText(nextQuote);
        return nextIdx;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [isOffline]);

  const handleAuthSuccess = (userProfile: Profile, userRole: UserRole) => {
    setProfile(userProfile);
    setRole(userRole);
    showToast(`Access Granted as ${userRole.toUpperCase()}`, 'success');
  };

  const handleLogout = async () => {
    try {
      await authService.signOut();
      setProfile(null);
      setRole(null);
      showToast('Logged out of Smart Attendance Hub.', 'info');
    } catch {
      showToast('Error signs you out.', 'error');
    }
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center font-sans relative overflow-hidden">
        <BackgroundBubbles />
        <div className="flex flex-col items-center space-y-4 text-center relative z-10">
          <div className="h-10 w-10 text-cyan-400 animate-spin">
            <RefreshCw className="h-10 w-10" />
          </div>
          <div className="space-y-1">
            <h3 className="font-display font-extrabold text-lg text-white">Loading Smart Attendance Hub</h3>
            <p className="text-xs text-slate-500 max-w-xs leading-relaxed">Preparing application details and account states.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">
      <BackgroundBubbles />
      
      {/* Dynamic Content Views */}
      <div className="relative z-10">
        {!profile || !role ? (
          <Auth onAuthSuccess={handleAuthSuccess} isCloudConnected={isCloudConnected} theme={theme} toggleTheme={toggleTheme} />
        ) : role === 'admin' ? (
          <AdminView adminProfile={profile} onLogout={handleLogout} showToast={showToast} theme={theme} toggleTheme={toggleTheme} />
        ) : profile.accountStatus === 'Pending' ? (
          <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center font-sans relative overflow-hidden p-4">
            <BackgroundBubbles />
            <div className="glass-panel max-w-md w-full p-6 md:p-8 rounded-3xl relative flex flex-col items-center bg-slate-950 border border-slate-900 text-center space-y-6 shadow-2xl animate-fade-in animate-duration-300">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.2)] animate-pulse">
                <Clock className="h-8 w-8" />
              </div>
              
              <div className="space-y-2">
                <h2 id="pending-header" className="font-display font-extrabold text-white text-xl tracking-tight">
                  Your account is pending administrator approval.
                </h2>
                <p id="pending-text" className="text-slate-400 text-sm leading-relaxed">
                  Please wait until an administrator approves your registration.
                </p>
              </div>

              <div className="border-t border-slate-900/60 w-full pt-4">
                <button
                  id="btn-pending-logout"
                  onClick={handleLogout}
                  className="w-full py-3 px-4 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition-all font-semibold text-sm cursor-pointer flex items-center justify-center space-x-2 shadow-lg font-sans"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        ) : profile.accountStatus === 'Rejected' ? (
          <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center font-sans relative overflow-hidden p-4">
            <BackgroundBubbles />
            <div className="glass-panel max-w-md w-full p-6 md:p-8 rounded-3xl relative flex flex-col items-center bg-slate-950 border border-slate-900 text-center space-y-6 shadow-2xl animate-fade-in animate-duration-300">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center shadow-[0_0_25px_rgba(244,63,94,0.2)]">
                <AlertCircle className="h-8 w-8 text-rose-400 animate-pulse" />
              </div>
              
              <div className="space-y-2">
                <h2 id="rejected-header" className="font-display font-extrabold text-white text-xl tracking-tight">
                  Your registration request was rejected.
                </h2>
                <p id="rejected-text" className="text-slate-400 text-sm leading-relaxed">
                  Please contact the administrator for assistance.
                </p>
              </div>

              <div className="border-t border-slate-900/60 w-full pt-4">
                <button
                  id="btn-rejected-logout"
                  onClick={handleLogout}
                  className="w-full py-3 px-4 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition-all font-semibold text-sm cursor-pointer flex items-center justify-center space-x-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <StudentView studentProfile={profile} onLogout={handleLogout} showToast={showToast} theme={theme} toggleTheme={toggleTheme} />
        )}
      </div>

      {/* Floating Micro-Toast system */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col space-y-3 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-2xl border flex items-start space-x-3 shadow-lg transform transition-all duration-350 ease-out translate-y-0 opacity-100 ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/20'
                : toast.type === 'error'
                ? 'bg-rose-950/90 text-rose-350 border-rose-500/20'
                : 'bg-cyan-950/90 text-cyan-300 border-cyan-500/20'
            }`}
          >
            {toast.type === 'success' && <CheckCircle className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />}
            {toast.type === 'error' && <AlertCircle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />}
            {toast.type === 'info' && <Info className="h-5 w-5 shrink-0 text-cyan-400 mt-0.5" />}

            <div className="text-xs leading-relaxed font-semibold flex-1">
              {toast.message}
            </div>

            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-slate-500 hover:text-white font-bold text-xs leading-none"
            >
              &times;
            </button>
          </div>
        ))}
      </div>

       {/* Floating Interactive Offline Experience Hub */}
      {isOffline && (() => {
        return (
          <div className="fixed bottom-6 left-6 z-50 max-w-sm w-full bg-slate-950/98 border border-red-500/20 rounded-2xl p-5 shadow-[0_12px_40px_rgba(239,68,68,0.15)] backdrop-blur-md transition-all duration-300">
            <div className="space-y-4">
              {/* Header Status */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-black text-rose-500 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>
                  📡 OFFLINE MODE ACTIVE
                </h4>
                <div className="text-slate-300 text-xs font-medium space-y-0.5">
                  <p>Connection lost.</p>
                  <p className="text-emerald-400 flex items-center gap-1">
                    <span>🛡️</span> Your attendance data is safe.
                  </p>
                </div>
              </div>

              {/* Rotating Content Card */}
              <div 
                key={currentQuoteText} 
                className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/40 shadow-inner space-y-1.5 animate-fade-in"
              >
                <div className="text-[10px] font-mono tracking-wider text-cyan-400 font-extrabold uppercase">
                  {OFFLINE_CATEGORIES[currentCategoryIndex]}
                </div>
                <p className="text-xs text-white leading-relaxed font-bold">
                  "{currentQuoteText}"
                </p>
              </div>

              {/* Footer Section */}
              <div className="border-t border-slate-900 pt-3 space-y-1.5">
                <div className="text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                  <span>✅</span> All changes synced
                </div>
                <p className="text-[10.5px] text-slate-400 leading-normal font-medium">
                  System will automatically reconnect when internet returns.
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Connection Restored Syncing Overlay */}
      {isSyncingOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-all duration-300 animate-fade-in">
          <div className="glass-panel max-w-sm w-full p-6 rounded-3xl bg-slate-950 border border-emerald-500/30 text-center space-y-4 shadow-2xl shadow-emerald-500/10">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(16,185,129,0.2)]">
              <CheckCircle className="h-6 w-6 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display font-extrabold text-white text-base">✅ Connection Restored</h3>
              <p className="text-[11px] text-slate-450 font-semibold leading-relaxed">Syncing latest attendance data...</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
