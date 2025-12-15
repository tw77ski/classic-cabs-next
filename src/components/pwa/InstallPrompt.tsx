"use client";

import { useState, useEffect } from "react";

interface InstallPromptProps {
  onInstall: () => void;
  onDismiss: () => void;
}

export function InstallPrompt({ onInstall, onDismiss }: InstallPromptProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Animate in
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsClosing(true);
    setTimeout(() => {
      onDismiss();
    }, 300);
  };

  const handleInstall = () => {
    onInstall();
  };

  return (
    <div 
      className={`fixed bottom-4 left-4 right-4 z-50 transition-all duration-300 ${
        isVisible && !isClosing 
          ? "opacity-100 translate-y-0" 
          : "opacity-0 translate-y-4"
      }`}
    >
      <div className="max-w-md mx-auto bg-[#1b1b1b] border border-[#333] rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-[#ffd55c]/20 to-transparent border-b border-[#333]">
          <div className="flex items-start gap-3">
            {/* App Icon */}
            <div className="w-12 h-12 rounded-xl bg-[#ffd55c] flex items-center justify-center flex-shrink-0">
              <svg className="w-7 h-7 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.9 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8c-.3.5-.1 1.1.4 1.3l.5.2" />
                <circle cx="7" cy="17" r="2" />
                <circle cx="17" cy="17" r="2" />
              </svg>
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-[#f5f5f5]">
                Install Classic Cabs
              </h3>
              <p className="text-xs text-[#888] mt-0.5">
                Add to your home screen for quick access
              </p>
            </div>

            {/* Close Button */}
            <button
              onClick={handleDismiss}
              className="p-1 text-[#666] hover:text-[#f5f5f5] transition"
              aria-label="Dismiss"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Benefits */}
        <div className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs text-[#888]">
            <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Works offline</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#888]">
            <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Faster loading</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#888]">
            <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Get booking notifications</span>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 pt-0 flex gap-2">
          <button
            onClick={handleDismiss}
            className="flex-1 py-2.5 text-sm text-[#888] hover:text-[#f5f5f5] border border-[#333] rounded-lg transition"
          >
            Not now
          </button>
          <button
            onClick={handleInstall}
            className="flex-1 py-2.5 text-sm font-semibold bg-[#ffd55c] text-black rounded-lg hover:bg-[#ffcc33] transition flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Install
          </button>
        </div>
      </div>
    </div>
  );
}

