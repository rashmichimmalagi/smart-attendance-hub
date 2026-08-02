import React, { useState } from 'react';
import { X } from 'lucide-react';
import AboutView from './AboutView';

export default function Footer() {
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  return (
    <>
      <footer className="w-full py-4 mt-auto border-t border-slate-900/30 text-center text-[10px] md:text-xs text-slate-500 relative z-10 flex flex-col sm:flex-row items-center justify-center gap-2 px-4 select-none font-sans">
        <span>
          © 2026 Smart Attendance Hub v1.0 • Developed by Rashmi M Chimmalagi
        </span>
        <span className="hidden sm:inline text-slate-700 font-bold">•</span>
        <button
          type="button"
          onClick={() => setIsAboutOpen(true)}
          className="text-cyan-500 hover:text-cyan-400 font-extrabold cursor-pointer transition hover:underline focus:outline-none"
        >
          About Smart Attendance Hub
        </button>
      </footer>

      {isAboutOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 font-sans text-slate-100 animate-fade-in">
          <div className="glass-panel max-w-4xl w-full flex flex-col max-h-[90vh] rounded-3xl relative overflow-hidden bg-slate-950/95 border border-slate-800 shadow-2xl">
            {/* Modal Header */}
            <div className="p-6 pb-4 border-b border-slate-900/40 flex items-center justify-between">
              <h3 className="font-display font-bold text-lg text-white">
                About Smart Attendance Hub
              </h3>
              <button
                type="button"
                onClick={() => setIsAboutOpen(false)}
                className="text-slate-400 hover:text-white hover:bg-slate-900 p-2 rounded-xl transition-all cursor-pointer focus:outline-none"
                title="Close dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body / Scrollable Content */}
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              <AboutView />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
