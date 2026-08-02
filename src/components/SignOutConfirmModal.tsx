import React, { useState, useEffect, useRef } from 'react';
import { LogOut, RefreshCw } from 'lucide-react';

interface SignOutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  theme?: 'dark' | 'light';
}

export default function SignOutConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  theme = 'dark'
}: SignOutConfirmModalProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      setIsSigningOut(false);
      // Auto focus on Sign Out button for smooth keyboard accessibility
      const timer = setTimeout(() => {
        confirmBtnRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Keyboard accessibility: Escape closes dialog, Enter activates focused button
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!isSigningOut) {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSigningOut, onClose]);

  if (!isOpen) return null;

  const handleConfirmClick = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await onConfirm();
    } catch (err) {
      console.error('Logout error:', err);
      console.error('Complete Supabase error:', err);
      setIsSigningOut(false);
    }
  };

  const isDark = theme === 'dark';

  return (
    <div
      id="signout-confirm-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signout-modal-title"
      aria-describedby="signout-modal-description"
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 font-sans animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSigningOut) {
          onClose();
        }
      }}
    >
      <div
        className={`glass-panel max-w-sm w-full p-6 md:p-8 rounded-2xl relative flex flex-col items-center text-center space-y-5 shadow-2xl transition-all duration-200 ${
          isDark
            ? 'bg-slate-950 border border-slate-900 text-slate-100'
            : 'bg-white border border-slate-200 text-slate-900'
        }`}
      >
        {/* Red / Danger Icon Badge */}
        <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-center justify-center shadow-[0_0_15px_rgba(244,63,94,0.15)] animate-pulse">
          <LogOut className="h-6 w-6" />
        </div>

        {/* Title and Message */}
        <div className="space-y-2">
          <h3
            id="signout-modal-title"
            className={`font-display font-extrabold text-lg ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            Sign Out
          </h3>
          <p
            id="signout-modal-description"
            className={`text-xs leading-relaxed ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}
          >
            Are you sure you want to sign out of Smart Attendance Hub?
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3.5 w-full pt-2">
          <button
            id="btn-signout-cancel"
            type="button"
            disabled={isSigningOut}
            onClick={onClose}
            className={`py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer font-sans disabled:opacity-50 disabled:cursor-not-allowed ${
              isDark
                ? 'border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white'
                : 'border-slate-300 hover:bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            Cancel
          </button>
          <button
            ref={confirmBtnRef}
            id="btn-signout-confirm"
            type="button"
            disabled={isSigningOut}
            onClick={handleConfirmClick}
            className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(244,63,94,0.2)] cursor-pointer font-sans disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {isSigningOut ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-white" />
                <span>Signing Out...</span>
              </>
            ) : (
              <span>Sign Out</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
