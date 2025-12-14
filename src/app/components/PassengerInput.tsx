// Passenger Input with autocomplete from recent passengers
// FEATURE_VERSION: 1.0

"use client";

import { useState, useEffect, useRef } from "react";
import { getRecentPassengers, RecentPassenger, searchPassengers } from "@/lib/recentPassengers";

interface PassengerInputProps {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onSelectPassenger?: (passenger: RecentPassenger) => void;
}

export default function PassengerInput({
  firstName,
  lastName,
  phone,
  email,
  onFirstNameChange,
  onLastNameChange,
  onPhoneChange,
  onEmailChange,
  onSelectPassenger,
}: PassengerInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<RecentPassenger[]>([]);
  const [recentPassengers, setRecentPassengers] = useState<RecentPassenger[]>([]);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load recent passengers on mount
  useEffect(() => {
    setRecentPassengers(getRecentPassengers());
  }, []);

  // Update suggestions based on input
  useEffect(() => {
    if (focusedField === "firstName" && firstName.length >= 2) {
      const results = searchPassengers(firstName);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } else if (focusedField === "lastName" && lastName.length >= 2) {
      const results = searchPassengers(lastName);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } else if (focusedField === "firstName" && firstName.length === 0 && recentPassengers.length > 0) {
      // Show recent passengers when field is empty and focused
      setSuggestions(recentPassengers.slice(0, 5));
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [firstName, lastName, focusedField, recentPassengers]);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
        setFocusedField(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelectPassenger(passenger: RecentPassenger) {
    onFirstNameChange(passenger.firstName);
    onLastNameChange(passenger.lastName);
    onPhoneChange(passenger.phone);
    if (passenger.email) {
      onEmailChange(passenger.email);
    }
    setShowSuggestions(false);
    setFocusedField(null);
    onSelectPassenger?.(passenger);
  }

  return (
    <div ref={containerRef} className="relative">
      <p className="text-[10px] uppercase tracking-widest text-[#666] mb-3">Passenger Details</p>
      
      {/* Recent Passengers Quick Select (shown when no input) */}
      {recentPassengers.length > 0 && !firstName && !lastName && (
        <div className="mb-3 p-2 bg-[#ffd55c]/5 border border-[#ffd55c]/20 rounded-lg">
          <p className="text-[10px] text-[#888] mb-2 flex items-center gap-1">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Recent Passengers
          </p>
          <div className="flex flex-wrap gap-2">
            {recentPassengers.slice(0, 4).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectPassenger(p)}
                className="px-2 py-1 text-xs bg-[#111] border border-[#333] rounded hover:border-[#ffd55c]/50 hover:bg-[#ffd55c]/5 text-[#ccc] transition"
              >
                {p.firstName} {p.lastName}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Name Fields */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="relative">
          <label className="text-xs text-[#888] mb-1 block">
            First Name *
          </label>
          <input
            type="text"
            placeholder="First name"
            value={firstName}
            onChange={(e) => onFirstNameChange(e.target.value)}
            onFocus={() => setFocusedField("firstName")}
            className="w-full px-3 py-2 text-sm bg-[#111] border border-[#333] rounded-lg text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50"
          />
          
          {/* Suggestions Dropdown */}
          {showSuggestions && focusedField === "firstName" && suggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-xl max-h-48 overflow-y-auto">
              <div className="px-3 py-1.5 bg-[#151515] border-b border-[#333]">
                <span className="text-[10px] uppercase tracking-wider text-[#666] font-semibold">
                  {firstName.length < 2 ? "Recent Passengers" : "Matching Passengers"}
                </span>
              </div>
              {suggestions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPassenger(p)}
                  className="w-full px-3 py-2 text-left hover:bg-[#252525] border-b border-[#222] last:border-b-0 transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[#f5f5f5]">{p.firstName} {p.lastName}</p>
                      <p className="text-[10px] text-[#666]">{p.phone}</p>
                    </div>
                    <svg className="w-4 h-4 text-[#ffd55c]/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div>
          <label className="text-xs text-[#888] mb-1 block">
            Last Name *
          </label>
          <input
            type="text"
            placeholder="Last name"
            value={lastName}
            onChange={(e) => onLastNameChange(e.target.value)}
            onFocus={() => setFocusedField("lastName")}
            onBlur={() => setTimeout(() => setFocusedField(null), 200)}
            className="w-full px-3 py-2 text-sm bg-[#111] border border-[#333] rounded-lg text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50"
          />
        </div>
      </div>

      {/* Phone & Email Fields */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-[#888] mb-1 block">
            Phone *
          </label>
          <input
            type="tel"
            placeholder="+447700123456"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-[#111] border border-[#333] rounded-lg text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50"
          />
        </div>
        <div>
          <label className="text-xs text-[#888] mb-1 block">
            Email (Optional)
          </label>
          <input
            type="email"
            placeholder="passenger@email.com"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-[#111] border border-[#333] rounded-lg text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50"
          />
        </div>
      </div>
    </div>
  );
}

