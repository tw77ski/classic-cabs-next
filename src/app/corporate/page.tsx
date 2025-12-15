// Corporate Booking Page
// /corporate
// Main corporate booking form - restricted to logged-in user's company

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import JourneyForm from "../components/JourneyForm";
import DateTimeInput from "../components/DateTimeInput";
import PassengerInput from "../components/PassengerInput";
import FrequentTravelerSelect from "../components/FrequentTravelerSelect";
import MultiPassengerForm, { PassengerEntry } from "../components/MultiPassengerForm";
import { saveRecentPassenger } from "@/lib/recentPassengers";
import { FrequentTraveler, markTravelerUsed } from "@/lib/frequentTravelers";

/* API ENDPOINTS */
const BOOK_API = "/api/corporate-book";
const HISTORY_API = "/api/corporate-history";
const SESSION_API = "/api/corporate/auth/session";

/* TYPES */
interface Location {
  address: string;
  lat: number | null;
  lng: number | null;
}

type CorporateSession = {
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
};

type HistoryJob = {
  id: string | number;
  ref?: string;
  pickup_time?: string;
  from?: string;
  to?: string;
  fare?: number;
};

type HistoryResponse = {
  success: boolean;
  from: string;
  to: string;
  totalJobs?: number;
  totalFare?: number;
  currency?: string;
  jobs: HistoryJob[];
};

/* HELPERS */
function formatDateTime(dt?: string) {
  if (!dt) return "";
  const d = new Date(dt);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit", 
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* CSV EXPORT */
function exportCSV(history: HistoryResponse | null, companyName: string) {
  if (!history) return;

  const headers = ["Ref", "Pickup Time", "From", "To", "Fare"];
  const rows = history.jobs.map((j) => [
    j.ref || j.id,
    j.pickup_time,
    j.from,
    j.to,
    j.fare?.toFixed(2) || "0.00",
  ]);

  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${v ?? ""}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${companyName.replace(/\s+/g, "_")}_bookings.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* PDF EXPORT */
async function exportPDF(history: HistoryResponse | null, companyName: string) {
  if (!history) return;
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  
  doc.setFontSize(16);
  doc.text(`${companyName} - Booking History`, 20, 20);
  doc.setFontSize(10);
  doc.text(`Period: ${formatDateTime(history.from)} - ${formatDateTime(history.to)}`, 20, 30);
  
  if (history.totalJobs !== undefined) {
    doc.text(`Total Jobs: ${history.totalJobs} | Total Fare: ${history.currency || "GBP"} ${history.totalFare?.toFixed(2) || "0.00"}`, 20, 38);
  }
  
  doc.setFontSize(9);
  let y = 50;
  history.jobs.forEach((j) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(
      `#${j.ref || j.id} | ${formatDateTime(j.pickup_time)} | ${j.from} → ${j.to} | £${j.fare?.toFixed(2) || "0.00"}`,
      20,
      y
    );
    y += 7;
  });
  
  doc.save(`${companyName.replace(/\s+/g, "_")}_bookings.pdf`);
}

/* MAIN COMPONENT */
export default function CorporatePage() {
  const router = useRouter();
  
  // Session state
  const [session, setSession] = useState<CorporateSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  // Form state
  const [contactPerson, setContactPerson] = useState("");
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
    { id: "initial", firstName: "", lastName: "", phone: "", email: "" }
  ]);

  // Handle frequent traveler selection
  function handleSelectTraveler(traveler: FrequentTraveler) {
    setFirstName(traveler.firstName);
    setLastName(traveler.lastName);
    setPhone(traveler.phone);
    setEmail(traveler.email || "");
    setSelectedTravelerId(traveler.id);
    setSelectedTraveler(traveler);
  }

  // Apply traveler's saved address for pickup or dropoff
  function applyTravelerAddress(addressType: "home" | "work", target: "pickup" | "dropoff") {
    if (!selectedTraveler) return;
    
    const address = addressType === "home" 
      ? selectedTraveler.homeAddress 
      : selectedTraveler.workAddress;
    
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
  const [pickup, setPickup] = useState<Location>({ address: "", lat: null, lng: null });
  const [dropoff, setDropoff] = useState<Location>({ address: "", lat: null, lng: null });
  const [stops, setStops] = useState<Location[]>([]);
  const [notes, setNotes] = useState("");
  const [asap, setAsap] = useState(true);
  const [pickupDateTime, setPickupDateTime] = useState("");
  const [selectedCostCentre, setSelectedCostCentre] = useState("");

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

  // History state
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // Booking state
  const [isBooking, setIsBooking] = useState(false);
  const [bookingResult, setBookingResult] = useState<{
    success?: boolean;
    error?: string;
    bookingId?: string;
    message?: string;
  } | null>(null);

  /* Load session on mount */
  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch(SESSION_API);
        const data = await res.json();
        
        if (!data.authenticated || !data.user || !data.company) {
          router.push("/corporate/login");
          return;
        }
        
        // Build session object from response
        const sessionData: CorporateSession = {
          user: data.user,
          company: data.company,
        };
        
        setSession(sessionData);
        
        // Pre-fill contact person with logged-in user's name
        if (data.user.name) {
          setContactPerson(data.user.name);
        }
        
        // Load history for the company's TaxiCaller account
        if (data.company.taxiCallerAccountId) {
          loadHistory(data.company.taxiCallerAccountId);
        }
      } catch (err) {
        console.error("Failed to load session:", err);
        router.push("/corporate/login");
      } finally {
        setSessionLoading(false);
      }
    }
    
    loadSession();
  }, [router]);

  /* Fetch history */
  async function loadHistory(accountId: number) {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${HISTORY_API}?accountId=${accountId}`);
      const json = await res.json();
      if (json.success) {
        setHistory(json);
      }
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setHistoryLoading(false);
    }
  }

  /* Create booking */
  async function createBooking() {
    if (!session) return;
    
    // Validate based on mode
    if (isMultiPassenger) {
      // Multi-passenger validation
      const validPassengers = multiPassengers.filter(p => p.firstName && p.lastName && p.phone);
      if (validPassengers.length === 0) {
        setBookingResult({ error: "At least one passenger with name and phone is required" });
        return;
      }
    } else {
      // Single passenger validation
      if (!firstName || !lastName) {
        setBookingResult({ error: "Passenger first and last name are required" });
        return;
      }
      if (!phone) {
        setBookingResult({ error: "Passenger phone number is required" });
        return;
      }
    }
    
    if (!pickup.address || !dropoff.address) {
      setBookingResult({ error: "Pickup and dropoff addresses are required" });
      return;
    }
    if (!pickup.lat || !pickup.lng) {
      setBookingResult({ error: "Please select a valid pickup address from the suggestions" });
      return;
    }
    if (!dropoff.lat || !dropoff.lng) {
      setBookingResult({ error: "Please select a valid dropoff address from the suggestions" });
      return;
    }

    setIsBooking(true);
    setBookingResult(null);

    try {
      // Prepare stops data
      const stopsData = stops
        .filter(s => s.address && s.lat && s.lng)
        .map(s => s.address);

      if (isMultiPassenger) {
        // Multi-passenger booking
        const validPassengers = multiPassengers.filter(p => p.firstName && p.lastName && p.phone);
        
        // Group passengers by pickup location
        const sharedPickupPassengers = validPassengers.filter(p => !p.customPickup?.address);
        const customPickupPassengers = validPassengers.filter(p => p.customPickup?.address);
        
        const bookingResults: { success: boolean; bookingId?: string; passenger: string; error?: string }[] = [];
        
        // Book shared pickup passengers together (one booking with multiple passengers in notes)
        if (sharedPickupPassengers.length > 0) {
          const passengerNames = sharedPickupPassengers.map(p => `${p.firstName} ${p.lastName}`).join(", ");
          const passengerPhones = sharedPickupPassengers.map(p => p.phone).join(", ");
          const multiNotes = `GROUP BOOKING (${sharedPickupPassengers.length} passengers): ${passengerNames}\nPhones: ${passengerPhones}${notes ? `\n${notes}` : ""}`;
          
          const res = await fetch(BOOK_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              companyName: session.company.name,
              contactPerson,
              poNumber,
              firstName: sharedPickupPassengers[0].firstName,
              lastName: sharedPickupPassengers[0].lastName,
              phone: sharedPickupPassengers[0].phone,
              email: sharedPickupPassengers[0].email,
              pickupAddress: pickup.address,
              pickupLat: pickup.lat,
              pickupLng: pickup.lng,
              dropoffAddress: dropoff.address,
              dropoffLat: dropoff.lat,
              dropoffLng: dropoff.lng,
              stops: stopsData,
              time: asap ? null : pickupDateTime || null,
              notes: multiNotes,
              accountId: session.company.taxiCallerAccountId,
              costCentre: selectedCostCentre || undefined,
              passengerCount: sharedPickupPassengers.length,
            }),
          });
          
          const json = await res.json();
          bookingResults.push({
            success: json.success,
            bookingId: json.booking_id || json.job_id,
            passenger: passengerNames,
            error: json.error,
          });
          
          // Save passengers for autofill
          sharedPickupPassengers.forEach(p => {
            saveRecentPassenger({ firstName: p.firstName, lastName: p.lastName, phone: p.phone, email: p.email });
            if (p.travelerId) markTravelerUsed(p.travelerId);
          });
        }
        
        // Book custom pickup passengers separately
        for (const passenger of customPickupPassengers) {
          const customNotes = `Different pickup location${notes ? `\n${notes}` : ""}`;
          
          const res = await fetch(BOOK_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              companyName: session.company.name,
              contactPerson,
              poNumber,
              firstName: passenger.firstName,
              lastName: passenger.lastName,
              phone: passenger.phone,
              email: passenger.email,
              pickupAddress: passenger.customPickup?.address || pickup.address,
              pickupLat: passenger.customPickup?.lat || pickup.lat,
              pickupLng: passenger.customPickup?.lng || pickup.lng,
              dropoffAddress: dropoff.address,
              dropoffLat: dropoff.lat,
              dropoffLng: dropoff.lng,
              stops: stopsData,
              time: asap ? null : pickupDateTime || null,
              notes: customNotes,
              accountId: session.company.taxiCallerAccountId,
              costCentre: selectedCostCentre || undefined,
            }),
          });
          
          const json = await res.json();
          bookingResults.push({
            success: json.success,
            bookingId: json.booking_id || json.job_id,
            passenger: `${passenger.firstName} ${passenger.lastName}`,
            error: json.error,
          });
          
          saveRecentPassenger({ firstName: passenger.firstName, lastName: passenger.lastName, phone: passenger.phone, email: passenger.email });
          if (passenger.travelerId) markTravelerUsed(passenger.travelerId);
        }
        
        // Summarize results
        const successCount = bookingResults.filter(r => r.success).length;
        const failCount = bookingResults.filter(r => !r.success).length;
        
        if (failCount === 0) {
          const bookingIds = bookingResults.map(r => r.bookingId).join(", ");
          setBookingResult({ 
            success: true, 
            bookingId: bookingIds,
            message: `${successCount} booking(s) created successfully`
          });
        } else if (successCount > 0) {
          setBookingResult({ 
            success: true, 
            bookingId: bookingResults.filter(r => r.success).map(r => r.bookingId).join(", "),
            error: `${successCount} succeeded, ${failCount} failed`
          });
        } else {
          setBookingResult({ error: bookingResults[0]?.error || "All bookings failed" });
        }
        
      } else {
        // Single passenger booking (original logic)
        const res = await fetch(BOOK_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyName: session.company.name,
            contactPerson,
            poNumber,
            firstName,
            lastName,
            phone,
            email,
            pickupAddress: pickup.address,
            pickupLat: pickup.lat,
            pickupLng: pickup.lng,
            dropoffAddress: dropoff.address,
            dropoffLat: dropoff.lat,
            dropoffLng: dropoff.lng,
            stops: stopsData,
            time: asap ? null : pickupDateTime || null,
            notes,
            accountId: session.company.taxiCallerAccountId,
            costCentre: selectedCostCentre || undefined,
          }),
        });

        const json = await res.json();

        if (!json.success) {
          setBookingResult({ error: json.error || "Booking failed" });
          return;
        }

        setBookingResult({ success: true, bookingId: json.booking_id || json.job_id });
        
        // Update frequent traveler stats if one was selected
        if (selectedTravelerId) {
          markTravelerUsed(selectedTravelerId);
        }
        
        // Save passenger for future autofill
        saveRecentPassenger({
          firstName,
          lastName,
          phone,
          email,
        });
      }
      
      // Refresh history
      loadHistory(session.company.taxiCallerAccountId);

      // Clear form (keep contact person)
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
      setAsap(true);
      setPickupDateTime("");
      setSelectedCostCentre("");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Booking failed";
      setBookingResult({ error: errorMessage });
    } finally {
      setIsBooking(false);
    }
  }

  // Loading state
  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#ffd55c]/30 border-t-[#ffd55c] rounded-full animate-spin" />
      </div>
    );
  }

  // No session (shouldn't happen as we redirect)
  if (!session) {
    return null;
  }

  /* UI */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#f5f5f5]">
            Corporate Booking
          </h2>
          <p className="text-sm text-[#888]">
            Book rides for {session.company.name}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#ffd55c]">Account #{session.company.taxiCallerAccountId}</p>
          <p className="text-[10px] text-[#666]">Logged in as {session.user.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BOOKING FORM */}
        <div className="bg-[#1b1b1b] border border-[#333] rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-[#f5f5f5] flex items-center gap-2">
            <svg
              className="w-4 h-4 text-[#ffd55c]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v8M8 12h8" />
            </svg>
            New Booking
          </h3>

          {/* Company Info (Read-only) */}
          <div className="p-3 bg-[#ffd55c]/5 border border-[#ffd55c]/20 rounded-lg">
            <p className="text-xs text-[#888] mb-1">Billing Account</p>
            <p className="text-sm font-medium text-[#f5f5f5]">{session.company.name}</p>
            <p className="text-[10px] text-[#666]">All bookings will be charged to this account</p>
          </div>

          {/* Contact Person & PO Number */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#888] mb-1 block">
                Contact Person (Booker) *
              </label>
              <input
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2 text-sm bg-[#111] border border-[#333] rounded-lg text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50"
              />
            </div>
            <div>
              <label className="text-xs text-[#888] mb-1 block">
                PO Number (Optional)
              </label>
              <input
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                placeholder="Purchase order ref"
                className="w-full px-3 py-2 text-sm bg-[#111] border border-[#333] rounded-lg text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50"
              />
            </div>
          </div>

          {/* Cost Centre (if available) */}
          {session.company.costCentres && session.company.costCentres.length > 0 && (
            <div>
              <label className="text-xs text-[#888] mb-1 block">
                Cost Centre
              </label>
              <select
                value={selectedCostCentre}
                onChange={(e) => setSelectedCostCentre(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#111] border border-[#333] rounded-lg text-[#f5f5f5] focus:outline-none focus:border-[#ffd55c]/50"
              >
                <option value="">Select cost centre (optional)</option>
                {session.company.costCentres.filter(cc => cc.active).map((cc) => (
                  <option key={cc.id} value={cc.code}>
                    {cc.name} ({cc.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Passenger Section */}
          <div className="pt-3 border-t border-[#333]">
            {/* Single/Multi Toggle */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-widest text-[#666]">
                {isMultiPassenger ? "Passengers" : "Passenger"}
              </p>
              <button
                type="button"
                onClick={() => setIsMultiPassenger(!isMultiPassenger)}
                className={`flex items-center gap-1.5 px-2 py-1 text-[10px] rounded transition ${
                  isMultiPassenger
                    ? "bg-[#ffd55c]/10 border border-[#ffd55c]/30 text-[#ffd55c]"
                    : "border border-[#333] text-[#888] hover:border-[#555]"
                }`}
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                {isMultiPassenger ? "Multiple Passengers" : "Add Multiple"}
              </button>
            </div>

            {isMultiPassenger ? (
              /* Multi-Passenger Mode */
              <MultiPassengerForm
                passengers={multiPassengers}
                onPassengersChange={setMultiPassengers}
                allowCustomPickups={true}
                maxPassengers={10}
              />
            ) : (
              /* Single Passenger Mode */
              <>
                {/* Frequent Traveler Select */}
                <FrequentTravelerSelect
                  onSelect={handleSelectTraveler}
                  selectedId={selectedTravelerId}
                />

                {/* Quick Address Buttons - show when traveler has saved addresses */}
                {selectedTraveler && (selectedTraveler.homeAddress?.address || selectedTraveler.workAddress?.address) && (
                  <div className="mt-3 p-3 bg-[#ffd55c]/5 border border-[#ffd55c]/20 rounded-lg">
                    <p className="text-[10px] text-[#888] mb-2 flex items-center gap-1">
                      <svg className="w-3 h-3 text-[#ffd55c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      {firstName}&apos;s Saved Addresses
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedTraveler.homeAddress?.address && (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => applyTravelerAddress("home", "pickup")}
                            className="px-2 py-1 text-xs bg-[#111] border border-[#333] rounded hover:border-[#ffd55c]/50 text-[#ccc] transition flex items-center gap-1"
                            title={selectedTraveler.homeAddress.address}
                          >
                            <svg className="w-3 h-3 text-[#888]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            </svg>
                            Home → Pickup
                          </button>
                          <button
                            type="button"
                            onClick={() => applyTravelerAddress("home", "dropoff")}
                            className="px-2 py-1 text-xs bg-[#111] border border-[#333] rounded hover:border-[#ffd55c]/50 text-[#ccc] transition flex items-center gap-1"
                            title={selectedTraveler.homeAddress.address}
                          >
                            Home → Drop-off
                          </button>
                        </div>
                      )}
                      {selectedTraveler.workAddress?.address && (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => applyTravelerAddress("work", "pickup")}
                            className="px-2 py-1 text-xs bg-[#111] border border-[#333] rounded hover:border-[#ffd55c]/50 text-[#ccc] transition flex items-center gap-1"
                            title={selectedTraveler.workAddress.address}
                          >
                            <svg className="w-3 h-3 text-[#888]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="2" y="7" width="20" height="14" rx="2" />
                            </svg>
                            Work → Pickup
                          </button>
                          <button
                            type="button"
                            onClick={() => applyTravelerAddress("work", "dropoff")}
                            className="px-2 py-1 text-xs bg-[#111] border border-[#333] rounded hover:border-[#ffd55c]/50 text-[#ccc] transition flex items-center gap-1"
                            title={selectedTraveler.workAddress.address}
                          >
                            Work → Drop-off
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Manual Entry / Selected Traveler Details */}
                <div className="mt-3 pt-3 border-t border-[#222]">
                  <p className="text-[10px] text-[#666] mb-2">
                    {selectedTravelerId ? "Selected traveler details:" : "Or enter passenger details manually:"}
                  </p>
                  <PassengerInput
                    firstName={firstName}
                    lastName={lastName}
                    phone={phone}
                    email={email}
                onFirstNameChange={(v) => { setFirstName(v); setSelectedTravelerId(undefined); setSelectedTraveler(null); }}
                onLastNameChange={(v) => { setLastName(v); setSelectedTravelerId(undefined); setSelectedTraveler(null); }}
                onPhoneChange={(v) => { setPhone(v); setSelectedTravelerId(undefined); setSelectedTraveler(null); }}
                onEmailChange={(v) => { setEmail(v); setSelectedTravelerId(undefined); setSelectedTraveler(null); }}
              />
            </div>
              </>
            )}
          </div>

          {/* Journey Details */}
          <div className="pt-3 border-t border-[#333]">
            <p className="text-[10px] uppercase tracking-widest text-[#666] mb-3">Journey Details</p>
            
            <JourneyForm
              pickup={pickup}
              dropoff={dropoff}
              setPickup={setPickup}
              setDropoff={setDropoff}
              stops={stops}
              setStops={setStops}
            />
          </div>

          {/* Date/Time */}
          <div className="pt-3 border-t border-[#333]">
            <p className="text-[10px] uppercase tracking-widest text-[#666] mb-3">Pickup Time</p>
            
            {/* ASAP Toggle */}
            <div className="flex items-center gap-3 mb-3">
              <button
                type="button"
                onClick={() => setAsap(true)}
                className={`flex-1 py-2 px-3 text-sm rounded-lg border transition ${
                  asap
                    ? "bg-[#ffd55c]/10 border-[#ffd55c] text-[#ffd55c]"
                    : "bg-[#111] border-[#333] text-[#888] hover:border-[#555]"
                }`}
              >
                ASAP
              </button>
              <button
                type="button"
                onClick={() => setAsap(false)}
                className={`flex-1 py-2 px-3 text-sm rounded-lg border transition ${
                  !asap
                    ? "bg-[#ffd55c]/10 border-[#ffd55c] text-[#ffd55c]"
                    : "bg-[#111] border-[#333] text-[#888] hover:border-[#555]"
                }`}
              >
                Schedule
              </button>
            </div>

            {/* Scheduled Time Picker */}
            {!asap && (
              <DateTimeInput
                label="Pickup Date & Time"
                value={pickupDateTime}
                onChange={setPickupDateTime}
                minDateTime={getMinDateTime()}
                required
              />
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-[#888] mb-1 block">
              Notes (Optional)
            </label>
            <textarea
              placeholder="Flight number, special instructions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#111] border border-[#333] rounded-lg text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50 resize-none h-16"
            />
          </div>

          {/* Result Message */}
          {bookingResult && (
            <div
              className={`p-4 rounded-xl text-sm relative overflow-hidden ${
                bookingResult.success
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 booking-success-enter"
                  : "bg-red-500/10 border border-red-500/30 text-red-400"
              }`}
            >
              {bookingResult.success ? (
                <div>
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

                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center checkmark-circle flex-shrink-0">
                      <svg className="w-6 h-6 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline className="checkmark-check" points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-emerald-300">{bookingResult.message || "Booking Created!"}</p>
                      <p className="text-xs text-emerald-400/70">Successfully added to account</p>
                    </div>
                  </div>
                  
                  <div className="bg-[#111] rounded-lg p-3 flex items-center justify-between group">
                    <div>
                      <p className="text-[10px] text-[#666] uppercase tracking-wider mb-1">Booking ID</p>
                      <p className="font-mono text-lg text-[#ffd55c] font-bold">{bookingResult.bookingId}</p>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(bookingResult.bookingId || "");
                        const btn = document.getElementById("copy-btn-corporate");
                        if (btn) {
                          btn.classList.add("copied");
                          setTimeout(() => btn.classList.remove("copied"), 2000);
                        }
                      }}
                      id="copy-btn-corporate"
                      className="relative p-2 rounded-lg bg-[#1b1b1b] hover:bg-[#222] border border-[#333] hover:border-[#ffd55c]/50 transition group/btn"
                      title="Copy booking ID"
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
                  
                  {bookingResult.error && (
                    <p className="text-xs mt-3 text-amber-400 flex items-center gap-1">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 8v4M12 16h.01" />
                      </svg>
                      Note: {bookingResult.error}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M15 9l-6 6M9 9l6 6" />
                  </svg>
                  <span>{bookingResult.error}</span>
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={createBooking}
            disabled={isBooking}
            className="w-full py-3 bg-[#ffd55c] text-black font-semibold rounded-lg hover:bg-[#ffcc33] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isBooking ? (
              <>
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Creating Booking...
              </>
            ) : (
              "Book to Account"
            )}
          </button>
        </div>

        {/* HISTORY PANEL */}
        <div className="bg-[#1b1b1b] border border-[#333] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[#f5f5f5]">
                Account History
              </h3>
              <p className="text-[10px] text-[#666]">{session.company.name}</p>
            </div>
            {history && history.jobs.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => exportCSV(history, session.company.name)}
                  className="px-2 py-1 text-xs border border-[#333] text-[#888] hover:text-[#ffd55c] hover:border-[#ffd55c]/50 rounded transition"
                >
                  CSV
                </button>
                <button
                  onClick={() => exportPDF(history, session.company.name)}
                  className="px-2 py-1 text-xs border border-[#333] text-[#888] hover:text-[#ffd55c] hover:border-[#ffd55c]/50 rounded transition"
                >
                  PDF
                </button>
              </div>
            )}
          </div>

          {/* Summary Stats */}
          {history && (history.totalJobs !== undefined || history.totalFare !== undefined) && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 bg-[#111] rounded-lg border border-[#222]">
                <p className="text-[10px] text-[#666] uppercase">Total Jobs</p>
                <p className="text-lg font-bold text-[#f5f5f5]">{history.totalJobs || 0}</p>
              </div>
              <div className="p-3 bg-[#111] rounded-lg border border-[#222]">
                <p className="text-[10px] text-[#666] uppercase">Total Spend</p>
                <p className="text-lg font-bold text-[#ffd55c]">
                  {history.currency || "£"}{history.totalFare?.toFixed(2) || "0.00"}
                </p>
              </div>
            </div>
          )}

          {historyLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-[#ffd55c]/30 border-t-[#ffd55c] rounded-full animate-spin" />
            </div>
          ) : !history || history.jobs.length === 0 ? (
            <p className="text-sm text-[#666] text-center py-8">
              No recent bookings found
            </p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {history.jobs.slice(0, 15).map((job) => (
                <div
                  key={job.id}
                  className="p-3 bg-[#111] rounded-lg border border-[#222]"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-[#ffd55c]">
                      #{job.ref || job.id}
                    </span>
                    <span className="text-xs text-[#888]">
                      {formatDateTime(job.pickup_time)}
                    </span>
                  </div>
                  <p className="text-sm text-[#ccc] truncate">
                    {job.from} → {job.to}
                  </p>
                  {job.fare !== undefined && (
                    <p className="text-xs text-[#888] mt-1">
                      £{job.fare.toFixed(2)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
