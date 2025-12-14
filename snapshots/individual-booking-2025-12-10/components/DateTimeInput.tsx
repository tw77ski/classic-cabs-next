"use client";

import { useState, useEffect } from "react";

interface DateTimeInputProps {
  value: string; // ISO format: YYYY-MM-DDTHH:mm
  onChange: (value: string) => void;
  className?: string;
  hasError?: boolean;
}

/**
 * Custom DateTime input that displays dd/mm/yyyy and 24-hour format
 * Internally stores as ISO format for form submission
 */
export default function DateTimeInput({
  value,
  onChange,
  className = "",
  hasError = false,
}: DateTimeInputProps) {
  // Parse ISO value into separate date and time
  const [dateValue, setDateValue] = useState("");
  const [timeValue, setTimeValue] = useState("");

  // Sync from parent ISO value
  useEffect(() => {
    if (value) {
      // value is in format: YYYY-MM-DDTHH:mm
      const [datePart, timePart] = value.split("T");
      if (datePart) {
        // Convert YYYY-MM-DD to DD/MM/YYYY for display
        const [year, month, day] = datePart.split("-");
        if (year && month && day) {
          setDateValue(`${day}/${month}/${year}`);
        }
      }
      if (timePart) {
        setTimeValue(timePart);
      }
    } else {
      setDateValue("");
      setTimeValue("");
    }
  }, [value]);

  // Convert dd/mm/yyyy to YYYY-MM-DD
  function parseDate(input: string): string | null {
    // Handle various formats
    const cleaned = input.replace(/[\/\-\.]/g, "/");
    const parts = cleaned.split("/");
    
    if (parts.length === 3) {
      const [day, month, year] = parts;
      const d = parseInt(day, 10);
      const m = parseInt(month, 10);
      let y = parseInt(year, 10);
      
      // Handle 2-digit years
      if (y < 100) {
        y += y < 50 ? 2000 : 1900;
      }
      
      // Validate
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 2024 && y <= 2100) {
        return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      }
    }
    return null;
  }

  // Handle date input change
  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target.value;
    setDateValue(input);
    
    // Try to parse and update parent
    const isoDate = parseDate(input);
    if (isoDate && timeValue) {
      onChange(`${isoDate}T${timeValue}`);
    } else if (isoDate) {
      // Default to current time + 1 hour if no time set
      const now = new Date();
      now.setHours(now.getHours() + 1);
      const defaultTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      setTimeValue(defaultTime);
      onChange(`${isoDate}T${defaultTime}`);
    }
  }

  // Handle time input change
  function handleTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target.value;
    setTimeValue(input);
    
    // Update parent if we have a valid date
    const isoDate = parseDate(dateValue);
    if (isoDate && input) {
      onChange(`${isoDate}T${input}`);
    }
  }

  // Handle date blur - auto-format
  function handleDateBlur() {
    const isoDate = parseDate(dateValue);
    if (isoDate) {
      const [year, month, day] = isoDate.split("-");
      setDateValue(`${day}/${month}/${year}`);
    }
  }

  // Set min date to today
  function getTodayISO(): string {
    const today = new Date();
    return today.toISOString().split("T")[0];
  }

  const baseInputClass = `glow-input p-2 text-sm h-9 bg-[#111] text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/30`;
  const borderClass = hasError ? "border-red-500/50" : "border-[#333]";

  return (
    <div className={`flex gap-2 ${className}`}>
      {/* Date Input */}
      <div className="flex-1 relative">
        <input
          type="text"
          value={dateValue}
          onChange={handleDateChange}
          onBlur={handleDateBlur}
          placeholder="dd/mm/yyyy"
          className={`${baseInputClass} ${borderClass} border w-full pr-8`}
          maxLength={10}
        />
        {/* Calendar icon - opens native date picker on click */}
        <input
          type="date"
          min={getTodayISO()}
          onChange={(e) => {
            if (e.target.value) {
              const [year, month, day] = e.target.value.split("-");
              setDateValue(`${day}/${month}/${year}`);
              if (timeValue) {
                onChange(`${e.target.value}T${timeValue}`);
              } else {
                const now = new Date();
                now.setHours(now.getHours() + 1);
                const defaultTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
                setTimeValue(defaultTime);
                onChange(`${e.target.value}T${defaultTime}`);
              }
            }
          }}
          className="absolute right-0 top-0 w-8 h-full opacity-0 cursor-pointer"
          tabIndex={-1}
        />
        <svg 
          className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666] pointer-events-none"
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>

      {/* Time Input - 24hr format */}
      <div className="w-24 relative">
        <input
          type="time"
          value={timeValue}
          onChange={handleTimeChange}
          className={`${baseInputClass} ${borderClass} border w-full`}
        />
      </div>
    </div>
  );
}

