"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import { safeRender } from "@/lib/safeRender";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface DriverTrackerProps {
  bookingId: number | string;
  pickupLocation?: { lat: number; lng: number };
  onStatusChange?: (status: string) => void;
}

interface DriverInfo {
  name: string;
  phone: string;
  vehicle: string;
  location?: { lat: number; lng: number };
  etaMinutes?: number;
}

interface StatusResponse {
  success: boolean;
  bookingId: number | string;
  status: string;
  statusLabel: string;
  driver?: DriverInfo;
  error?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const POLL_INTERVAL = 10000; // 10 seconds
const TERMINAL_STATUSES = ["completed", "cancelled", "canceled", "no_show"];

// Initialize Mapbox token
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
  mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function DriverTracker({ 
  bookingId, 
  pickupLocation,
  onStatusChange 
}: DriverTrackerProps) {
  const [status, setStatus] = useState<string>("loading");
  const [statusLabel, setStatusLabel] = useState<string>("Loading...");
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isArrived, setIsArrived] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const driverMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const pickupMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch status from API
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });

      const data: StatusResponse = await res.json();

      if (!data.success) {
        setError(data.error || "Failed to fetch status");
        return;
      }

      setStatus(data.status);
      setStatusLabel(data.statusLabel);
      setDriver(data.driver || null);
      setError(null);

      // Notify parent of status change
      onStatusChange?.(data.status);

      // Check for arrival
      if (data.status === "arrived" && !isArrived) {
        setIsArrived(true);
      }

      // Update driver marker on map
      if (data.driver?.location && mapRef.current) {
        updateDriverMarker(data.driver.location);
      }

      // Stop polling on terminal status
      if (TERMINAL_STATUSES.includes(data.status)) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }

    } catch (err: any) {
      console.error("Status fetch error:", err);
      setError(err.message || "Connection error");
    }
  }, [bookingId, isArrived, onStatusChange]);

  // Update driver marker position
  const updateDriverMarker = useCallback((location: { lat: number; lng: number }) => {
    if (!mapRef.current) return;

    if (driverMarkerRef.current) {
      // Animate marker to new position
      driverMarkerRef.current.setLngLat([location.lng, location.lat]);
    } else {
      // Create driver marker with pulsing gold dot
      const el = document.createElement("div");
      el.className = "driver-marker";
      el.innerHTML = `
        <div class="relative">
          <div class="w-4 h-4 bg-[#d4af37] rounded-full border-2 border-white shadow-lg"></div>
          <div class="absolute inset-0 w-4 h-4 bg-[#d4af37] rounded-full animate-ping opacity-50"></div>
        </div>
      `;

      driverMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([location.lng, location.lat])
        .addTo(mapRef.current);
    }

    // Fit map to show both markers
    if (pickupLocation && driverMarkerRef.current) {
      const bounds = new mapboxgl.LngLatBounds()
        .extend([location.lng, location.lat])
        .extend([pickupLocation.lng, pickupLocation.lat]);

      mapRef.current.fitBounds(bounds, {
        padding: 40,
        maxZoom: 15,
        duration: 1000,
      });
    }
  }, [pickupLocation]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) return;

    const defaultCenter = pickupLocation 
      ? [pickupLocation.lng, pickupLocation.lat] 
      : [-2.13, 49.21]; // Jersey default

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: defaultCenter as [number, number],
      zoom: 13,
      attributionControl: false,
    });

    // Add pickup marker
    if (pickupLocation) {
      const pickupEl = document.createElement("div");
      pickupEl.innerHTML = `
        <div class="w-3 h-3 bg-emerald-500 rounded-full border-2 border-white shadow-lg"></div>
      `;

      pickupMarkerRef.current = new mapboxgl.Marker({ element: pickupEl })
        .setLngLat([pickupLocation.lng, pickupLocation.lat])
        .addTo(mapRef.current);
    }

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [pickupLocation]);

  // Start polling
  useEffect(() => {
    // Initial fetch
    fetchStatus();

    // Set up polling
    pollIntervalRef.current = setInterval(fetchStatus, POLL_INTERVAL);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchStatus]);

  // Arrival alert effect
  useEffect(() => {
    if (isArrived) {
      // Could add sound notification here
    }
  }, [isArrived]);

  // Don't render if in terminal state
  if (TERMINAL_STATUSES.includes(status)) {
    return null;
  }

  return (
    <div className="bg-[#1a1a1a] rounded-lg border border-[#333] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#333] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            status === "arrived" ? "bg-emerald-500" : "bg-[#d4af37]"
          } animate-pulse`} />
          <span className="text-xs text-[#888] uppercase tracking-wider font-semibold">
            Driver Tracking
          </span>
        </div>
        <span className="text-xs text-[#d4af37] font-medium">{statusLabel}</span>
      </div>

      {/* Arrival Alert */}
      {isArrived && (
        <div className="px-4 py-3 bg-emerald-500/10 border-b border-emerald-500/30 flex items-center gap-2">
          <svg className="w-5 h-5 text-emerald-400 animate-bounce" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span className="text-sm text-emerald-400 font-medium">Your driver has arrived!</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="px-4 py-3 bg-red-500/10 border-b border-red-500/30">
          <p className="text-sm text-red-400">{safeRender(error)}</p>
        </div>
      )}

      {/* Mini Map */}
      {process.env.NEXT_PUBLIC_MAPBOX_TOKEN && (
        <div 
          ref={mapContainerRef} 
          className="h-32 w-full"
          style={{ minHeight: "128px" }}
        />
      )}

      {/* Driver Info */}
      {driver && (
        <div className="p-4 space-y-3">
          {/* Driver Name & Vehicle */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#d4af37]/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-[#d4af37]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#f5f5f5] font-medium truncate">{driver.name}</p>
              <p className="text-xs text-[#888] truncate">{driver.vehicle}</p>
            </div>
          </div>

          {/* ETA */}
          {driver.etaMinutes !== undefined && driver.etaMinutes > 0 && (
            <div className="flex items-center justify-between p-3 bg-[#111] rounded-lg">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#d4af37]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="text-xs text-[#888]">Estimated arrival</span>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-[#d4af37]">{driver.etaMinutes}</span>
                <span className="text-xs text-[#888] ml-1">min</span>
              </div>
            </div>
          )}

          {/* Already here */}
          {driver.etaMinutes === 0 && (
            <div className="flex items-center justify-center gap-2 p-3 bg-emerald-500/10 rounded-lg">
              <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="text-sm text-emerald-400 font-medium">Driver is here</span>
            </div>
          )}

          {/* Call Driver Button */}
          {driver.phone && (
            <a
              href={`tel:${driver.phone}`}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-[#d4af37] text-[#d4af37] hover:bg-[#d4af37]/10 transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              Call Driver
            </a>
          )}
        </div>
      )}

      {/* Loading State */}
      {!driver && !error && status === "loading" && (
        <div className="p-4 flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-[#d4af37]/30 border-t-[#d4af37] rounded-full animate-spin" />
          <span className="text-sm text-[#888]">Finding your driver...</span>
        </div>
      )}

      {/* Waiting for assignment */}
      {!driver && !error && (status === "requested" || status === "pending") && (
        <div className="p-4 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#d4af37]/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-[#d4af37] animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <p className="text-sm text-[#888]">Looking for available drivers...</p>
          <p className="text-xs text-[#666] mt-1">This usually takes 1-2 minutes</p>
        </div>
      )}
    </div>
  );
}




















