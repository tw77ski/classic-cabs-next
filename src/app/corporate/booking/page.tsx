"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import MapPreview from "../../components/MapPreview";
import BookingForm, { CorporateSession } from "./BookingForm";
import AccountHistory from "./AccountHistory";

const SESSION_API = "/api/corporate/auth/session";

interface RouteData {
  geometry: GeoJSON.LineString;
  distance: number;
  duration: number;
}

interface MapCoords {
  pickup: { lat: number; lng: number } | null;
  dropoff: { lat: number; lng: number } | null;
  stops: { lat: number; lng: number }[];
}

export default function CorporateBookingPage() {
  const router = useRouter();

  // Session state
  const [session, setSession] = useState<CorporateSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  // Route and map state
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [coords, setCoords] = useState<MapCoords>({ pickup: null, dropoff: null, stops: [] });

  // History refresh trigger
  const [historyRefresh, setHistoryRefresh] = useState(0);

  // Load session on mount
  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch(SESSION_API);
        const data = await res.json();

        if (!data.authenticated || !data.user || !data.company) {
          router.push("/corporate/login");
          return;
        }

        setSession({
          user: data.user,
          company: data.company,
        });
      } catch (err) {
        console.error("Failed to load session:", err);
        router.push("/corporate/login");
      } finally {
        setSessionLoading(false);
      }
    }

    loadSession();
  }, [router]);

  // Handlers
  const handleRouteChange = useCallback((route: RouteData | null) => {
    setRouteData(route);
  }, []);

  const handleCoordsChange = useCallback((newCoords: MapCoords) => {
    setCoords(newCoords);
  }, []);

  const handleBookingComplete = useCallback(() => {
    setHistoryRefresh((prev) => prev + 1);
  }, []);

  // Loading state
  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#ffd55c]/30 border-t-[#ffd55c] rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-[#f5f5f5]">New Booking</h2>
        <div className="text-right text-xs">
          <span className="text-[#ffd55c] font-medium">{session.company.name}</span>
          <span className="text-[#444] mx-2">•</span>
          <span className="text-muted">{session.user.name}</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 lg:gap-4">
        {/* LEFT COLUMN - Booking Form */}
        <div className="lg:col-span-3 space-y-3 max-w-lg">
          {/* Mobile Map Preview */}
          <div className="lg:hidden">
            {(coords.pickup || coords.dropoff) && (
              <div className="rounded-xl overflow-hidden border border-border h-[180px]">
                <MapPreview
                  pickup={coords.pickup}
                  stops={coords.stops}
                  dropoff={coords.dropoff}
                  route={routeData?.geometry}
                  distance={routeData?.distance}
                  duration={routeData?.duration}
                />
              </div>
            )}
          </div>

          {/* Booking Form */}
          <BookingForm
            session={session}
            onBookingComplete={handleBookingComplete}
            onRouteChange={handleRouteChange}
            onCoordsChange={handleCoordsChange}
          />
        </div>

        {/* RIGHT COLUMN - Map & History */}
        <div className="lg:col-span-2">
          <div className="hidden lg:block sticky top-4 space-y-4">
            {/* Map Container */}
            <div className="rounded-xl overflow-hidden border border-border aspect-square bg-surface">
              <MapPreview
                pickup={coords.pickup}
                stops={coords.stops}
                dropoff={coords.dropoff}
                route={routeData?.geometry}
                distance={routeData?.distance}
                duration={routeData?.duration}
              />
            </div>

            {/* Route Summary */}
            {routeData && (
              <div className="p-4 bg-surface border border-border rounded-xl">
                <h4 className="text-[10px] uppercase tracking-widest text-muted mb-3">
                  Route Summary
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted">Distance</p>
                    <p className="text-lg font-semibold text-[#f5f5f5]">
                      {(routeData.distance / 1609.34).toFixed(1)} mi
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Duration</p>
                    <p className="text-lg font-semibold text-[#f5f5f5]">
                      {Math.round(routeData.duration / 60)} min
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Account History */}
            <AccountHistory
              accountId={session.company.taxiCallerAccountId}
              companyName={session.company.name}
              refreshTrigger={historyRefresh}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
