"use client";

import { useState, useEffect, useCallback } from "react";
import JourneyForm from "./components/JourneyForm";
import MapPreview from "./components/MapPreview";
import DateTimeInput from "./components/DateTimeInput";
import { createBooking } from "./lib/api";
import { calculateFare, type FareResult, type VehicleType, LUXURY_HOURLY_RATE } from "@/lib/tariffs";
import Confetti, { useConfetti } from "@/components/ui/Confetti";
import { ThemeToggle } from "@/components/ui/ThemeProvider";
import { getRecentPassengers, saveRecentPassenger, RecentPassenger } from "@/lib/recentPassengers";

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
  isMultiseater: boolean;
  breakdown: FareResult["breakdown"];
  error?: string;
}

interface BookingResult {
  booking_id?: string;           // Primary ID - hex order_id for API operations
  job_id?: number;               // Display ID - numeric job_id shown in TaxiCaller dispatch
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
  const [recentPassengers, setRecentPassengers] = useState<RecentPassenger[]>([]);
  const [seats, setSeats] = useState(1);
  const [bags, setBags] = useState(0);

  // Vehicle type state
  const [vehicleType, setVehicleType] = useState<VehicleType>("standard");

  // Load recent passengers on mount
  useEffect(() => {
    setRecentPassengers(getRecentPassengers());
  }, []);

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

  // Get minimum datetime (30 min from now to ensure booking validity)
  const getMinDateTime = useCallback(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30); // 30 min buffer (TaxiCaller requires 20 min)
    // Format as YYYY-MM-DDTHH:MM for datetime-local input
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }, []);

  // Get default pickup time (1 hour from now, rounded to nearest 15 min)
  const getDefaultPickupTime = useCallback(() => {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }, []);

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

  // Amendment form
  const [showAmendForm, setShowAmendForm] = useState(false);
  const [amendBookingId, setAmendBookingId] = useState("");
  const [amendPickupTime, setAmendPickupTime] = useState("");
  const [isAmending, setIsAmending] = useState(false);
  const [amendResult, setAmendResult] = useState<{
    success?: boolean;
    message?: string;
    new_job_id?: string;
    error?: string;
  } | null>(null);

  // Cancel form dropdown
  const [showCancelForm, setShowCancelForm] = useState(false);

  // Route data for map
  const [routeData, setRouteData] = useState<RouteData | null>(null);

  // Confetti celebration
  const confetti = useConfetti();

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
        const response = await res.json();
        // API returns { ok: true, data: { geometry, distance, duration } }
        setRouteData(response.data || response);
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
    // Validate pickup time is in the future (at least 20 min from now)
    if (!asap && pickupTime) {
      const selectedTime = new Date(pickupTime);
      const minTime = new Date();
      minTime.setMinutes(minTime.getMinutes() + 20);
      if (selectedTime < minTime) {
        return "Pickup time must be at least 20 minutes from now";
      }
    }
    if (returnTrip && !returnTime) {
      return "Please select a return pickup date and time";
    }
    // Validate return time is after pickup time
    if (returnTrip && returnTime && pickupTime) {
      if (new Date(returnTime) <= new Date(pickupTime)) {
        return "Return time must be after pickup time";
      }
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
          setError(errorData.error?.message || errorData.error || "Could not calculate route");
          return;
        }

        const response = await res.json();
        // API returns { ok: true, data: { geometry, distance, duration } }
        route = response.data || response;
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
        isMultiseater: result.isMultiseater,
        breakdown: result.breakdown,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to calculate estimate";
      setError(message);
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
        sessionStorage.setItem("booking_id", result.booking_id);  // Now stores hex order_id
        // Also store job_id for display reference
        if (result.job_id) {
          sessionStorage.setItem("job_id", String(result.job_id));
        }
        
        // Save passenger for future autofill
        if (passenger.name && passenger.phone) {
          const nameParts = passenger.name.trim().split(/\s+/);
          const firstName = nameParts[0] || "";
          const lastName = nameParts.slice(1).join(" ") || "";
          saveRecentPassenger({
            firstName,
            lastName,
            phone: passenger.phone,
            email: passenger.email,
          });
          // Refresh recent passengers list
          setRecentPassengers(getRecentPassengers());
        }
        
        // Celebrate with confetti!
        confetti.trigger();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create booking";
      setError(message);
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
      // bookingId is now the hex order_id (correct format for TaxiCaller API)
      const res = await fetch("/api/cancel", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          order_id: bookingId,  // Hex order_id for TaxiCaller API
        }),
      });

      const data = await res.json();

      if (data?.success || data?.status === "cancelled") {
        setBookingStatus("cancelled");
        sessionStorage.removeItem("booking_id");
        sessionStorage.removeItem("job_id");
      } else {
        setError(data?.error || "Failed to cancel booking");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to cancel booking";
      setError(message);
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
          sessionStorage.removeItem("job_id");
        }
      } else {
        setStandaloneCancelResult({
          error: data?.error || "Failed to cancel booking",
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to cancel booking";
      setStandaloneCancelResult({
        error: message,
      });
    } finally {
      setIsCancellingStandalone(false);
    }
  }

  // Amendment handler - amend pickup time for existing booking
  async function handleAmendBooking() {
    if (!amendBookingId.trim()) {
      setAmendResult({ error: "Please enter a booking ID" });
      return;
    }

    if (!amendPickupTime) {
      setAmendResult({ error: "Please select a new pickup time" });
      return;
    }

    // Validate time is in future
    const selectedTime = new Date(amendPickupTime);
    const minTime = new Date();
    minTime.setMinutes(minTime.getMinutes() + 20);
    if (selectedTime < minTime) {
      setAmendResult({ error: "Pickup time must be at least 20 minutes from now" });
      return;
    }

    const confirmed = window.confirm(
      `Amend booking ${amendBookingId}?\n\nThis will cancel the original booking and create a new one with the updated time.\n\nNew pickup: ${selectedTime.toLocaleString("en-GB")}`
    );
    
    if (!confirmed) return;

    setIsAmending(true);
    setAmendResult(null);

    try {
      // For amendment, we need current pickup/dropoff - use form values if available
      // Otherwise, the API will need the full details
      // 
      // amendBookingId should now be the hex order_id (e.g. "66cc3c074e2208db")
      const amendPayload: Record<string, unknown> = {
        order_id: amendBookingId.trim(),  // Hex order_id for TaxiCaller API
        pickup_time: new Date(amendPickupTime).toISOString(),
      };

      // Include current form data if available
      if (pickup.lat && pickup.lng) {
        amendPayload.pickup = {
          address: pickup.address,
          lat: pickup.lat,
          lng: pickup.lng,
        };
      }
      if (dropoff.lat && dropoff.lng) {
        amendPayload.dropoff = {
          address: dropoff.address,
          lat: dropoff.lat,
          lng: dropoff.lng,
        };
      }
      if (passenger.name || passenger.phone) {
        amendPayload.passenger = {
          name: passenger.name,
          phone: passenger.phone,
          email: passenger.email,
        };
      }
      amendPayload.passengers = seats;
      amendPayload.luggage = bags;

      const res = await fetch("/api/amend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(amendPayload),
      });

      const data = await res.json();

      if (data.ok) {
        setAmendResult({
          success: true,
          message: data.method === "direct_update" 
            ? `Booking updated successfully!`
            : `Booking amended! New booking ID: ${data.new_job_id}`,
          new_job_id: data.new_job_id || data.job_id,
        });
        setAmendBookingId("");
        setAmendPickupTime("");
        
        // Update session if this was the current booking
        if (data.new_job_id) {
          setBookingId(data.new_job_id);
          sessionStorage.setItem("booking_id", data.new_job_id);
        }
      } else {
        setAmendResult({
          error: data.error || "Failed to amend booking",
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to amend booking";
      setAmendResult({
        error: message,
      });
    } finally {
      setIsAmending(false);
    }
  }

  // Prepare coordinates for map
  const pickupCoords = pickup.lat && pickup.lng ? { lat: pickup.lat, lng: pickup.lng } : null;
  const dropoffCoords = dropoff.lat && dropoff.lng ? { lat: dropoff.lat, lng: dropoff.lng } : null;
  const stopCoords = stops
    .filter(s => s.lat && s.lng)
    .map(s => ({ lat: s.lat!, lng: s.lng! }));

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Confetti celebration for successful bookings */}
      <Confetti isActive={confetti.isActive} onComplete={confetti.reset} />

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-sm border-b px-4 py-3" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', opacity: 0.98 }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6" style={{ color: 'var(--accent)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.9 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8c-.3.5-.1 1.1.4 1.3l.5.2" />
              <circle cx="7" cy="17" r="2" />
              <circle cx="17" cy="17" r="2" />
            </svg>
            <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Classic Cabs</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content - Responsive Two-Column Layout */}
      <div className="max-w-7xl mx-auto lg:flex lg:gap-8 px-4 py-4">
        {/* Left Column - Form */}
        <div className="w-full lg:w-[420px] xl:w-[440px] lg:flex-shrink-0 space-y-3">
        
        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-3 text-red-400 text-sm flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            {error}
          </div>
        )}

        {/* ===== SECTION 1: Journey Details ===== */}
        <section className="bg-[#1b1b1b] p-4 rounded-lg border border-[#333]">
          <h2 className="text-[10px] uppercase tracking-widest text-[#888] font-semibold mb-3">Journey Details</h2>
          <JourneyForm
            pickup={pickup}
            dropoff={dropoff}
            setPickup={setPickup}
            setDropoff={setDropoff}
            stops={stops}
            setStops={setStops}
          />
        </section>

        {/* ===== SECTION 2: Map Preview (Mobile Only) ===== */}
        <section className="rounded-lg overflow-hidden border border-[#333] lg:hidden">
          <MapPreview
            pickup={pickupCoords}
            stops={stopCoords}
            dropoff={dropoffCoords}
            route={routeData?.geometry}
            distance={routeData?.distance}
            duration={routeData?.duration}
            showNearbyDrivers={!bookingResult}
          />
        </section>

        {/* ===== SECTION 3: When ===== */}
        <section className="bg-[#1b1b1b] p-4 rounded-lg border border-[#333] mt-4 mb-6">
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
              onClick={() => {
                setAsap(false);
                // Set default pickup time if not already set
                if (!pickupTime) {
                  setPickupTime(getDefaultPickupTime());
                }
              }}
              className={`flex-1 p-2 text-sm rounded-md border transition ${
                !asap ? 'border-[#ffd55c] bg-[#ffd55c]/10 text-[#ffd55c]' : 'border-[#333] text-[#888]'
              }`}
            >
              Schedule
            </button>
          </div>

          {!asap && (
            <DateTimeInput
              label="Pickup Time"
              value={pickupTime}
              onChange={setPickupTime}
              minDateTime={getMinDateTime()}
              required
            />
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
              <DateTimeInput
                label="Return Pickup"
                value={returnTime}
                onChange={setReturnTime}
                minDateTime={pickupTime || getMinDateTime()}
                required
                error={returnTrip && !returnTime}
              />
              {returnTrip && !returnTime && (
                <p className="text-[10px] text-red-400 mt-1">Please select a return pickup date and time</p>
              )}
            </div>
          )}
        </section>

        {/* ===== SECTION 4: Vehicle Type ===== */}
        <section className="bg-[#1b1b1b] p-3 rounded-lg border border-[#333]">
          <div className="flex items-center gap-3">
            <label className="text-[10px] uppercase tracking-widest text-[#888] font-semibold whitespace-nowrap">
              Vehicle
            </label>
            <div className="relative flex-1">
              <select
                value={vehicleType}
                onChange={(e) => {
                  const newType = e.target.value as VehicleType;
                  setVehicleType(newType);
                  // Auto-set passengers to 6 for multi-seater
                  if (newType === "multiseater" && seats < 5) {
                    setSeats(6);
                  }
                }}
                className="w-full px-3 py-2 text-sm bg-[#111] border border-[#333] rounded-lg text-[#f5f5f5] focus:outline-none focus:border-[#ffd55c]/50 appearance-none cursor-pointer pr-10"
              >
                <option value="standard">🚗 Standard Saloon (1-4 passengers)</option>
                <option value="multiseater">🚐 Multi-seater Van (5-8 passengers)</option>
                <option value="luxury">⭐ Executive Mercedes V-Class (£{LUXURY_HOURLY_RATE}/hr)</option>
              </select>
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666] pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
          </div>
          
          {/* Executive info note */}
          {vehicleType === "luxury" && (
            <div className="mt-2 p-2 bg-[#ffd55c]/10 rounded border border-[#ffd55c]/20 text-xs text-[#ffd55c] flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z" />
              </svg>
              Mercedes V-Class – Minimum 1 hour booking
            </div>
          )}
        </section>

        {/* ===== SECTION 5: Passenger Details ===== */}
        <section id="passenger-section" className="bg-[#1b1b1b] p-4 rounded-lg border border-[#333]">
          <h2 className="text-[10px] uppercase tracking-widest text-[#888] font-semibold mb-3">Passenger Details</h2>
          
          {/* Recent Passengers Quick Select */}
          {recentPassengers.length > 0 && !passenger.name && (
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
                    onClick={() => {
                      setPassenger({
                        name: `${p.firstName} ${p.lastName}`.trim(),
                        phone: p.phone,
                        email: p.email || "",
                      });
                      // Clear any validation errors
                      setFieldErrors({});
                      setTouchedFields({});
                    }}
                    className="px-2 py-1 text-xs bg-[#111] border border-[#333] rounded hover:border-[#ffd55c]/50 hover:bg-[#ffd55c]/5 text-[#ccc] transition"
                  >
                    {p.firstName} {p.lastName}
                  </button>
                ))}
              </div>
            </div>
          )}
          
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
                className={`w-full p-2 text-sm h-9 rounded-md bg-[#111] border text-[#f5f5f5] placeholder-[#555] focus:outline-none transition ${
                  touchedFields.name && fieldErrors.name
                    ? "border-red-500 focus:border-red-500"
                    : "border-[#333] focus:border-[#ffd55c]/50"
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
                className={`w-full p-2 text-sm h-9 rounded-md bg-[#111] border text-[#f5f5f5] placeholder-[#555] focus:outline-none transition ${
                  touchedFields.phone && fieldErrors.phone
                    ? "border-red-500 focus:border-red-500"
                    : "border-[#333] focus:border-[#ffd55c]/50"
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
                className="w-full p-2 text-sm h-9 rounded-md bg-[#111] border border-[#333] text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50 transition"
                placeholder="email@example.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="text-xs text-[#aaa] mb-1 block">Passengers</label>
                <select
                  value={seats}
                  onChange={(e) => setSeats(Number(e.target.value))}
                  className="w-full p-2 text-sm h-9 rounded-md bg-[#111] border border-[#333] text-[#f5f5f5] focus:outline-none focus:border-[#ffd55c]/50 transition"
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
                  className="w-full p-2 text-sm h-9 rounded-md bg-[#111] border border-[#333] text-[#f5f5f5] focus:outline-none focus:border-[#ffd55c]/50 transition"
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
                className="w-full p-2 text-sm h-9 rounded-md bg-[#111] border border-[#333] text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50 transition"
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
                  className="w-full p-2 text-sm rounded-md bg-[#111] border border-[#333] text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50 transition resize-none h-16"
                  placeholder="Add arrival details or pickup instructions..."
                  maxLength={200}
                />
              </div>
            )}
          </div>
        </section>

        {/* ===== SECTION 6: Additional Notes (Collapsible) ===== */}
        <section className="bg-[#1b1b1b] p-4 rounded-lg border border-[#333]">
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
                className="w-full p-2 text-sm rounded-md bg-[#111] border border-[#333] text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50 transition resize-none h-16"
                placeholder="E.g. Please call on arrival, wheelchair access needed..."
                maxLength={200}
              />
            </div>
          </div>
        </section>

        {/* ===== SECTION 7: Actions ===== */}
        <section className="space-y-2">
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

        {/* ===== Fare Estimate Loading Skeleton ===== */}
        {isLoading && !fareResult && (
          <section className="bg-[#1b1b1b] p-4 rounded-lg border border-[#333]">
            <div className="skeleton h-3 w-28 rounded mb-4" />
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-3 border-b border-[#333]">
                <div className="skeleton h-4 w-24 rounded" />
                <div className="skeleton h-8 w-20 rounded" />
              </div>
              <div className="flex justify-between">
                <div className="skeleton h-3 w-16 rounded" />
                <div className="skeleton h-3 w-14 rounded" />
              </div>
              <div className="flex justify-between">
                <div className="skeleton h-3 w-16 rounded" />
                <div className="skeleton h-3 w-12 rounded" />
              </div>
              <div className="flex justify-between">
                <div className="skeleton h-3 w-12 rounded" />
                <div className="skeleton h-3 w-16 rounded" />
              </div>
            </div>
          </section>
        )}

        {/* ===== Fare Estimate Result ===== */}
        {fareResult && (
          <section className="bg-[#1b1b1b] p-4 rounded-lg border border-[#ffd55c]/30">
            <h2 className="text-[10px] uppercase tracking-widest text-[#ffd55c] font-semibold mb-3">
              {fareResult.isLuxury 
                ? "Executive Estimate" 
                : fareResult.isMultiseater 
                  ? "Multi-seater Estimate" 
                  : "Fare Estimate"}
            </h2>
            
            {fareResult.error ? (
              <p className="text-red-400 text-sm">{fareResult.error}</p>
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
                  <>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#666]">Tariff</span>
                      <span className="text-[#ffd55c]">{fareResult.tariffName}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </section>
        )}

        {/* ===== Booking Confirmation ===== */}
        {bookingResult && !bookingResult.error && (
          <section className="p-4 bg-[#1a1a1a] rounded-lg border border-emerald-500/30 booking-success-enter relative overflow-hidden">
            {bookingStatus !== "cancelled" ? (
              <>
                {/* Confetti animation */}
                <div className="confetti-container">
                  <div className="confetti" />
                  <div className="confetti" />
                  <div className="confetti" />
                  <div className="confetti" />
                  <div className="confetti" />
                  <div className="confetti" />
                  <div className="confetti" />
                  <div className="confetti" />
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center checkmark-circle">
                    <svg className="w-6 h-6 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline className="checkmark-check" points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-lg text-[#f5f5f5] font-semibold">Booking Confirmed!</p>
                    <p className="text-xs text-emerald-400/80">Your ride has been scheduled</p>
                  </div>
                </div>
                
                <div className="bg-[#111] rounded-lg p-3 mb-3 group">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-[#888] mb-1">Booking Reference</p>
                      <p className="font-mono text-lg text-[#ffd55c] font-bold">{bookingResult.booking_id}</p>
                      {bookingResult.job_id && (
                        <p className="text-xs text-[#666] mt-1">
                          Dispatch ID: <span className="font-mono">{bookingResult.job_id}</span>
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(bookingResult.booking_id || "");
                        // Show feedback
                        const btn = document.getElementById("copy-btn-individual");
                        if (btn) {
                          btn.classList.add("copied");
                          setTimeout(() => btn.classList.remove("copied"), 2000);
                        }
                      }}
                      id="copy-btn-individual"
                      className="relative p-2 rounded-lg bg-[#222] hover:bg-[#333] border border-[#333] hover:border-[#ffd55c]/50 transition group/btn"
                      title="Copy booking reference"
                    >
                      <svg className="w-5 h-5 text-[#888] group-hover/btn:text-[#ffd55c] transition [.copied_&]:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      <svg className="w-5 h-5 text-emerald-400 hidden [.copied_&]:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-emerald-500 text-white text-xs rounded opacity-0 [.copied_&]:opacity-100 transition whitespace-nowrap">
                        Copied!
                      </span>
                    </button>
                  </div>
                </div>
                
                <p className="text-sm text-[#888] mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  We&apos;ll send updates via WhatsApp
                </p>
                
                {returnTrip && returnTime && (
                  <div className="p-2 bg-[#ffd55c]/10 border border-[#ffd55c]/30 rounded mb-3">
                    <p className="text-xs text-[#888]">Return Pickup Time</p>
                    <p className="text-sm text-[#ffd55c] font-medium">{formatReturnTime(returnTime)}</p>
                  </div>
                )}
                
                {/* Cancel Button */}
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

        {bookingResult?.error && (
          <section className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
            <p className="text-red-400 font-medium">Booking Failed</p>
            <p className="text-red-400/80 text-sm mt-1">{bookingResult.error}</p>
          </section>
        )}

        {/* ===== Amend Booking Section ===== */}
        <section className="bg-[#1b1b1b] p-4 rounded-lg border border-[#333] mt-6">
          <button
            type="button"
            onClick={() => setShowAmendForm(!showAmendForm)}
            className="w-full flex items-center justify-between text-left"
          >
            <h2 className="text-[10px] uppercase tracking-widest text-[#888] font-semibold">Amend an Existing Booking</h2>
            <svg 
              className={`w-4 h-4 text-[#888] transition-transform ${showAmendForm ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          
          {showAmendForm && (
            <div className="space-y-3 mt-4">
              <p className="text-[11px] text-[#666] mb-3">
                Change the pickup time for an existing booking. The original booking will be cancelled and a new one created.
              </p>
              
              <div>
                <label className="text-xs text-[#aaa] mb-1 block">Booking ID to Amend</label>
                <input
                  type="text"
                  value={amendBookingId}
                  onChange={(e) => setAmendBookingId(e.target.value)}
                  className="w-full p-2 text-sm h-9 rounded-md bg-[#111] border border-[#333] text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50 transition font-mono"
                  placeholder="e.g. 5325328"
                />
              </div>
              
              <div>
                <DateTimeInput
                  label="New Pickup Time"
                  value={amendPickupTime}
                  onChange={setAmendPickupTime}
                  minDateTime={getMinDateTime()}
                  required
                />
              </div>
              
              <button
                onClick={handleAmendBooking}
                disabled={isAmending || !amendBookingId.trim() || !amendPickupTime}
                className="w-full py-2 rounded-lg border border-[#ffd55c] text-[#ffd55c] hover:bg-[#ffd55c]/10 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isAmending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[#ffd55c]/30 border-t-[#ffd55c] rounded-full animate-spin" />
                    Amending...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Amend Booking
                  </>
                )}
              </button>
              
              {/* Amendment result */}
              {amendResult?.success && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <p className="text-sm text-emerald-400">{amendResult.message}</p>
                  </div>
                  {amendResult.new_job_id && (
                    <p className="text-xs text-emerald-400/70 mt-1 ml-6">
                      New Booking ID: <span className="font-mono">{amendResult.new_job_id}</span>
                    </p>
                  )}
                </div>
              )}
              
              {amendResult?.error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                  <p className="text-sm text-red-400">{amendResult.error}</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ===== Standalone Cancel Section ===== */}
        <section className="bg-[#1b1b1b] p-4 rounded-lg border border-[#333] mt-6">
          <button
            type="button"
            onClick={() => setShowCancelForm(!showCancelForm)}
            className="w-full flex items-center justify-between text-left"
          >
            <h2 className="text-[10px] uppercase tracking-widest text-[#888] font-semibold">Cancel an Existing Booking</h2>
            <svg 
              className={`w-4 h-4 text-[#888] transition-transform ${showCancelForm ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          
          {showCancelForm && (
            <div className="space-y-3 mt-4">
              <div>
                <label className="text-xs text-[#aaa] mb-1 block">Booking ID</label>
                <input
                  type="text"
                  value={cancelBookingIdInput}
                  onChange={(e) => setCancelBookingIdInput(e.target.value)}
                  className="w-full p-2 text-sm h-9 rounded-md bg-[#111] border border-[#333] text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50 transition font-mono"
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
                  <p className="text-sm text-emerald-400">{standaloneCancelResult.message}</p>
                </div>
              )}
              
              {standaloneCancelResult?.error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                  <p className="text-sm text-red-400">{standaloneCancelResult.error}</p>
                </div>
              )}
            </div>
          )}
        </section>

          {/* Footer (Mobile) */}
          <footer className="text-center py-4 text-[#555] text-xs lg:hidden">
            © 2025 Classic Cabs · Jersey
          </footer>
        </div>

        {/* Right Column - Map (Desktop Only) */}
        <div className="hidden lg:flex lg:flex-1 lg:min-w-0 lg:flex-col">
          <div className="w-full">
            {/* Map Container - full width, compact height */}
            <div className="h-[280px] xl:h-[300px] rounded-xl overflow-hidden border border-[#333] bg-[#1b1b1b]">
              <MapPreview
                pickup={pickupCoords}
                stops={stopCoords}
                dropoff={dropoffCoords}
                route={routeData?.geometry}
                distance={routeData?.distance}
                duration={routeData?.duration}
                showNearbyDrivers={!bookingResult}
              />
            </div>
            
            {/* Route Summary Card (Desktop) */}
            {routeData && (
              <div className="mt-4 p-4 rounded-xl bg-[#1b1b1b] border border-[#333]">
                <h3 className="text-[10px] uppercase tracking-widest text-[#888] font-semibold mb-3">Route Summary</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-[#666]">Distance</p>
                    <p className="text-lg font-semibold text-[#f5f5f5]">{(routeData.distance / 1609.34).toFixed(1)} mi</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#666]">Est. Duration</p>
                    <p className="text-lg font-semibold text-[#f5f5f5]">{Math.round(routeData.duration / 60)} min</p>
                  </div>
                </div>
                {fareResult && !fareResult.error && (
                  <div className="mt-3 pt-3 border-t border-[#333]">
                    <p className="text-xs text-[#666]">Estimated Fare</p>
                    <p className="text-2xl font-bold text-[#ffd55c]">£{fareResult.fare.toFixed(2)}</p>
                    {!fareResult.isLuxury && fareResult.tariffName && (
                      <p className="text-[10px] text-[#888] mt-1">{fareResult.tariffName}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Desktop Footer */}
            <footer className="text-center py-4 text-[#555] text-xs">
              © 2025 Classic Cabs · Jersey
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
