"use client";

import { useState, useCallback, useRef, useLayoutEffect } from "react";

interface DateTimeInputProps {
  value: string; // ISO format: YYYY-MM-DDTHH:MM
  onChange: (value: string) => void;
  minDateTime?: string; // ISO format
  label?: string;
  required?: boolean;
  error?: boolean;
}

// Helper to parse ISO string
function parseISOValue(value: string): { date: string; time: string } {
  if (!value) return { date: "", time: "" };
  try {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return { date: `${day}/${month}/${year}`, time: `${hours}:${minutes}` };
    }
  } catch {
    // Invalid date
  }
  return { date: "", time: "" };
}

export default function DateTimeInput({
  value,
  onChange,
  minDateTime,
  label,
  required = false,
  error = false,
}: DateTimeInputProps) {
  // Parse the ISO value into date and time parts
  const initial = parseISOValue(value);
  const [dateValue, setDateValue] = useState(initial.date);
  const [timeValue, setTimeValue] = useState(initial.time);
  const prevValueRef = useRef(value);

  // Sync with external value changes (using useLayoutEffect to avoid flicker)
  useLayoutEffect(() => {
    if (value !== prevValueRef.current) {
      prevValueRef.current = value;
      const parsed = parseISOValue(value);
      // Defer state updates to avoid cascading renders
      queueMicrotask(() => {
        setDateValue(parsed.date);
        setTimeValue(parsed.time);
      });
    }
  }, [value]);

  // Combine date and time into ISO format
  const updateValue = useCallback((newDate: string, newTime: string) => {
    // Parse dd/mm/yyyy
    const dateMatch = newDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    // Parse HH:mm
    const timeMatch = newTime.match(/^(\d{2}):(\d{2})$/);

    if (dateMatch && timeMatch) {
      const [, day, month, year] = dateMatch;
      const [, hours, minutes] = timeMatch;
      
      // Create ISO string
      const isoString = `${year}-${month}-${day}T${hours}:${minutes}`;
      onChange(isoString);
    }
  }, [onChange]);

  // Handle date input with auto-formatting
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value.replace(/[^\d]/g, ""); // Remove non-digits
    
    // Auto-format as dd/mm/yyyy
    if (input.length >= 2) {
      input = input.slice(0, 2) + "/" + input.slice(2);
    }
    if (input.length >= 5) {
      input = input.slice(0, 5) + "/" + input.slice(5);
    }
    if (input.length > 10) {
      input = input.slice(0, 10);
    }
    
    setDateValue(input);
    
    // If complete, update the combined value
    if (input.length === 10 && timeValue.length === 5) {
      updateValue(input, timeValue);
    }
  };

  // Handle time input with auto-formatting
  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value.replace(/[^\d]/g, ""); // Remove non-digits
    
    // Auto-format as HH:mm
    if (input.length >= 2) {
      input = input.slice(0, 2) + ":" + input.slice(2);
    }
    if (input.length > 5) {
      input = input.slice(0, 5);
    }
    
    // Validate hours (00-23) and minutes (00-59)
    const timeMatch = input.match(/^(\d{2}):?(\d{0,2})$/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1], 10);
      const mins = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      
      if (hours > 23) {
        input = "23:" + input.slice(3);
      }
      if (mins > 59 && input.length === 5) {
        input = input.slice(0, 3) + "59";
      }
    }
    
    setTimeValue(input);
    
    // If complete, update the combined value
    if (input.length === 5 && dateValue.length === 10) {
      updateValue(dateValue, input);
    }
  };

  // Get minimum date/time for validation styling
  const isInPast = useCallback(() => {
    if (!minDateTime || !dateValue || !timeValue) return false;
    
    const dateMatch = dateValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    const timeMatch = timeValue.match(/^(\d{2}):(\d{2})$/);
    
    if (!dateMatch || !timeMatch) return false;
    
    const [, day, month, year] = dateMatch;
    const [, hours, minutes] = timeMatch;
    const selectedDate = new Date(`${year}-${month}-${day}T${hours}:${minutes}`);
    const minDate = new Date(minDateTime);
    
    return selectedDate < minDate;
  }, [dateValue, timeValue, minDateTime]);

  const inputClass = `p-2 text-sm h-9 rounded-md bg-[#111] border text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50 transition ${
    error || isInPast() ? "border-red-500/50" : "border-[#333]"
  }`;

  return (
    <div>
      {label && (
        <label className="text-xs text-[#aaa] mb-1 block">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
      )}
      <div className="flex gap-2">
        {/* Date Input - with accessibility attributes (PHASE 2) */}
        <div className="flex-1">
          <input
            type="text"
            value={dateValue}
            onChange={handleDateChange}
            placeholder="DD/MM/YYYY"
            maxLength={10}
            inputMode="numeric"
            autoComplete="off"
            aria-label={label ? `${label} date in format day month year` : "Date in format day month year"}
            className={`${inputClass} w-full font-mono`}
          />
        </div>
        
        {/* Time Input - with accessibility attributes (PHASE 2) */}
        <div className="w-24">
          <input
            type="text"
            value={timeValue}
            onChange={handleTimeChange}
            placeholder="HH:MM"
            maxLength={5}
            inputMode="numeric"
            autoComplete="off"
            aria-label={label ? `${label} time in format hours minutes` : "Time in format hours minutes"}
            className={`${inputClass} w-full font-mono text-center`}
          />
        </div>
      </div>
      
      {isInPast() && (
        <p className="text-[10px] text-red-400 mt-1">Time must be in the future</p>
      )}
    </div>
  );
}
