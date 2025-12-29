"use client";

import React, { useState, useCallback, useEffect } from "react";
import JourneyForm from "../../components/JourneyForm";
import DateTimeInput from "../../components/DateTimeInput";
import PassengerInput from "../../components/PassengerInput";
import FrequentTravelerSelect from "../../components/FrequentTravelerSelect";
import MultiPassengerForm, { PassengerEntry } from "../../components/MultiPassengerForm";
import { saveRecentPassenger } from "@/lib/recentPassengers";
import { FrequentTraveler, markTravelerUsed } from "@/lib/frequentTravelers";
import { VehicleType, LUXURY_HOURLY_RATE } from "@/lib/tariffs";

/* Types */
interface Location {
  address: string;
  lat: number | null;
  lng: number | null;
}

interface RouteData {
  geometry: GeoJSON.LineString;
  distance: number;
  duration: number;
}

export interface CorporateSession {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    companyId: string;
    department?: string;
    phone?: string;
  };
  company: {
    id: string;
    name: string;
    taxiCallerAccountId: number;
    address?: string;
    billingEmail?: string;
    costCentres?: Array<{ id: string; name: string; code: string; active: boolean }>;
    departments?: string[];
  };
}

interface BookingResult {
  success?: boolean;
  error?: string;
  bookingId?: string;
  message?: string;
  reference?: string;
  status?: "pending" | "approved" | "rejected";
}

interface BookingFormProps {
  session: CorporateSession;
  onBookingComplete?: () => void;
  onRouteChange?: (route: RouteData | null) => void;
  onCoordsChange?: (coords: {
    pickup: { lat: number; lng: number } | null;
    dropoff: { lat: number; lng: number } | null;
    stops: { lat: number; lng: number }[];
  }) => void;
}

const PENDING_BOOK_API = "/api/corporate/bookings";

// === VALIDATION HELPERS ===
// Phone validation regex - must start with + and country code, 7-16 digits total
const PHONE_REGEX = /^\+[1-9]\d{6,15}$/;
// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates phone number format (international with country code)
 */
function validatePhone(phone: string): string | null {
  if (!phone) return "Phone number is required";
  const cleanPhone = phone.replace(/\s/g, ""); // Strip spaces
  if (!PHONE_REGEX.test(cleanPhone)) {
    return "Please enter a valid phone number with country code (e.g., +447700123456)";
  }
  return null;
}

/**
 * Validates email format (if provided)
 */
function validateEmail(email: string): string | null {
  if (!email) return null; // Email is optional
  if (!EMAIL_REGEX.test(email)) {
    return "Please enter a valid email address";
  }
  return null;
}

/**
 * Sanitize user input to prevent XSS
 * Removes < > \ characters, trims, and limits length
 */
function sanitizeText(text: string, maxLength: number = 500): string {
  return text
    .replace(/[<>\\]/g, "") // Remove potentially dangerous characters
    .trim()
    .slice(0, maxLength);
}

/**
 * Fetch wrapper with AbortController timeout (PHASE 2: Network Reliability)
 * Prevents requests from hanging indefinitely on slow networks
 */
const FETCH_TIMEOUT_MS = 30000; // 30 seconds

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timed out. Please check your connection and try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export default function BookingForm({
  session,
  onBookingComplete,
  onRouteChange,
  onCoordsChange,
}: BookingFormProps) {
  // Form state
  const [contactPerson, setContactPerson] = useState(session.user.name || "");
  const [poNumber, setPoNumber] = useState("");

  // Single passenger mode
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [selectedTravelerId, setSelectedTravelerId] = useState<string | undefined>();
  const [selectedTraveler, setSelectedTraveler] = useState<FrequentTraveler | null>(null);

  // Multi-passenger mode
  const [isMultiPassenger, setIsMultiPassenger] = useState(false);
  const [multiPassengers, setMultiPassengers] = useState<PassengerEntry[]>([
    { id: "initial", firstName: "", lastName: "", phone: "", email: "" },
  ]);

  // Vehicle type and counts
  const [vehicleType, setVehicleType] = useState<VehicleType>("standard");
  const [passengerCount, setPassengerCount] = useState(1);
  const [luggageCount, setLuggageCount] = useState(0);

  // Journey
  const [pickup, setPickup] = useState<Location>({ address: "", lat: null, lng: null });
  const [dropoff, setDropoff] = useState<Location>({ address: "", lat: null, lng: null });
  const [stops, setStops] = useState<Location[]>([]);
  const [notes, setNotes] = useState("");
  const [flightNumber, setFlightNumber] = useState("");
  const [asap, setAsap] = useState(true);
  const [pickupDateTime, setPickupDateTime] = useState("");
  const [selectedCostCentre, setSelectedCostCentre] = useState("");

  // Booking state
  const [isBooking, setIsBooking] = useState(false);
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);

  // Get minimum datetime (30 min from now)
  const getMinDateTime = useCallback(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }, []);

  // Handle frequent traveler selection
  function handleSelectTraveler(traveler: FrequentTraveler) {
    setFirstName(traveler.firstName);
    setLastName(traveler.lastName);
    setPhone(traveler.phone);
    setEmail(traveler.email || "");
    setSelectedTravelerId(traveler.id);
    setSelectedTraveler(traveler);
  }

  // Apply traveler's saved address
  function applyTravelerAddress(addressType: "home" | "work", target: "pickup" | "dropoff") {
    if (!selectedTraveler) return;

    const address = addressType === "home" ? selectedTraveler.homeAddress : selectedTraveler.workAddress;

    if (!address?.address) return;

    const locationData: Location = {
      address: address.address,
      lat: address.lat || null,
      lng: address.lng || null,
    };

    if (target === "pickup") {
      setPickup(locationData);
    } else {
      setDropoff(locationData);
    }
  }

  // Fetch route when coordinates change (with timeout handling)
  const fetchRoute = useCallback(async () => {
    if (!pickup.lat || !pickup.lng || !dropoff.lat || !dropoff.lng) {
      onRouteChange?.(null);
      return;
    }

    try {
      const validStops = stops.filter((s) => s.lat && s.lng);

      const res = await fetchWithTimeout("/api/route-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup: { lat: pickup.lat, lng: pickup.lng },
          stops: validStops.map((s) => ({ lat: s.lat, lng: s.lng })),
          dropoff: { lat: dropoff.lat, lng: dropoff.lng },
        }),
      }, 15000); // 15s timeout for route calculation

      if (res.ok) {
        const response = await res.json();
        onRouteChange?.(response.data || response);
      } else {
        onRouteChange?.(null);
      }
    } catch {
      onRouteChange?.(null);
    }
  }, [pickup.lat, pickup.lng, dropoff.lat, dropoff.lng, stops, onRouteChange]);

  // Debounce route fetching
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRoute();
    }, 500);
    return () => clearTimeout(timer);
  }, [fetchRoute]);

  // Update parent with coordinates
  useEffect(() => {
    const pickupCoords = pickup.lat && pickup.lng ? { lat: pickup.lat, lng: pickup.lng } : null;
    const dropoffCoords = dropoff.lat && dropoff.lng ? { lat: dropoff.lat, lng: dropoff.lng } : null;
    const stopCoords = stops.filter((s) => s.lat && s.lng).map((s) => ({ lat: s.lat!, lng: s.lng! }));

    onCoordsChange?.({ pickup: pickupCoords, dropoff: dropoffCoords, stops: stopCoords });
  }, [pickup, dropoff, stops, onCoordsChange]);

  // Reset form
  function resetForm() {
    setPoNumber("");
    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
    setSelectedTravelerId(undefined);
    setSelectedTraveler(null);
    setMultiPassengers([{ id: "initial", firstName: "", lastName: "", phone: "", email: "" }]);
    setPickup({ address: "", lat: null, lng: null });
    setDropoff({ address: "", lat: null, lng: null });
    setStops([]);
    setNotes("");
    setFlightNumber("");
    setAsap(true);
    setPickupDateTime("");
    setSelectedCostCentre("");
    setVehicleType("standard");
    setPassengerCount(1);
    setLuggageCount(0);
  }

  // Create booking
  async function createBooking() {
    // === PHASE 1: Enhanced Validation ===
    
    // Validate multi-passenger mode
    if (isMultiPassenger) {
      const validPassengers = multiPassengers.filter((p) => p.firstName && p.lastName && p.phone);
      if (validPassengers.length === 0) {
        setBookingResult({ error: "At least one passenger with name and phone is required" });
        document.getElementById("booking-result")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      // Validate each passenger's phone and email
      for (const p of validPassengers) {
        const phoneError = validatePhone(p.phone);
        if (phoneError) {
          setBookingResult({ error: `${p.firstName}: ${phoneError}` });
          document.getElementById("booking-result")?.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
        const emailError = validateEmail(p.email || "");
        if (emailError) {
          setBookingResult({ error: `${p.firstName}: ${emailError}` });
          document.getElementById("booking-result")?.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
      }
    } else {
      // Single passenger validation
      if (!firstName || !lastName) {
        setBookingResult({ error: "Passenger first and last name are required" });
        document.getElementById("booking-result")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      
      // Phone validation (Critical Fix #1)
      const phoneError = validatePhone(phone);
      if (phoneError) {
        setBookingResult({ error: phoneError });
        document.getElementById("booking-result")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      
      // Email validation (Critical Fix #2)
      const emailError = validateEmail(email);
      if (emailError) {
        setBookingResult({ error: emailError });
        document.getElementById("booking-result")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }

    // Address validation
    if (!pickup.address || !dropoff.address) {
      setBookingResult({ error: "Pickup and dropoff addresses are required" });
      document.getElementById("booking-result")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!pickup.lat || !pickup.lng) {
      setBookingResult({ error: "Please select a valid pickup address from the suggestions" });
      document.getElementById("booking-result")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!dropoff.lat || !dropoff.lng) {
      setBookingResult({ error: "Please select a valid dropoff address from the suggestions" });
      document.getElementById("booking-result")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    
    // Scheduled time validation (Critical Fix #3)
    if (!asap && pickupDateTime) {
      const scheduledTime = new Date(pickupDateTime);
      const minTime = new Date();
      minTime.setMinutes(minTime.getMinutes() + 20); // Minimum 20 minutes from now
      if (scheduledTime < minTime) {
        setBookingResult({ error: "Pickup time must be at least 20 minutes from now" });
        document.getElementById("booking-result")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }

    setIsBooking(true);
    setBookingResult(null);

    try {
      // Build notes (with XSS sanitization - Critical Fix #4)
      const noteParts = [];
      if (vehicleType === "luxury") {
        noteParts.push("Executive V-Class requested");
      } else if (vehicleType === "multiseater") {
        noteParts.push("Multi-seater vehicle requested");
      }
      if (flightNumber) {
        // Sanitize flight number input
        noteParts.push(`Flight: ${sanitizeText(flightNumber, 20)}`);
      }
      if (notes) {
        // Sanitize user notes to prevent XSS
        noteParts.push(sanitizeText(notes, 500));
      }
      const combinedNotes = noteParts.join(" • ");
      const pickupTime = asap ? new Date().toISOString() : pickupDateTime ? new Date(pickupDateTime).toISOString() : new Date().toISOString();

      if (isMultiPassenger) {
        // Multi-passenger booking
        const validPassengers = multiPassengers.filter((p) => p.firstName && p.lastName && p.phone);
        const sharedPickupPassengers = validPassengers.filter((p) => !p.customPickup?.address);
        const customPickupPassengers = validPassengers.filter((p) => p.customPickup?.address);
        const bookingResults: { success: boolean; reference?: string; passenger: string; error?: string }[] = [];

        if (sharedPickupPassengers.length > 0) {
          const passengerNames = sharedPickupPassengers.map((p) => `${p.firstName} ${p.lastName}`).join(", ");
          const passengerPhones = sharedPickupPassengers.map((p) => p.phone).join(", ");
          const multiNotes = `GROUP BOOKING (${sharedPickupPassengers.length} passengers): ${passengerNames}\nPhones: ${passengerPhones}${combinedNotes ? `\n${combinedNotes}` : ""}`;

          const res = await fetchWithTimeout(PENDING_BOOK_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              passengerName: `${sharedPickupPassengers[0].firstName} ${sharedPickupPassengers[0].lastName}`,
              passengerPhone: sharedPickupPassengers[0].phone,
              passengerEmail: sharedPickupPassengers[0].email,
              passengerCount: sharedPickupPassengers.length,
              luggageCount,
              pickupAddress: pickup.address,
              pickupLat: pickup.lat,
              pickupLng: pickup.lng,
              dropoffAddress: dropoff.address,
              dropoffLat: dropoff.lat,
              dropoffLng: dropoff.lng,
              stops: stops.filter((s) => s.address && s.lat && s.lng).map((s) => ({ address: s.address, lat: s.lat, lng: s.lng })),
              pickupTime,
              isAsap: asap,
              vehicleType,
              notes: multiNotes,
              costCentre: selectedCostCentre || undefined,
              poNumber,
              contactPerson,
              flightNumber,
            }),
          });

          const json = await res.json();
          bookingResults.push({ success: json.success, reference: json.booking?.reference, passenger: passengerNames, error: json.error });

          sharedPickupPassengers.forEach((p) => {
            saveRecentPassenger({ firstName: p.firstName, lastName: p.lastName, phone: p.phone, email: p.email });
            if (p.travelerId) markTravelerUsed(p.travelerId);
          });
        }

        for (const passenger of customPickupPassengers) {
          const customNotes = `Different pickup location${combinedNotes ? `\n${combinedNotes}` : ""}`;

          const res = await fetchWithTimeout(PENDING_BOOK_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              passengerName: `${passenger.firstName} ${passenger.lastName}`,
              passengerPhone: passenger.phone,
              passengerEmail: passenger.email,
              passengerCount: 1,
              luggageCount,
              pickupAddress: passenger.customPickup?.address || pickup.address,
              pickupLat: passenger.customPickup?.lat || pickup.lat,
              pickupLng: passenger.customPickup?.lng || pickup.lng,
              dropoffAddress: dropoff.address,
              dropoffLat: dropoff.lat,
              dropoffLng: dropoff.lng,
              stops: stops.filter((s) => s.address && s.lat && s.lng).map((s) => ({ address: s.address, lat: s.lat, lng: s.lng })),
              pickupTime,
              isAsap: asap,
              vehicleType,
              notes: customNotes,
              costCentre: selectedCostCentre || undefined,
              poNumber,
              contactPerson,
              flightNumber,
            }),
          });

          const json = await res.json();
          bookingResults.push({ success: json.success, reference: json.booking?.reference, passenger: `${passenger.firstName} ${passenger.lastName}`, error: json.error });

          saveRecentPassenger({ firstName: passenger.firstName, lastName: passenger.lastName, phone: passenger.phone, email: passenger.email });
          if (passenger.travelerId) markTravelerUsed(passenger.travelerId);
        }

        const successCount = bookingResults.filter((r) => r.success).length;
        const failCount = bookingResults.filter((r) => !r.success).length;

        if (failCount === 0) {
          const references = bookingResults.map((r) => r.reference).join(", ");
          setBookingResult({ success: true, reference: references, status: "pending", message: `${successCount} booking(s) submitted for approval` });
        } else if (successCount > 0) {
          setBookingResult({
            success: true,
            reference: bookingResults
              .filter((r) => r.success)
              .map((r) => r.reference)
              .join(", "),
            status: "pending",
            message: `${successCount} submitted, ${failCount} failed`,
          });
        } else {
          setBookingResult({ error: bookingResults[0]?.error || "All bookings failed" });
        }
      } else {
        // Single passenger booking (with timeout handling)
        const res = await fetchWithTimeout(PENDING_BOOK_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            passengerName: `${firstName} ${lastName}`,
            passengerPhone: phone,
            passengerEmail: email,
            passengerCount,
            luggageCount,
            pickupAddress: pickup.address,
            pickupLat: pickup.lat,
            pickupLng: pickup.lng,
            dropoffAddress: dropoff.address,
            dropoffLat: dropoff.lat,
            dropoffLng: dropoff.lng,
            stops: stops.filter((s) => s.address && s.lat && s.lng).map((s) => ({ address: s.address, lat: s.lat, lng: s.lng })),
            pickupTime,
            isAsap: asap,
            vehicleType,
            notes: combinedNotes,
            costCentre: selectedCostCentre || undefined,
            poNumber,
            contactPerson,
            flightNumber,
          }),
        });

        const json = await res.json();

        if (!json.success) {
          setBookingResult({ error: json.error || "Booking failed" });
          return;
        }

        setBookingResult({ success: true, reference: json.booking?.reference, status: "pending", message: json.message || "Booking submitted for approval" });

        if (selectedTravelerId) {
          markTravelerUsed(selectedTravelerId);
        }

        saveRecentPassenger({ firstName, lastName, phone, email });
      }

      onBookingComplete?.();
      resetForm();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Booking failed";
      setBookingResult({ error: errorMessage });
    } finally {
      setIsBooking(false);
    }
  }

  return (
    <div className="bg-surface border border-white/10 rounded-xl p-5 space-y-6">
      {/* Fieldset wrapper to disable all inputs during submission (PHASE 2: Prevent Double Submission) */}
      <fieldset disabled={isBooking} className="space-y-6">
      {/* Section: Booking Info */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted flex items-center gap-2">
          <svg className="w-4 h-4 text-[#ffd55c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          Booking Info
        </h3>

        {/* Company Info */}
        <div className="flex items-center justify-between px-3 py-2.5 bg-[#ffd55c]/5 border border-[#ffd55c]/20 rounded-lg">
          <div className="flex items-center gap-2.5">
            <svg className="w-5 h-5 text-[#ffd55c]/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="7" width="20" height="14" rx="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
            <p className="text-sm font-medium text-[#e5e5e5]">{session.company.name}</p>
          </div>
          <span className="text-[11px] text-[#999]">Billing Account</span>
        </div>

        {/* Contact & PO & Cost Centre */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="space-y-2">
            <label htmlFor="contact" className="text-xs text-muted">Contact Person *</label>
            <input id="contact" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Your name" className="w-full h-11 px-3 text-sm bg-surface border border-border rounded-md text-zinc-100 placeholder-zinc-500 hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold" />
          </div>
          <div className="space-y-2">
            <label htmlFor="po" className="text-xs text-muted">PO Number</label>
            <input id="po" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="Optional" className="w-full h-11 px-3 text-sm bg-surface border border-border rounded-md text-zinc-100 placeholder-zinc-500 hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold" />
          </div>
          {session.company.costCentres && session.company.costCentres.length > 0 && (
            <div className="col-span-2 sm:col-span-1 space-y-2">
              <label htmlFor="costcentre" className="text-xs text-muted">Cost Centre</label>
              <select id="costcentre" value={selectedCostCentre} onChange={(e) => setSelectedCostCentre(e.target.value)} className="w-full h-11 px-3 text-sm bg-surface border border-border rounded-md text-zinc-100 hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold">
                <option value="">Select...</option>
                {session.company.costCentres.filter((cc) => cc.active).map((cc) => (
                  <option key={cc.id} value={cc.code}>{cc.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </section>

      <div className="border-t border-white/10" />

      {/* Section: Passenger */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted flex items-center gap-2">
            <svg className="w-4 h-4 text-[#ffd55c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            {isMultiPassenger ? "Passengers" : "Passenger Details"}
          </h3>
          <button type="button" onClick={() => setIsMultiPassenger(!isMultiPassenger)} className={`flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium rounded-md transition ${isMultiPassenger ? "bg-[#ffd55c]/10 border border-[#ffd55c]/30 text-[#ffd55c]" : "border border-white/10 text-muted hover:border-white/20 hover:text-zinc-300"}`}>
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            {isMultiPassenger ? "Multiple" : "+ Multiple"}
          </button>
        </div>

        {isMultiPassenger ? (
          <MultiPassengerForm passengers={multiPassengers} onPassengersChange={setMultiPassengers} allowCustomPickups={true} maxPassengers={10} />
        ) : (
          <div className="space-y-3">
            <FrequentTravelerSelect onSelect={handleSelectTraveler} selectedId={selectedTravelerId} />

            {selectedTraveler && (selectedTraveler.homeAddress?.address || selectedTraveler.workAddress?.address) && (
              <div className="p-2.5 bg-[#ffd55c]/5 border border-[#ffd55c]/20 rounded-lg">
                <div className="flex flex-wrap gap-2">
                  {selectedTraveler.homeAddress?.address && (
                    <>
                      <button type="button" onClick={() => applyTravelerAddress("home", "pickup")} className="px-2 py-1 text-[11px] font-medium bg-background border border-white/10 rounded-md hover:border-[#ffd55c]/40 text-zinc-400 hover:text-zinc-200 transition">🏠 Home → Pickup</button>
                      <button type="button" onClick={() => applyTravelerAddress("home", "dropoff")} className="px-2 py-1 text-[11px] font-medium bg-background border border-white/10 rounded-md hover:border-[#ffd55c]/40 text-zinc-400 hover:text-zinc-200 transition">🏠 Home → Drop-off</button>
                    </>
                  )}
                  {selectedTraveler.workAddress?.address && (
                    <>
                      <button type="button" onClick={() => applyTravelerAddress("work", "pickup")} className="px-2 py-1 text-[11px] font-medium bg-background border border-white/10 rounded-md hover:border-[#ffd55c]/40 text-zinc-400 hover:text-zinc-200 transition">🏢 Work → Pickup</button>
                      <button type="button" onClick={() => applyTravelerAddress("work", "dropoff")} className="px-2 py-1 text-[11px] font-medium bg-background border border-white/10 rounded-md hover:border-[#ffd55c]/40 text-zinc-400 hover:text-zinc-200 transition">🏢 Work → Drop-off</button>
                    </>
                  )}
                </div>
              </div>
            )}

            <PassengerInput firstName={firstName} lastName={lastName} phone={phone} email={email} onFirstNameChange={(v) => { setFirstName(v); setSelectedTravelerId(undefined); setSelectedTraveler(null); }} onLastNameChange={(v) => { setLastName(v); setSelectedTravelerId(undefined); setSelectedTraveler(null); }} onPhoneChange={(v) => { setPhone(v); setSelectedTravelerId(undefined); setSelectedTraveler(null); }} onEmailChange={(v) => { setEmail(v); setSelectedTravelerId(undefined); setSelectedTraveler(null); }} />
          </div>
        )}
      </section>

      <div className="border-t border-white/10" />

      {/* Section: Journey */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted flex items-center gap-2">
          <svg className="w-4 h-4 text-[#ffd55c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="10" r="3" />
            <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z" />
          </svg>
          Journey Details
        </h3>
        <JourneyForm pickup={pickup} dropoff={dropoff} setPickup={setPickup} setDropoff={setDropoff} stops={stops} setStops={setStops} />
      </section>

      <div className="border-t border-white/10" />

      {/* Section: Vehicle */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted flex items-center gap-2">
          <svg className="w-4 h-4 text-[#ffd55c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.9 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8c-.3.5-.1 1.1.4 1.3l.5.2" />
            <circle cx="7" cy="17" r="2" />
            <circle cx="17" cy="17" r="2" />
          </svg>
          Vehicle
        </h3>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-3 sm:col-span-1 space-y-2">
            <label htmlFor="vehicletype" className="text-xs text-muted">Vehicle Type</label>
            <select id="vehicletype" value={vehicleType} onChange={(e) => { const newType = e.target.value as VehicleType; setVehicleType(newType); if (newType === "multiseater" && passengerCount < 5) { setPassengerCount(6); } }} className="w-full h-11 px-3 text-sm bg-surface border border-border rounded-md text-zinc-100 hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold">
              <option value="standard">🚗 Standard Saloon</option>
              <option value="multiseater">🚐 Multi-seater</option>
              <option value="luxury">⭐ Executive V-Class</option>
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="passengers" className="text-xs text-muted">Passengers</label>
            <select id="passengers" value={passengerCount} onChange={(e) => setPassengerCount(Number(e.target.value))} className="w-full h-11 px-3 text-sm bg-surface border border-border rounded-md text-zinc-100 hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (<option key={n} value={n}>{n}</option>))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="luggage" className="text-xs text-muted">Luggage</label>
            <select id="luggage" value={luggageCount} onChange={(e) => setLuggageCount(Number(e.target.value))} className="w-full h-11 px-3 text-sm bg-surface border border-border rounded-md text-zinc-100 hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold">
              {[0, 1, 2, 3, 4, 5].map((n) => (<option key={n} value={n}>{n}</option>))}
            </select>
          </div>
        </div>

        {vehicleType === "luxury" && (
          <div className="px-3 py-2 bg-[#ffd55c]/10 rounded-lg border border-[#ffd55c]/20 text-[11px] text-[#ffd55c] flex items-center gap-2">
            <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z" />
            </svg>
            Mercedes V-Class — £{LUXURY_HOURLY_RATE}/hr minimum
          </div>
        )}
      </section>

      <div className="border-t border-white/10" />

      {/* Section: When */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted flex items-center gap-2">
          <svg className="w-4 h-4 text-[#ffd55c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Pickup Time
        </h3>

        <div className="space-y-3">
          <div className="flex gap-3">
            <button type="button" onClick={() => setAsap(true)} className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg border transition ${asap ? "bg-[#ffd55c]/10 border-[#ffd55c] text-[#ffd55c]" : "bg-background border-white/10 text-muted hover:border-white/20"}`}>ASAP</button>
            <button type="button" onClick={() => setAsap(false)} className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg border transition ${!asap ? "bg-[#ffd55c]/10 border-[#ffd55c] text-[#ffd55c]" : "bg-background border-white/10 text-muted hover:border-white/20"}`}>Schedule</button>
          </div>

          {!asap && <DateTimeInput label="Pickup Date & Time" value={pickupDateTime} onChange={setPickupDateTime} minDateTime={getMinDateTime()} required />}
        </div>
      </section>

      <div className="border-t border-white/10" />

      {/* Section: Additional Info */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted flex items-center gap-2">
          <svg className="w-4 h-4 text-[#ffd55c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
          Additional Information
        </h3>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <label htmlFor="flight" className="text-xs text-muted">Flight Number</label>
            <input id="flight" value={flightNumber} onChange={(e) => setFlightNumber(e.target.value.toUpperCase())} placeholder="e.g. BA1325" maxLength={10} className="w-full h-11 px-3 text-sm bg-surface border border-border rounded-md text-zinc-100 placeholder-zinc-500 hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold" />
          </div>
          <div className="col-span-2 space-y-2">
            <label htmlFor="notes" className="text-xs text-muted">Special Instructions</label>
            <input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any special requirements..." className="w-full h-11 px-3 text-sm bg-surface border border-border rounded-md text-zinc-100 placeholder-zinc-500 hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold" />
          </div>
        </div>
      </section>
      </fieldset>

      {/* Result Message - with id for scroll targeting */}
      {bookingResult && (
        <div id="booking-result" className={`p-3 rounded-lg text-sm ${bookingResult.success ? (bookingResult.status === "pending" ? "bg-amber-500/10 border border-amber-500/30 text-amber-400" : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400") : "bg-red-500/10 border border-red-500/30 text-red-400"}`}>
          {bookingResult.success ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${bookingResult.status === "pending" ? "bg-amber-500/20" : "bg-emerald-500/20"}`}>
                  {bookingResult.status === "pending" ? (
                    <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  ) : (
                    <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  )}
                </div>
                <p className={`text-sm font-semibold ${bookingResult.status === "pending" ? "text-amber-300" : "text-emerald-300"}`}>
                  {bookingResult.status === "pending" ? "Pending Approval" : bookingResult.message || "Confirmed!"}
                </p>
              </div>
              <div className="bg-[#111] rounded-lg px-2.5 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#737373]">Ref:</span>
                  <span className="font-mono text-sm text-[#ffd55c] font-bold">{bookingResult.reference || bookingResult.bookingId}</span>
                  {bookingResult.status === "pending" && <span className="px-1.5 py-0.5 text-[9px] font-medium uppercase bg-amber-400/20 text-amber-400 rounded border border-amber-400/30">Pending</span>}
                </div>
                <button onClick={() => navigator.clipboard.writeText(bookingResult.reference || bookingResult.bookingId || "")} className="p-1.5 rounded bg-surface hover:bg-zinc-800 border border-white/10 hover:border-[#ffd55c]/50 transition" title="Copy">
                  <svg className="w-3.5 h-3.5 text-[#999]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" /></svg>
              <span className="text-sm">{bookingResult.error}</span>
            </div>
          )}
        </div>
      )}

      {/* Submit Button - min-h-[44px] for touch target accessibility */}
      <div className="pt-2">
        <button onClick={createBooking} disabled={isBooking} className="w-full py-3 min-h-[44px] bg-[#ffd55c] text-black font-semibold text-sm rounded-lg hover:bg-[#ffcc33] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[#ffd55c]/10">
          {isBooking ? (
            <>
              <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12h8" /></svg>
              Request Booking
            </>
          )}
        </button>
        <p className="text-[11px] text-center text-[#8a8a8a] mt-2">All bookings require approval before dispatch</p>
        
        {/* Terms & Conditions + Fare Disclaimer (PHASE 3) */}
        <div className="mt-3 pt-3 border-t border-white/5 text-[10px] text-[#666] text-center space-y-1">
          <p>By submitting, you agree to our <a href="/terms" className="text-[#ffd55c] hover:underline">Terms & Conditions</a>.</p>
          <p>Fare estimates are approximate and may vary based on traffic, waiting time, and route changes.</p>
        </div>
      </div>
    </div>
  );
}

