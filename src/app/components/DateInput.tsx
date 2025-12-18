// DateInput component - displays date in UK format (dd/mm/yyyy)
// Uses native date picker but shows UK formatted display

"use client";

import React, { useRef } from 'react';

interface DateInputProps {
  label?: string;
  value: string; // YYYY-MM-DD format
  onChange: (value: string) => void;
  className?: string;
}

export default function DateInput({
  label,
  value,
  onChange,
  className = "",
}: DateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Convert YYYY-MM-DD to dd/mm/yyyy for display
  function formatForDisplay(isoDate: string): string {
    if (!isoDate) return "";
    const [year, month, day] = isoDate.split("-");
    if (!year || !month || !day) return "";
    return `${day}/${month}/${year}`;
  }

  function openPicker() {
    if (inputRef.current) {
      inputRef.current.showPicker();
    }
  }

  return (
    <div>
      {label && (
        <label className="text-[10px] text-[#666] mb-1 block">{label}</label>
      )}
      <div className="relative">
        {/* Display field - shows UK format */}
        <button
          type="button"
          onClick={openPicker}
          className={`glow-input w-full p-1.5 text-xs h-8 bg-[#111] border border-[#333] text-[#f5f5f5] focus:outline-none focus:border-[#d4af37] text-left flex items-center justify-between ${className}`}
        >
          <span className={value ? "text-[#f5f5f5]" : "text-[#555]"}>
            {value ? formatForDisplay(value) : "dd/mm/yyyy"}
          </span>
          <svg className="w-3 h-3 text-[#666]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
        </button>
        
        {/* Hidden native date input for picker */}
        <input
          ref={inputRef}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
          tabIndex={-1}
        />
      </div>
    </div>
  );
}








