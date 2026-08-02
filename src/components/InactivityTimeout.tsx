/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, LogOut, RefreshCw } from 'lucide-react';

interface InactivityTimeoutProps {
  onLogout: (skipConfirm?: boolean) => Promise<void>;
}

export default function InactivityTimeout({ onLogout }: InactivityTimeoutProps) {
  const [isWarning, setIsWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [isSigningOut, setIsSigningOut] = useState(false);
  
  // Track last activity timestamp
  const lastActivityTimeRef = useRef<number>(Date.now());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize pause state on window if not present
  if (typeof window !== 'undefined' && !(window as any).inactivityTimeoutPaused) {
    (window as any).inactivityTimeoutPaused = false;
  }

  // Reset the inactivity timer
  const resetTimer = () => {
    lastActivityTimeRef.current = Date.now();
  };

  useEffect(() => {
    // Activities to monitor
    const activityEvents = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart', 'click'];
    
    // Add event listeners
    const handleActivity = () => {
      // If warning is showing, standard events shouldn't close it, only the button.
      if (!isWarning) {
        resetTimer();
      }
    };

    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    // Custom event for internal navigation or tab switches
    window.addEventListener('user-activity', handleActivity);

    // Timer check loop running every second
    intervalRef.current = setInterval(() => {
      // Skip check if paused (e.g. uploading or exporting)
      if (typeof window !== 'undefined' && (window as any).inactivityTimeoutPaused) {
        // Keeps refreshing activity while paused so it doesn't trigger immediately after resume
        lastActivityTimeRef.current = Date.now();
        return;
      }

      if (isWarning) {
        setCountdown(prev => {
          if (prev <= 1) {
            // Expired!
            handleAutomaticLogout();
            return 0;
          }
          return prev - 1;
        });
      } else {
        const inactiveMs = Date.now() - lastActivityTimeRef.current;
        const inactiveSeconds = Math.floor(inactiveMs / 1000);
        
        // After exactly 9 minutes of inactivity (9 * 60 = 540 seconds)
        if (inactiveSeconds >= 540) {
          setIsWarning(true);
          setCountdown(60);
        }
      }
    }, 1000);

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      window.removeEventListener('user-activity', handleActivity);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isWarning]);

  const handleAutomaticLogout = async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setIsWarning(false);
    
    // Save current pathname to redirect back after next login
    if (typeof window !== 'undefined') {
      localStorage.setItem('redirect_to_after_login', window.location.pathname);
      localStorage.setItem('logout_reason_inactivity', 'true');
    }
    
    await onLogout(true);
  };

  const handleContinueSession = () => {
    setIsWarning(false);
    lastActivityTimeRef.current = Date.now();
  };

  const handleManualLogout = async () => {
    console.log('Sign Out clicked');
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await onLogout();
    } finally {
      setIsWarning(false);
      setIsSigningOut(false);
    }
  };

  if (!isWarning) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md transition-all duration-300 animate-fade-in">
      <div className="glass-panel max-w-md w-full p-6 md:p-8 rounded-3xl relative flex flex-col items-center bg-slate-950 border border-amber-500/30 text-center space-y-6 shadow-2xl shadow-amber-500/5">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.25)] animate-pulse">
          <ShieldAlert className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <h2 className="font-display font-extrabold text-white text-xl tracking-tight">
            Session Expiring
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            For your security, your session will expire in <span className="text-amber-400 font-bold font-mono text-base">{countdown}</span> seconds due to inactivity.
          </p>
        </div>

        {/* Dynamic visual countdown bar */}
        <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
          <div 
            className="bg-amber-500 h-full transition-all duration-1000 ease-linear"
            style={{ width: `${(countdown / 60) * 100}%` }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 w-full border-t border-slate-900/60 pt-4">
          <button
            onClick={handleContinueSession}
            disabled={isSigningOut}
            className="py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm transition-all shadow-[0_0_15px_rgba(6,182,212,0.25)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue Session
          </button>
          <button
            disabled={isSigningOut}
            onClick={handleManualLogout}
            className="py-3 px-4 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition-all font-semibold text-sm cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSigningOut ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin text-rose-400" />
                <span>Signing Out...</span>
              </>
            ) : (
              <>
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
