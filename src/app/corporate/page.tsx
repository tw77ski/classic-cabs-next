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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [selectedTravelerId, setSelectedTravelerId] = useState<string | undefined>();
  const [selectedTraveler, setSelectedTraveler] = useState<FrequentTraveler | null>(null);

  // Handle frequent traveler selection
  function handleSelectTraveler(traveler: FrequentTraveler) {
    setFirstName(traveler.firstName);
    setLastName(traveler.lastName);
    setPhone(traveler.phone);
    setEmail(traveler.email || "");
    setSelectedTravelerId(traveler.id);
    setSelectedTraveler(traveler);
  }

  // Use traveler's saved address for pickup or dropoff
  function useTravelerAddress(addressType: "home" | "work", target: "pickup" | "dropoff") {
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
    
    if (!firstName || !lastName) {
      setBookingResult({ error: "Passenger first and last name are required" });
      return;
    }
    if (!phone) {
      setBookingResult({ error: "Passenger phone number is required" });
      return;
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

          {/* Frequent Travelers & Passenger Details */}
          <div className="pt-3 border-t border-[#333]">
            <p className="text-[10px] uppercase tracking-widest text-[#666] mb-3">Passenger</p>
            
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
                        onClick={() => useTravelerAddress("home", "pickup")}
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
                        onClick={() => useTravelerAddress("home", "dropoff")}
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
                        onClick={() => useTravelerAddress("work", "pickup")}
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
                        onClick={() => useTravelerAddress("work", "dropoff")}
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
              className={`p-3 rounded-lg text-sm ${
                bookingResult.success
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                  : "bg-red-500/10 border border-red-500/30 text-red-400"
              }`}
            >
              {bookingResult.success
                ? `✓ Booking created! ID: ${bookingResult.bookingId}`
                : `✗ ${bookingResult.error}`}
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
