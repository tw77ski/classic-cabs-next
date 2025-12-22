// NOTE: Responsive desktop layout applied here — ask to revert if needed.
// LAYOUT_VERSION: 2.0 — Two-column responsive layout
// Previous version: Single column max-w-lg
// FEATURE: Use My Location, Return Suggestion, Recent Addresses (v1.0)
// FEATURE: Pre-fill Rider Name & Phone (v1.0) — stores in localStorage after booking
// FEATURE: Luxury Brand Enhancements (v1.0) — gold focus glow, success chime, vignette, smooth transitions
// FEATURE: Booking Timeline & Driver Tracker (v1.0) — real-time status updates

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import JourneyForm from "./components/JourneyForm";
import MapPreview from "./components/MapPreview";
import BookingTimeline from "./components/BookingTimeline";
import DriverTracker from "./components/DriverTracker";
import { createBooking } from "./lib/api";
import { calculateFare, type FareResult, type VehicleType, LUXURY_HOURLY_RATE } from "@/lib/tariffs";
import { safeRender } from "@/lib/safeRender";

interface Location {
  address: string;
  lat: number | null;
  lng: number | null;
}

interface EstimateResult {
  fare: number;
  distance: number;
  duration: number;
  tariffName: string | null;
  isLuxury: boolean;
  breakdown: FareResult["breakdown"];
  error?: string;
}

interface BookingResult {
  booking_id?: string;
  status?: string;
  error?: string;
}

interface RouteData {
  geometry: GeoJSON.LineString;
  distance: number;
  duration: number;
}

export default function Page() {
  // Journey state
  const [pickup, setPickup] = useState<Location>({ address: "", lat: null, lng: null });
  const [dropoff, setDropoff] = useState<Location>({ address: "", lat: null, lng: null });
  const [stops, setStops] = useState<Location[]>([]);

  // Passenger state
  const [passenger, setPassenger] = useState({
    name: "",
    phone: "",
    email: "",
  });
  const [seats, setSeats] = useState(1);
  const [bags, setBags] = useState(0);

  // Vehicle type state
  const [vehicleType, setVehicleType] = useState<VehicleType>("standard");

  // Notes for driver
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);

  // Flight / Airport pickup (optional, no API tracking)
  const [flightNumber, setFlightNumber] = useState("");
  const [airportPickup, setAirportPickup] = useState(false);
  const [airportNotes, setAirportNotes] = useState("");

  // Timing state
  const [asap, setAsap] = useState(true);
  const [pickupTime, setPickupTime] = useState<string>("");
  const [returnTrip, setReturnTrip] = useState(false);
  const [returnTime, setReturnTime] = useState<string>("");

  // Results state
  const [fareResult, setFareResult] = useState<EstimateResult | null>(null);
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Booking ID for cancellation
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [bookingStatus, setBookingStatus] = useState<string | null>(null);

  // Standalone cancel form
  const [cancelBookingIdInput, setCancelBookingIdInput] = useState("");
  const [isCancellingStandalone, setIsCancellingStandalone] = useState(false);
  const [standaloneCancelResult, setStandaloneCancelResult] = useState<{
    success?: boolean;
    message?: string;
    error?: string;
  } | null>(null);

  // Route data for map
  const [routeData, setRouteData] = useState<RouteData | null>(null);

  // Return suggestion - dismissed state
  const [returnSuggestionDismissed, setReturnSuggestionDismissed] = useState(false);

  // Pre-filled rider info state
  const [hasPrefilledRider, setHasPrefilledRider] = useState(false);
  const [clearingRiderInfo, setClearingRiderInfo] = useState(false);

  // Calculate if we should show return suggestion
  const showReturnSuggestion = useMemo((): boolean => {
    // Don't show if already dismissed or return trip enabled
    if (returnSuggestionDismissed || returnTrip) return false;
    
    // Must have valid pickup and dropoff
    if (!pickup.lat || !pickup.lng || !dropoff.lat || !dropoff.lng) return false;
    
    // Don't show if pickup and dropoff are the same
    if (pickup.address === dropoff.address) return false;
    
    // Check if dropoff is an airport or notable location
    const dropoffLower = dropoff.address.toLowerCase();
    const isAirportDropoff = dropoffLower.includes("airport") || dropoffLower.includes("egjj");
    const isBeachDropoff = dropoffLower.includes("st brelade") || dropoffLower.includes("brelade's bay");
    
    // Check if scheduled journey
    const isScheduled = !asap;
    
    // Check distance (if route data available, show if > 2km)
    const isLongTrip = routeData ? routeData.distance > 2000 : false;
    
    // Show suggestion if any condition is met
    return isAirportDropoff || isBeachDropoff || isScheduled || isLongTrip;
  }, [pickup, dropoff, returnTrip, returnSuggestionDismissed, asap, routeData]);

  // Handle accepting return suggestion
  function handleAcceptReturnSuggestion() {
    setReturnTrip(true);
    setReturnSuggestionDismissed(true);
    
    // Scroll to the When section smoothly
    setTimeout(() => {
      document.getElementById("when-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }

  // Field validation state
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    phone?: string;
  }>({});
  const [touchedFields, setTouchedFields] = useState<{
    name?: boolean;
    phone?: boolean;
  }>({});

  // Phone validation regex - must start with + and country code, 7-16 chars total
  const phoneRegex = /^\+[1-9]\d{6,15}$/;

  // Validate individual fields
  function validateName(value: string): string | undefined {
    if (!value.trim()) {
      return "Name is required.";
    }
    return undefined;
  }

  function validatePhone(value: string): string | undefined {
    if (!value.trim()) {
      return "Phone number is required.";
    }
    // Remove spaces for validation
    const cleanPhone = value.replace(/\s/g, "");
    if (!phoneRegex.test(cleanPhone)) {
      return "Please enter a valid phone number with country code (e.g., +447700123456).";
    }
    return undefined;
  }

  // Handle field blur
  function handleNameBlur() {
    setTouchedFields(prev => ({ ...prev, name: true }));
    setFieldErrors(prev => ({ ...prev, name: validateName(passenger.name) }));
  }

  function handlePhoneBlur() {
    setTouchedFields(prev => ({ ...prev, phone: true }));
    setFieldErrors(prev => ({ ...prev, phone: validatePhone(passenger.phone) }));
  }

  // Restore booking ID from sessionStorage on mount
  useEffect(() => {
    const savedBookingId = sessionStorage.getItem("booking_id");
    if (savedBookingId) {
      setBookingId(savedBookingId);
    }
  }, []);

  // Pre-fill rider info from localStorage on mount
  useEffect(() => {
    try {
      const savedRiderInfo = localStorage.getItem("rider_info");
      if (savedRiderInfo) {
        const parsed = JSON.parse(savedRiderInfo);
        if (parsed && typeof parsed === "object") {
          const name = parsed.name || "";
          const phone = parsed.phone || "";
          
          // Only pre-fill if we have valid data
          if (name.trim() || phone.trim()) {
            setPassenger(prev => ({
              ...prev,
              name: name.trim(),
              phone: phone.trim(),
            }));
            setHasPrefilledRider(true);
          }
        }
      }
    } catch (error) {
      // Silently ignore corrupted localStorage data
      console.warn("Failed to load saved rider info:", error);
    }
  }, []);

  // Save rider info to localStorage after successful booking
  function saveRiderInfo() {
    try {
      const name = passenger.name.trim();
      const phone = passenger.phone.trim();
      
      // Only save if we have valid data
      if (name && phone && phone.startsWith("+")) {
        localStorage.setItem("rider_info", JSON.stringify({ name, phone }));
      }
    } catch (error) {
      console.warn("Failed to save rider info:", error);
    }
  }

  // Clear saved rider info
  function handleClearRiderInfo() {
    setClearingRiderInfo(true);
    
    // Animate out, then clear
    setTimeout(() => {
      try {
        localStorage.removeItem("rider_info");
      } catch (error) {
        console.warn("Failed to clear rider info:", error);
      }
      
      setPassenger(prev => ({ ...prev, name: "", phone: "" }));
      setHasPrefilledRider(false);
      setClearingRiderInfo(false);
      setTouchedFields({});
      setFieldErrors({});
    }, 200);
  }

  // Play success chime on booking confirmation using Web Audio API
  // Creates a soft, elegant two-tone chime without external files
  function playSuccessChime() {
    try {
      // Check for AudioContext support
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      
      const audioCtx = new AudioContext();
      const masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.15; // Low volume for elegance
      masterGain.connect(audioCtx.destination);
      
      // First tone (C5 - 523Hz)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.frequency.value = 523;
      osc1.type = "sine";
      gain1.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
      osc1.connect(gain1);
      gain1.connect(masterGain);
      osc1.start(audioCtx.currentTime);
      osc1.stop(audioCtx.currentTime + 0.5);
      
      // Second tone (E5 - 659Hz) - slightly delayed for musical chime
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.frequency.value = 659;
      osc2.type = "sine";
      gain2.gain.setValueAtTime(0.001, audioCtx.currentTime);
      gain2.gain.setValueAtTime(0.25, audioCtx.currentTime + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
      osc2.connect(gain2);
      gain2.connect(masterGain);
      osc2.start(audioCtx.currentTime + 0.08);
      osc2.stop(audioCtx.currentTime + 0.6);
      
      // Third tone (G5 - 784Hz) - the high resolution note
      const osc3 = audioCtx.createOscillator();
      const gain3 = audioCtx.createGain();
      osc3.frequency.value = 784;
      osc3.type = "sine";
      gain3.gain.setValueAtTime(0.001, audioCtx.currentTime);
      gain3.gain.setValueAtTime(0.2, audioCtx.currentTime + 0.16);
      gain3.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
      osc3.connect(gain3);
      gain3.connect(masterGain);
      osc3.start(audioCtx.currentTime + 0.16);
      osc3.stop(audioCtx.currentTime + 0.8);
      
      // Clean up after sound completes
      setTimeout(() => {
        audioCtx.close().catch(() => {});
      }, 1000);
    } catch (error) {
      // Gracefully fail if Audio is not supported or blocked
    }
  }

  // Fetch route when coordinates change
  const fetchRoute = useCallback(async () => {
    if (!pickup.lat || !pickup.lng || !dropoff.lat || !dropoff.lng) {
      setRouteData(null);
      return;
    }

    try {
      const validStops = stops.filter(s => s.lat && s.lng);
      
      const res = await fetch("/api/route-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup: { lat: pickup.lat, lng: pickup.lng },
          stops: validStops.map(s => ({ lat: s.lat, lng: s.lng })),
          dropoff: { lat: dropoff.lat, lng: dropoff.lng },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setRouteData(data);
      } else {
        console.warn("Route fetch failed, continuing without route preview");
        setRouteData(null);
      }
    } catch (err) {
      console.warn("Route fetch error:", err);
      setRouteData(null);
    }
  }, [pickup.lat, pickup.lng, dropoff.lat, dropoff.lng, stops]);

  // Debounce route fetching
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRoute();
    }, 500);

    return () => clearTimeout(timer);
  }, [fetchRoute]);

  // Validation
  function validateForm(requireRider: boolean = false): string | null {
    if (!pickup.lat || !pickup.lng) {
      return "Please select a valid pickup location from the suggestions";
    }
    if (!dropoff.lat || !dropoff.lng) {
      return "Please select a valid drop-off location from the suggestions";
    }
    if (!asap && !pickupTime) {
      return "Please select a pickup time for scheduled rides";
    }
    if (returnTrip && !returnTime) {
      return "Please select a return pickup date and time";
    }
    if (requireRider) {
      // Validate name
      const nameError = validateName(passenger.name);
      if (nameError) {
        setTouchedFields(prev => ({ ...prev, name: true }));
        setFieldErrors(prev => ({ ...prev, name: nameError }));
        // Scroll to passenger section
        document.getElementById("passenger-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return nameError;
      }
      
      // Validate phone
      const phoneError = validatePhone(passenger.phone);
      if (phoneError) {
        setTouchedFields(prev => ({ ...prev, phone: true }));
        setFieldErrors(prev => ({ ...prev, phone: phoneError }));
        // Scroll to passenger section
        document.getElementById("passenger-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return phoneError;
      }
    }
    return null;
  }

  // Validate all rider fields and update state
  function validateRiderFields(): boolean {
    const nameError = validateName(passenger.name);
    const phoneError = validatePhone(passenger.phone);
    
    setTouchedFields({ name: true, phone: true });
    setFieldErrors({ name: nameError, phone: phoneError });
    
    if (nameError || phoneError) {
      document.getElementById("passenger-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    return true;
  }

  // Format return time for display
  function formatReturnTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Get fare estimate
  async function handleEstimate() {
    const validationError = validateForm(false);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsLoading(true);
    setFareResult(null);

    try {
      let route = routeData;
      
      if (!route) {
        const validStops = stops.filter(s => s.lat && s.lng);
        const res = await fetch("/api/route-path", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pickup: { lat: pickup.lat, lng: pickup.lng },
            stops: validStops.map(s => ({ lat: s.lat, lng: s.lng })),
            dropoff: { lat: dropoff.lat, lng: dropoff.lng },
          }),
        });

        if (!res.ok) {
          const errorData = await res.json();
          setError(errorData.error || "Could not calculate route");
          return;
        }

        route = await res.json();
        setRouteData(route);
      }

      if (!route) {
        setError("Could not calculate route");
        return;
      }

      const rideDate = !asap && pickupTime ? new Date(pickupTime) : new Date();
      const result = calculateFare(route.distance, route.duration, seats, false, rideDate, vehicleType);
      
      setFareResult({
        fare: result.fare,
        distance: route.distance,
        duration: route.duration,
        tariffName: result.tariff?.name || null,
        isLuxury: result.isLuxury,
        breakdown: result.breakdown,
      });
    } catch (err: any) {
      setError(err.message || "Failed to calculate estimate");
    } finally {
      setIsLoading(false);
    }
  }

  // Create booking
  async function handleBooking() {
    // Validate rider fields first
    if (!validateRiderFields()) {
      return;
    }
    
    const validationError = validateForm(true);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsLoading(true);
    setBookingResult(null);

    try {
      const bookingWhen = { 
        type: asap ? "asap" as const : "scheduled" as const, 
        time: !asap && pickupTime ? new Date(pickupTime).toISOString() : undefined 
      };

      // Build combined notes with flight/airport info and return time
      const combinedNotes = [
        flightNumber ? `Flight Number: ${flightNumber}` : "",
        airportPickup ? `Airport Pickup: Yes` : "",
        airportPickup && airportNotes ? airportNotes : "",
        returnTrip && returnTime ? `Return Pickup: ${formatReturnTime(returnTime)}` : "",
        notes || "",
      ].filter(Boolean).join("\n").trim();

      const result = await createBooking({
        pickup,
        dropoff,
        stops: stops.filter(s => s.lat && s.lng),
        passengers: seats,
        luggage: bags,
        when: bookingWhen,
        return_trip: returnTrip,
        return_time: returnTrip && returnTime ? new Date(returnTime).toISOString() : undefined,
        rider: {
          name: passenger.name,
          phone: passenger.phone,
          email: passenger.email,
        },
        vehicleType,
        notes: combinedNotes,
      });

      setBookingResult(result);
      
      if (result.booking_id) {
        setBookingId(result.booking_id);
        sessionStorage.setItem("booking_id", result.booking_id);
        
        // Save rider info for next time (only after successful booking)
        saveRiderInfo();
        
        // Play success chime (gracefully fails silently if blocked)
        playSuccessChime();
      }
    } catch (err: any) {
      setError(err.message || "Failed to create booking");
    } finally {
      setIsLoading(false);
    }
  }

  // Cancel booking handler (for current booking)
  async function handleCancelBooking() {
    if (!bookingId) return;

    const confirmed = window.confirm(
      "Are you sure you want to cancel this booking? This action cannot be undone."
    );
    
    if (!confirmed) return;

    setIsCancelling(true);
    setError(null);

    try {
      const res = await fetch("/api/cancel", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });

      const data = await res.json();

      if (data?.success || data?.status === "cancelled") {
        setBookingStatus("cancelled");
        sessionStorage.removeItem("booking_id");
      } else {
        setError(data?.error || "Failed to cancel booking");
      }
    } catch (err: any) {
      setError(err.message || "Failed to cancel booking");
    } finally {
      setIsCancelling(false);
    }
  }

  // Standalone cancel handler (for any booking ID)
  async function handleStandaloneCancel() {
    if (!cancelBookingIdInput.trim()) {
      setStandaloneCancelResult({ error: "Please enter a booking ID" });
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to cancel booking ${cancelBookingIdInput}? This action cannot be undone.`
    );
    
    if (!confirmed) return;

    setIsCancellingStandalone(true);
    setStandaloneCancelResult(null);

    try {
      const res = await fetch("/api/cancel", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: cancelBookingIdInput.trim() }),
      });

      const data = await res.json();

      if (data?.success || data?.status === "cancelled") {
        setStandaloneCancelResult({
          success: true,
          message: `Booking ${cancelBookingIdInput} has been cancelled successfully.`,
        });
        setCancelBookingIdInput("");
        
        // If this was the current session's booking, update state
        if (cancelBookingIdInput === bookingId) {
          setBookingStatus("cancelled");
          sessionStorage.removeItem("booking_id");
        }
      } else {
        setStandaloneCancelResult({
          error: data?.error || "Failed to cancel booking",
        });
      }
    } catch (err: any) {
      setStandaloneCancelResult({
        error: err.message || "Failed to cancel booking",
      });
    } finally {
      setIsCancellingStandalone(false);
    }
  }

  // Prepare coordinates for map
  const pickupCoords = pickup.lat && pickup.lng ? { lat: pickup.lat, lng: pickup.lng } : null;
  const dropoffCoords = dropoff.lat && dropoff.lng ? { lat: dropoff.lat, lng: dropoff.lng } : null;
  const stopCoords = stops
    .filter(s => s.lat && s.lng)
    .map(s => ({ lat: s.lat!, lng: s.lng! }));

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0d0f0e' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0d0f0e]/95 backdrop-blur-sm border-b border-[#222] px-4 py-3">
        <div className="max-w-xl sm:max-w-2xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto flex items-center justify-center gap-3">
          <svg
            className="w-7 h-7 text-[#ffd55c]"
            viewBox="0 0 64 64"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Outer C */}
            <path d="M44 12c-6-6-18-6-26 2s-10 22-2 30 20 10 28 2" />
            {/* Inner C */}
            <path d="M40 20c-4-4-12-4-18 2s-6 16-2 20 14 6 20 0" />
            {/* Mercedes V-Class silhouette */}
            <path d="M20 38h24l4 3v3H16v-3l4-3z" />
            <circle cx="24" cy="44" r="3" />
            <circle cx="40" cy="44" r="3" />
          </svg>
          <h1 className="text-xl font-semibold text-[#f5f5f5] tracking-tight">Classic Cabs</h1>
        </div>
      </header>

      {/* RESPONSIVE LAYOUT: max-w-xl on mobile → max-w-6xl on xl screens */}
      <div className="px-4 py-4 sm:py-6 max-w-xl sm:max-w-2xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto">
        
        {/* Error Message - Full Width */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-3 text-red-400 text-sm flex items-center gap-2 mb-4 sm:mb-6">
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            {safeRender(error)}
          </div>
        )}

        {/* TWO-COLUMN GRID on lg+ screens, single column on mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
          
          {/* LEFT COLUMN: Form sections */}
          <div className="space-y-3 sm:space-y-4">
            
            {/* ===== SECTION 1: Journey Details ===== */}
            <section className="bg-[#1b1b1b] p-4 sm:p-5 rounded-lg border border-[#333]">
              <h2 className="text-[10px] uppercase tracking-widest text-[#888] font-semibold mb-3">Journey Details</h2>
              <JourneyForm
                pickup={pickup}
                dropoff={dropoff}
                setPickup={setPickup}
                setDropoff={setDropoff}
                stops={stops}
                setStops={setStops}
                showReturnSuggestion={showReturnSuggestion}
                onAcceptReturnSuggestion={handleAcceptReturnSuggestion}
              />
            </section>

            {/* ===== Map Preview (Mobile only - shown in left column) ===== */}
            <div className="lg:hidden">
              {(pickupCoords || dropoffCoords || stopCoords.length > 0) && (
                <section className="rounded-lg overflow-hidden border border-[#333]">
                  <MapPreview
                    pickup={pickupCoords}
                    stops={stopCoords}
                    dropoff={dropoffCoords}
                    route={routeData?.geometry}
                    distance={routeData?.distance}
                    duration={routeData?.duration}
                  />
                </section>
              )}
            </div>

            {/* ===== SECTION 3: When ===== */}
            <section id="when-section" className="bg-[#1b1b1b] p-4 sm:p-5 rounded-lg border border-[#333]">
              <h2 className="text-[10px] uppercase tracking-widest text-[#888] font-semibold mb-3">When</h2>
              
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setAsap(true)}
                  className={`flex-1 p-2 text-sm rounded-md border transition ${
                    asap ? 'border-[#ffd55c] bg-[#ffd55c]/10 text-[#ffd55c]' : 'border-[#333] text-[#888]'
                  }`}
                >
                  ASAP
                </button>
                <button
                  type="button"
                  onClick={() => setAsap(false)}
                  className={`flex-1 p-2 text-sm rounded-md border transition ${
                    !asap ? 'border-[#ffd55c] bg-[#ffd55c]/10 text-[#ffd55c]' : 'border-[#333] text-[#888]'
                  }`}
                >
                  Schedule
                </button>
              </div>

              {!asap && (
                <div>
                  <label className="text-xs text-[#aaa] mb-1 block">Pickup Time</label>
                  <input
                    type="datetime-local"
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                    className="w-full p-2 text-sm h-9 rounded-md bg-[#111] border border-[#333] text-[#f5f5f5] focus:outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/30 focus:shadow-[0_0_12px_rgba(212,175,55,0.35)] transition-all duration-300 ease-out"
                  />
                </div>
              )}

              <div className="mt-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="returnTrip"
                  checked={returnTrip}
                  onChange={(e) => setReturnTrip(e.target.checked)}
                  className="w-4 h-4 rounded border-[#333] bg-[#111] text-[#ffd55c] focus:ring-[#ffd55c]/50"
                />
                <label htmlFor="returnTrip" className="text-sm text-[#aaa]">Return trip</label>
              </div>

              {returnTrip && (
                <div className="mt-2">
                  <label className="text-xs text-[#aaa] mb-1 block">
                    Return Pickup Date & Time <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={returnTime}
                    onChange={(e) => setReturnTime(e.target.value)}
                    className={`w-full p-2 text-sm h-9 rounded-md bg-[#111] border ${
                      returnTrip && !returnTime ? 'border-red-500/50' : 'border-[#333]'
                    } text-[#f5f5f5] focus:outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/30 focus:shadow-[0_0_12px_rgba(212,175,55,0.35)] transition-all duration-300 ease-out`}
                  />
                  {returnTrip && !returnTime && (
                    <p className="text-[10px] text-red-400 mt-1">Please select a return pickup date and time</p>
                  )}
                </div>
              )}
            </section>

            {/* ===== SECTION 4: Vehicle Type ===== */}
            <section className="bg-[#1b1b1b] p-4 sm:p-5 rounded-lg border border-[#333]">
              <h2 className="text-[10px] uppercase tracking-widest text-[#888] font-semibold mb-3">Vehicle Type</h2>
              
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVehicleType("standard")}
                  className={`p-3 rounded-lg border transition-all text-left ${
                    vehicleType === "standard"
                      ? "border-[#ffd55c] bg-[#ffd55c]/10"
                      : "border-[#333] hover:border-[#555]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#ffd55c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.9 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8c-.3.5-.1 1.1.4 1.3l.5.2" />
                      <circle cx="7" cy="17" r="2" />
                      <circle cx="17" cy="17" r="2" />
                    </svg>
                    <span className="text-[#f5f5f5] text-sm font-medium">Standard</span>
                  </div>
                  <p className="text-[10px] text-[#666] mt-1">Metered fare</p>
                </button>

                <button
                  type="button"
                  onClick={() => setVehicleType("luxury")}
                  className={`p-3 rounded-lg border transition-all text-left ${
                    vehicleType === "luxury"
                      ? "border-[#ffd55c] bg-[#ffd55c]/10"
                      : "border-[#333] hover:border-[#555]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#ffd55c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z" />
                    </svg>
                    <span className="text-[#f5f5f5] text-sm font-medium">Executive</span>
                  </div>
                  <p className="text-[10px] text-[#666] mt-1">£{LUXURY_HOURLY_RATE}/hour</p>
                </button>
              </div>

              {vehicleType === "luxury" && (
                <div className="mt-2 p-2 bg-[#ffd55c]/10 rounded border border-[#ffd55c]/20 text-xs text-[#ffd55c]">
                  Premium V-Class – Minimum 1 hour
                </div>
              )}
            </section>

            {/* ===== SECTION 5: Passenger Details ===== */}
            <section id="passenger-section" className="bg-[#1b1b1b] p-4 sm:p-5 rounded-lg border border-[#333]">
          <h2 className="text-[10px] uppercase tracking-widest text-[#888] font-semibold mb-3">Passenger Details</h2>
          
          <div className="space-y-2">
            <div>
              <label className="text-xs text-[#aaa] mb-1 block">Name <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={passenger.name}
                onChange={(e) => {
                  setPassenger({ ...passenger, name: e.target.value });
                  // Clear error when user starts typing
                  if (touchedFields.name) {
                    setFieldErrors(prev => ({ ...prev, name: validateName(e.target.value) }));
                  }
                }}
                onBlur={handleNameBlur}
                className={`w-full p-2 text-sm h-9 rounded-md bg-[#111] border text-[#f5f5f5] placeholder-[#555] focus:outline-none transition-all duration-300 ease-out ${
                  touchedFields.name && fieldErrors.name
                    ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/30"
                    : "border-[#333] focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/30 focus:shadow-[0_0_12px_rgba(212,175,55,0.35)]"
                }`}
                placeholder="Your name"
              />
              {touchedFields.name && fieldErrors.name && (
                <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                  {fieldErrors.name}
                </p>
              )}
            </div>
            
            <div>
              <label className="text-xs text-[#aaa] mb-1 block">Phone <span className="text-red-400">*</span></label>
              <input
                type="tel"
                value={passenger.phone}
                onChange={(e) => {
                  setPassenger({ ...passenger, phone: e.target.value });
                  // Clear error when user starts typing
                  if (touchedFields.phone) {
                    setFieldErrors(prev => ({ ...prev, phone: validatePhone(e.target.value) }));
                  }
                }}
                onBlur={handlePhoneBlur}
                className={`w-full p-2 text-sm h-9 rounded-md bg-[#111] border text-[#f5f5f5] placeholder-[#555] focus:outline-none transition-all duration-300 ease-out ${
                  touchedFields.phone && fieldErrors.phone
                    ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/30"
                    : "border-[#333] focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/30 focus:shadow-[0_0_12px_rgba(212,175,55,0.35)]"
                }`}
                placeholder="+447700123456"
              />
              {touchedFields.phone && fieldErrors.phone && (
                <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                  {fieldErrors.phone}
                </p>
              )}
            </div>
            
            <div>
              <label className="text-xs text-[#aaa] mb-1 block">Email</label>
              <input
                type="email"
                value={passenger.email}
                onChange={(e) => setPassenger({ ...passenger, email: e.target.value })}
                className="w-full p-2 text-sm h-9 rounded-md bg-[#111] border border-[#333] text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/30 focus:shadow-[0_0_12px_rgba(212,175,55,0.35)] transition-all duration-300 ease-out"
                placeholder="email@example.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="text-xs text-[#aaa] mb-1 block">Passengers</label>
                <select
                  value={seats}
                  onChange={(e) => setSeats(Number(e.target.value))}
                  className="w-full p-2 text-sm h-9 rounded-md bg-[#111] border border-[#333] text-[#f5f5f5] focus:outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/30 focus:shadow-[0_0_12px_rgba(212,175,55,0.35)] transition-all duration-300 ease-out"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#aaa] mb-1 block">Luggage</label>
                <select
                  value={bags}
                  onChange={(e) => setBags(Number(e.target.value))}
                  className="w-full p-2 text-sm h-9 rounded-md bg-[#111] border border-[#333] text-[#f5f5f5] focus:outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/30 focus:shadow-[0_0_12px_rgba(212,175,55,0.35)] transition-all duration-300 ease-out"
                >
                  {[0, 1, 2, 3, 4, 5].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Flight Number */}
            <div className="pt-3 border-t border-[#333] mt-3">
              <label className="text-xs text-[#aaa] mb-1 block">Flight Number (optional)</label>
              <input
                type="text"
                value={flightNumber}
                onChange={(e) => setFlightNumber(e.target.value.toUpperCase())}
                className="w-full p-2 text-sm h-9 rounded-md bg-[#111] border border-[#333] text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/30 focus:shadow-[0_0_12px_rgba(212,175,55,0.35)] transition-all duration-300 ease-out"
                placeholder="e.g. BA1325"
                maxLength={10}
              />
            </div>

            {/* Airport Pickup checkbox */}
            <div className="flex items-center gap-2 mt-3">
              <input
                type="checkbox"
                id="airportPickup"
                checked={airportPickup}
                onChange={(e) => setAirportPickup(e.target.checked)}
                className="w-4 h-4 rounded border-[#333] bg-[#111] text-[#ffd55c] focus:ring-[#ffd55c]/50"
              />
              <label htmlFor="airportPickup" className="text-sm text-[#aaa]">Airport Pickup</label>
            </div>

            {/* Conditional airport notes */}
            {airportPickup && (
              <div className="mt-2">
                <label className="text-xs text-[#aaa] mb-1 block">Airport Notes</label>
                <textarea
                  value={airportNotes}
                  onChange={(e) => setAirportNotes(e.target.value)}
                  className="w-full p-2 text-sm rounded-md bg-[#111] border border-[#333] text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/30 focus:shadow-[0_0_12px_rgba(212,175,55,0.35)] transition-all duration-300 ease-out resize-none h-16"
                  placeholder="Add arrival details or pickup instructions..."
                  maxLength={200}
                />
              </div>
            )}

            {/* Clear saved details link - only shown if rider info was pre-filled */}
            {hasPrefilledRider && (
              <div 
                className={`mt-3 pt-3 border-t border-[#333] transition-all duration-200 ${
                  clearingRiderInfo ? 'opacity-0 transform -translate-y-2' : 'opacity-100'
                }`}
              >
                <button
                  type="button"
                  onClick={handleClearRiderInfo}
                  disabled={clearingRiderInfo}
                  className="text-[10px] sm:text-xs text-[#888] hover:text-[#ffd55c] flex items-center gap-1.5 transition opacity-70 hover:opacity-100 disabled:opacity-50"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                  Clear saved details
                </button>
              </div>
            )}
            </div>
            </section>

            {/* ===== SECTION 6: Additional Notes (Collapsible) ===== */}
            <section className="bg-[#1b1b1b] p-4 sm:p-5 rounded-lg border border-[#333]">
              <button
                type="button"
                onClick={() => setShowNotes(!showNotes)}
                className="text-xs text-[#ffd55c] hover:text-[#ffcc33] flex items-center gap-1.5 transition"
              >
                <svg 
                  className={`w-3 h-3 transition-transform duration-200 ${showNotes ? 'rotate-45' : ''}`} 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                {showNotes ? "Hide notes" : "Add notes (optional)"}
              </button>
              
              <div 
                className={`grid transition-all duration-200 ease-out ${
                  showNotes ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full p-2 text-sm rounded-md bg-[#111] border border-[#333] text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/30 focus:shadow-[0_0_12px_rgba(212,175,55,0.35)] transition-all duration-300 ease-out resize-none h-16"
                    placeholder="E.g. Please call on arrival, wheelchair access needed..."
                    maxLength={200}
                  />
                </div>
              </div>
            </section>

            {/* ===== SECTION 7: Actions ===== */}
            <section className="space-y-2 sm:space-y-3">
              <button
                onClick={handleEstimate}
                disabled={isLoading}
                className="w-full py-3 rounded-lg bg-[#ffd55c] text-black font-semibold hover:bg-[#ffcc33] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                    Get Fare Estimate
                  </>
                )}
              </button>

              <button
                onClick={handleBooking}
                disabled={isLoading}
                className="w-full py-3 rounded-lg border-2 border-[#ffd55c] text-[#ffd55c] font-semibold hover:bg-[#ffd55c]/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Book Your Ride
              </button>
            </section>

          </div>
          {/* END LEFT COLUMN */}

          {/* RIGHT COLUMN: Map, Fare Estimate, Booking Results (desktop only) */}
          <div className="hidden lg:block space-y-4 lg:sticky lg:top-20 lg:self-start">
            
            {/* ===== Map Preview (Desktop) ===== */}
            <section className="rounded-xl overflow-hidden border border-[#333]">
              <MapPreview
                pickup={pickupCoords}
                stops={stopCoords}
                dropoff={dropoffCoords}
                route={routeData?.geometry}
                distance={routeData?.distance}
                duration={routeData?.duration}
              />
            </section>

            {/* ===== Fare Estimate Result (Desktop) ===== */}
            {fareResult && (
              <section className="bg-[#1b1b1b] p-4 sm:p-5 rounded-lg border border-[#ffd55c]/30 animate-fade-up">
                <h2 className="text-[10px] uppercase tracking-widest text-[#ffd55c] font-semibold mb-3">
                  {fareResult.isLuxury ? "Executive Estimate" : "Fare Estimate"}
                </h2>
                
                {fareResult.error ? (
                  <p className="text-red-400 text-sm">{safeRender(fareResult.error)}</p>
                ) : (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center pb-2 border-b border-[#333]">
                      <span className="text-[#888]">Estimated Fare</span>
                      <span className="text-[#f5f5f5] text-2xl font-bold">£{fareResult.fare.toFixed(2)}</span>
                    </div>
                    
                    <div className="flex justify-between text-xs">
                      <span className="text-[#666]">Distance</span>
                      <span className="text-[#aaa]">{(fareResult.distance / 1609.34).toFixed(1)} mi</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#666]">Duration</span>
                      <span className="text-[#aaa]">{Math.round(fareResult.duration / 60)} min</span>
                    </div>
                    
                    {!fareResult.isLuxury && (
                      <div className="flex justify-between text-xs">
                        <span className="text-[#666]">Tariff</span>
                        <span className="text-[#ffd55c]">{fareResult.tariffName}</span>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* ===== Booking Confirmation (Desktop) ===== */}
            {bookingResult && !bookingResult.error && (
              <section className="p-4 sm:p-5 bg-[#1a1a1a] rounded-lg border border-emerald-500/30 animate-fade-up animate-success-pulse">
                {bookingStatus !== "cancelled" ? (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center animate-gold-glow">
                        <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                      <p className="text-lg text-[#f5f5f5] font-medium">Booking Confirmed!</p>
                    </div>
                    
                    <div className="bg-[#111] rounded-lg p-3 mb-3">
                      <p className="text-xs text-[#888] mb-1">Booking ID</p>
                      <p className="font-mono text-lg text-[#ffd55c] font-bold">{bookingResult.booking_id}</p>
                    </div>

                    {/* Booking Timeline */}
                    <div className="border-t border-[#333] pt-3 mb-3">
                      <BookingTimeline status={bookingStatus || "requested"} />
                    </div>
                    
                    <p className="text-sm text-[#888] mb-3">We will send all updates via WhatsApp.</p>
                    
                    {returnTrip && returnTime && (
                      <div className="p-2 bg-[#ffd55c]/10 border border-[#ffd55c]/30 rounded mb-3">
                        <p className="text-xs text-[#888]">Return Pickup Time</p>
                        <p className="text-sm text-[#ffd55c] font-medium">{formatReturnTime(returnTime)}</p>
                      </div>
                    )}
                    
                    <button
                      onClick={handleCancelBooking}
                      disabled={isCancelling}
                      className="w-full py-2 rounded-lg border border-red-500 text-red-400 hover:bg-red-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                    >
                      {isCancelling ? (
                        <>
                          <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                          Cancelling...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M15 9l-6 6M9 9l6 6" />
                          </svg>
                          Cancel Booking
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <div className="text-center py-2">
                    <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M15 9l-6 6M9 9l6 6" />
                      </svg>
                    </div>
                    <p className="text-lg text-red-400 font-medium">Booking Cancelled</p>
                    <p className="text-sm text-[#888] mt-1">Booking {bookingResult.booking_id} has been cancelled.</p>
                  </div>
                )}
              </section>
            )}

            {/* ===== Driver Tracker Widget (Desktop) ===== */}
            {bookingResult && !bookingResult.error && bookingStatus !== "cancelled" && bookingId && (
              <DriverTracker 
                bookingId={bookingId}
                pickupLocation={pickup.lat && pickup.lng ? { lat: pickup.lat, lng: pickup.lng } : undefined}
                onStatusChange={(newStatus) => setBookingStatus(newStatus)}
              />
            )}

            {bookingResult?.error && (
              <section className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                <p className="text-red-400 font-medium">Booking Failed</p>
                <p className="text-red-400/80 text-sm mt-1">{safeRender(bookingResult.error)}</p>
              </section>
            )}

          </div>
          {/* END RIGHT COLUMN */}

        </div>
        {/* END TWO-COLUMN GRID */}

        {/* ===== MOBILE ONLY: Fare Estimate & Booking Results (shown below grid) ===== */}
        <div className="lg:hidden space-y-3 sm:space-y-4 mt-4">
          {/* Fare Estimate Result (Mobile) */}
          {fareResult && (
            <section className="bg-[#1b1b1b] p-4 rounded-lg border border-[#ffd55c]/30 animate-fade-up">
              <h2 className="text-[10px] uppercase tracking-widest text-[#ffd55c] font-semibold mb-3">
                {fareResult.isLuxury ? "Executive Estimate" : "Fare Estimate"}
              </h2>
              
              {fareResult.error ? (
                <p className="text-red-400 text-sm">{safeRender(fareResult.error)}</p>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center pb-2 border-b border-[#333]">
                    <span className="text-[#888]">Estimated Fare</span>
                    <span className="text-[#f5f5f5] text-2xl font-bold">£{fareResult.fare.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between text-xs">
                    <span className="text-[#666]">Distance</span>
                    <span className="text-[#aaa]">{(fareResult.distance / 1609.34).toFixed(1)} mi</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#666]">Duration</span>
                    <span className="text-[#aaa]">{Math.round(fareResult.duration / 60)} min</span>
                  </div>
                  
                  {!fareResult.isLuxury && (
                    <div className="flex justify-between text-xs">
                      <span className="text-[#666]">Tariff</span>
                      <span className="text-[#ffd55c]">{fareResult.tariffName}</span>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Booking Confirmation (Mobile) */}
          {bookingResult && !bookingResult.error && (
            <section className="p-4 bg-[#1a1a1a] rounded-lg border border-emerald-500/30">
              {bookingStatus !== "cancelled" ? (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <p className="text-lg text-[#f5f5f5] font-medium">Booking Confirmed!</p>
                  </div>
                  
                  <div className="bg-[#111] rounded-lg p-3 mb-3">
                    <p className="text-xs text-[#888] mb-1">Booking ID</p>
                    <p className="font-mono text-lg text-[#ffd55c] font-bold">{bookingResult.booking_id}</p>
                  </div>

                  {/* Booking Timeline (Mobile) */}
                  <div className="border-t border-[#333] pt-3 mb-3">
                    <BookingTimeline status={bookingStatus || "requested"} />
                  </div>
                  
                  <p className="text-sm text-[#888] mb-3">We will send all updates via WhatsApp.</p>
                  
                  {returnTrip && returnTime && (
                    <div className="p-2 bg-[#ffd55c]/10 border border-[#ffd55c]/30 rounded mb-3">
                      <p className="text-xs text-[#888]">Return Pickup Time</p>
                      <p className="text-sm text-[#ffd55c] font-medium">{formatReturnTime(returnTime)}</p>
                    </div>
                  )}
                  
                  <button
                    onClick={handleCancelBooking}
                    disabled={isCancelling}
                    className="w-full py-2 rounded-lg border border-red-500 text-red-400 hover:bg-red-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                  >
                    {isCancelling ? (
                      <>
                        <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                        Cancelling...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M15 9l-6 6M9 9l6 6" />
                        </svg>
                        Cancel Booking
                      </>
                    )}
                  </button>
                </>
              ) : (
                <div className="text-center py-2">
                  <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M15 9l-6 6M9 9l6 6" />
                    </svg>
                  </div>
                  <p className="text-lg text-red-400 font-medium">Booking Cancelled</p>
                  <p className="text-sm text-[#888] mt-1">Booking {bookingResult.booking_id} has been cancelled.</p>
                </div>
              )}
            </section>
          )}

          {/* Driver Tracker Widget (Mobile) */}
          {bookingResult && !bookingResult.error && bookingStatus !== "cancelled" && bookingId && (
            <DriverTracker 
              bookingId={bookingId}
              pickupLocation={pickup.lat && pickup.lng ? { lat: pickup.lat, lng: pickup.lng } : undefined}
              onStatusChange={(newStatus) => setBookingStatus(newStatus)}
            />
          )}

          {bookingResult?.error && (
            <section className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
              <p className="text-red-400 font-medium">Booking Failed</p>
              <p className="text-red-400/80 text-sm mt-1">{safeRender(bookingResult.error)}</p>
            </section>
          )}
        </div>

        {/* ===== Standalone Cancel Section (Full Width) ===== */}
        <section className="bg-[#1b1b1b] p-4 sm:p-5 rounded-lg border border-[#333] mt-6 sm:mt-8 max-w-xl">
          <h2 className="text-[10px] uppercase tracking-widest text-[#888] font-semibold mb-3">Cancel an Existing Booking</h2>
          
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[#aaa] mb-1 block">Booking ID</label>
              <input
                type="text"
                value={cancelBookingIdInput}
                onChange={(e) => setCancelBookingIdInput(e.target.value)}
                className="w-full p-2 text-sm h-9 rounded-md bg-[#111] border border-[#333] text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/30 focus:shadow-[0_0_12px_rgba(212,175,55,0.35)] transition-all duration-300 ease-out font-mono"
                placeholder="e.g. 5463821"
              />
            </div>
            
            <button
              onClick={handleStandaloneCancel}
              disabled={isCancellingStandalone || !cancelBookingIdInput.trim()}
              className="w-full py-2 rounded-lg border border-red-500 text-red-400 hover:bg-red-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isCancellingStandalone ? (
                <>
                  <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M15 9l-6 6M9 9l6 6" />
                  </svg>
                  Cancel Booking
                </>
              )}
            </button>
            
            {/* Standalone cancel result */}
            {standaloneCancelResult?.success && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <p className="text-sm text-emerald-400">{safeRender(standaloneCancelResult.message)}</p>
              </div>
            )}
            
            {standaloneCancelResult?.error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
                <svg className="w-4 h-4 text-red-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
                <p className="text-sm text-red-400">{safeRender(standaloneCancelResult.error)}</p>
              </div>
            )}
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center py-6 sm:py-8 text-[#555] text-xs">
          © 2025 Classic Cabs · Jersey
        </footer>
      </div>
    </div>
  );
}
















