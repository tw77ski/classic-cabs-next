"use client";

import { useMemo } from "react";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface TimelineProps {
  status: string;
}

interface TimelineStep {
  id: string;
  label: string;
  icon: React.ReactNode;
  statuses: string[]; // TaxiCaller statuses that map to this step
}

// =============================================================================
// TIMELINE STEPS
// =============================================================================

const TIMELINE_STEPS: TimelineStep[] = [
  {
    id: "requested",
    label: "Requested",
    statuses: ["pending", "requested", "new"],
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    id: "assigned",
    label: "Driver Assigned",
    statuses: ["assigned", "accepted", "confirmed"],
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    id: "on_way",
    label: "On The Way",
    statuses: ["dispatched", "on_way", "en_route", "driving"],
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.9 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8" />
        <circle cx="7" cy="17" r="2" />
        <circle cx="17" cy="17" r="2" />
      </svg>
    ),
  },
  {
    id: "arrived",
    label: "Arrived",
    statuses: ["arrived", "waiting", "at_pickup"],
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
  {
    id: "completed",
    label: "Completed",
    statuses: ["completed", "done", "finished", "dropped_off"],
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
];

// =============================================================================
// COMPONENT
// =============================================================================

export default function BookingTimeline({ status }: TimelineProps) {
  // Determine current step index based on status
  const currentStepIndex = useMemo(() => {
    const normalizedStatus = status?.toLowerCase() || "";
    
    // Check for cancelled status
    if (normalizedStatus === "cancelled" || normalizedStatus === "canceled") {
      return -1; // Special case for cancelled
    }

    // Find matching step
    for (let i = TIMELINE_STEPS.length - 1; i >= 0; i--) {
      if (TIMELINE_STEPS[i].statuses.includes(normalizedStatus)) {
        return i;
      }
    }

    return 0; // Default to first step
  }, [status]);

  const isCancelled = status?.toLowerCase() === "cancelled" || status?.toLowerCase() === "canceled";

  return (
    <div className="py-4">
      {/* Cancelled State */}
      {isCancelled ? (
        <div className="flex items-center justify-center gap-2 py-4">
          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M15 9l-6 6M9 9l6 6" />
            </svg>
          </div>
          <span className="text-red-400 font-medium">Booking Cancelled</span>
        </div>
      ) : (
        /* Timeline Steps */
        <div className="relative">
          {/* Progress Line Background */}
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-[#333]" />
          
          {/* Progress Line Active */}
          <div 
            className="absolute top-4 left-4 h-0.5 bg-gradient-to-r from-[#d4af37] to-[#ffd55c] transition-all duration-500 ease-out"
            style={{ 
              width: currentStepIndex >= 0 
                ? `calc(${(currentStepIndex / (TIMELINE_STEPS.length - 1)) * 100}% - 8px)` 
                : "0%" 
            }}
          />

          {/* Steps */}
          <div className="relative flex justify-between">
            {TIMELINE_STEPS.map((step, index) => {
              const isActive = index <= currentStepIndex;
              const isCurrent = index === currentStepIndex;

              return (
                <div 
                  key={step.id}
                  className="flex flex-col items-center"
                >
                  {/* Step Circle */}
                  <div
                    className={`
                      relative z-10 w-8 h-8 rounded-full flex items-center justify-center
                      transition-all duration-300 ease-out
                      ${isActive 
                        ? "bg-[#d4af37] text-[#111]" 
                        : "bg-[#222] text-[#666] border border-[#444]"
                      }
                      ${isCurrent ? "ring-4 ring-[#d4af37]/30 animate-pulse" : ""}
                    `}
                  >
                    {step.icon}
                    
                    {/* Pulse animation for current step */}
                    {isCurrent && (
                      <span className="absolute inset-0 rounded-full bg-[#d4af37]/20 animate-ping" />
                    )}
                  </div>

                  {/* Step Label */}
                  <span
                    className={`
                      mt-2 text-[10px] sm:text-xs font-medium text-center
                      transition-colors duration-300
                      ${isActive ? "text-[#d4af37]" : "text-[#666]"}
                      ${isCurrent ? "font-semibold" : ""}
                    `}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}















