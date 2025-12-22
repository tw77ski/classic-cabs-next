// Multi-Passenger Booking Form
// Allows adding multiple passengers with optional different pickup points
// FEATURE_VERSION: 1.0

"use client";

import { useState } from "react";
import { FrequentTraveler, getFrequentTravelers } from "@/lib/frequentTravelers";

export interface PassengerEntry {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  // Optional different pickup for this passenger
  customPickup?: {
    address: string;
    lat?: number;
    lng?: number;
  };
  // Reference to frequent traveler if selected
  travelerId?: string;
}

interface MultiPassengerFormProps {
  passengers: PassengerEntry[];
  onPassengersChange: (passengers: PassengerEntry[]) => void;
  allowCustomPickups?: boolean;
  maxPassengers?: number;
}

function generateId(): string {
  return `p_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export default function MultiPassengerForm({
  passengers,
  onPassengersChange,
  allowCustomPickups = true,
  maxPassengers = 10,
}: MultiPassengerFormProps) {
  const [frequentTravelers] = useState<FrequentTraveler[]>(() => getFrequentTravelers());
  const [showTravelerDropdown, setShowTravelerDropdown] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  function addPassenger() {
    if (passengers.length >= maxPassengers) return;
    
    const newPassenger: PassengerEntry = {
      id: generateId(),
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
    };
    onPassengersChange([...passengers, newPassenger]);
  }

  function removePassenger(id: string) {
    if (passengers.length <= 1) return;
    onPassengersChange(passengers.filter((p) => p.id !== id));
  }

  function updatePassenger(id: string, updates: Partial<PassengerEntry>) {
    onPassengersChange(
      passengers.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  }

  function selectFrequentTraveler(passengerId: string, traveler: FrequentTraveler) {
    updatePassenger(passengerId, {
      firstName: traveler.firstName,
      lastName: traveler.lastName,
      phone: traveler.phone,
      email: traveler.email || "",
      travelerId: traveler.id,
      // Pre-fill home address if available
      customPickup: traveler.homeAddress?.address ? {
        address: traveler.homeAddress.address,
        lat: traveler.homeAddress.lat,
        lng: traveler.homeAddress.lng,
      } : undefined,
    });
    setShowTravelerDropdown(null);
    setSearchQuery("");
  }

  function toggleCustomPickup(id: string) {
    const passenger = passengers.find((p) => p.id === id);
    if (!passenger) return;

    if (passenger.customPickup) {
      // Remove custom pickup
      updatePassenger(id, { customPickup: undefined });
    } else {
      // Add empty custom pickup
      updatePassenger(id, { customPickup: { address: "" } });
    }
  }

  const filteredTravelers = searchQuery
    ? frequentTravelers.filter((t) => {
        const fullName = `${t.firstName} ${t.lastName}`.toLowerCase();
        return fullName.includes(searchQuery.toLowerCase());
      })
    : frequentTravelers;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[#ffd55c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span className="text-sm font-medium text-[#f5f5f5]">
            Passengers ({passengers.length})
          </span>
        </div>
        
        {passengers.length < maxPassengers && (
          <button
            type="button"
            onClick={addPassenger}
            className="flex items-center gap-1 px-2 py-1 text-xs text-[#ffd55c] border border-[#ffd55c]/30 rounded hover:bg-[#ffd55c]/10 transition"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v8M8 12h8" />
            </svg>
            Add Passenger
          </button>
        )}
      </div>

      {/* Passenger List */}
      <div className="space-y-3">
        {passengers.map((passenger, index) => (
          <div
            key={passenger.id}
            className="p-3 bg-[#111] border border-[#333] rounded-lg"
          >
            {/* Passenger Header */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-[#888]">
                Passenger {index + 1}
              </span>
              <div className="flex items-center gap-2">
                {/* Select from Frequent Travelers */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTravelerDropdown(
                      showTravelerDropdown === passenger.id ? null : passenger.id
                    )}
                    className="px-2 py-1 text-[10px] text-[#888] border border-[#333] rounded hover:border-[#ffd55c]/50 hover:text-[#ffd55c] transition"
                  >
                    Select Traveler
                  </button>
                  
                  {showTravelerDropdown === passenger.id && (
                    <div className="absolute z-50 right-0 top-full mt-1 w-64 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-xl overflow-hidden">
                      <div className="p-2 border-b border-[#333]">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search..."
                          className="w-full px-2 py-1 text-xs bg-[#111] border border-[#333] rounded text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        {filteredTravelers.length === 0 ? (
                          <p className="p-3 text-xs text-[#666] text-center">No travelers found</p>
                        ) : (
                          filteredTravelers.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => selectFrequentTraveler(passenger.id, t)}
                              className="w-full px-3 py-2 text-left hover:bg-[#252525] transition border-b border-[#222] last:border-b-0"
                            >
                              <p className="text-xs text-[#f5f5f5]">{t.firstName} {t.lastName}</p>
                              <p className="text-[10px] text-[#666]">{t.phone}</p>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                {passengers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePassenger(passenger.id)}
                    className="p-1 text-[#666] hover:text-red-400 transition"
                    title="Remove passenger"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Passenger Fields */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input
                type="text"
                value={passenger.firstName}
                onChange={(e) => updatePassenger(passenger.id, { firstName: e.target.value, travelerId: undefined })}
                placeholder="First name *"
                className="px-2 py-1.5 text-xs bg-[#0a0a0a] border border-[#222] rounded text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50"
              />
              <input
                type="text"
                value={passenger.lastName}
                onChange={(e) => updatePassenger(passenger.id, { lastName: e.target.value, travelerId: undefined })}
                placeholder="Last name *"
                className="px-2 py-1.5 text-xs bg-[#0a0a0a] border border-[#222] rounded text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <input
                type="tel"
                value={passenger.phone}
                onChange={(e) => updatePassenger(passenger.id, { phone: e.target.value, travelerId: undefined })}
                placeholder="Phone *"
                className="px-2 py-1.5 text-xs bg-[#0a0a0a] border border-[#222] rounded text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50"
              />
              <input
                type="email"
                value={passenger.email || ""}
                onChange={(e) => updatePassenger(passenger.id, { email: e.target.value })}
                placeholder="Email"
                className="px-2 py-1.5 text-xs bg-[#0a0a0a] border border-[#222] rounded text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50"
              />
            </div>

            {/* Custom Pickup Option */}
            {allowCustomPickups && (
              <div className="mt-3 pt-3 border-t border-[#222]">
                <button
                  type="button"
                  onClick={() => toggleCustomPickup(passenger.id)}
                  className={`flex items-center gap-2 text-[10px] transition ${
                    passenger.customPickup 
                      ? "text-[#ffd55c]" 
                      : "text-[#666] hover:text-[#888]"
                  }`}
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {passenger.customPickup ? "Different pickup location" : "Add different pickup location"}
                </button>
                
                {passenger.customPickup && (
                  <div className="mt-2">
                    <input
                      type="text"
                      value={passenger.customPickup.address}
                      onChange={(e) => updatePassenger(passenger.id, {
                        customPickup: { ...passenger.customPickup, address: e.target.value }
                      })}
                      placeholder="Pickup address for this passenger..."
                      className="w-full px-2 py-1.5 text-xs bg-[#0a0a0a] border border-[#ffd55c]/30 rounded text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#ffd55c]/50"
                    />
                    <p className="text-[9px] text-[#555] mt-1">
                      This passenger will be picked up from a different location
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      {passengers.length > 1 && (
        <div className="p-3 bg-[#ffd55c]/5 border border-[#ffd55c]/20 rounded-lg">
          <div className="flex items-center gap-2 text-xs text-[#ccc]">
            <svg className="w-4 h-4 text-[#ffd55c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            <span>
              <strong>{passengers.length} passengers</strong>
              {passengers.filter(p => p.customPickup?.address).length > 0 && (
                <> • {passengers.filter(p => p.customPickup?.address).length} with different pickups</>
              )}
            </span>
          </div>
          {passengers.filter(p => p.customPickup?.address).length > 0 && (
            <p className="text-[10px] text-[#888] mt-1 ml-6">
              Separate bookings will be created for passengers with different pickup locations
            </p>
          )}
        </div>
      )}
    </div>
  );
}








