// NOTE: Mapbox geocoding only — TaxiCaller geocoding removed
// FEATURE_VERSION: 3.0

"use client";

import { useState, useEffect } from "react";
import AutocompleteInput from "./AutocompleteInput";
import { searchAddress } from "../lib/api";
import { saveRecentAddress } from "@/lib/recentAddresses";

interface Location {
  address: string;
  lat: number | null;
  lng: number | null;
}

interface JourneyFormProps {
  pickup: Location;
  dropoff: Location;
  setPickup: (val: Location) => void;
  setDropoff: (val: Location) => void;
  stops: Location[];
  setStops: (val: Location[]) => void;
  onShowReturnSuggestion?: () => void;
  showReturnSuggestion?: boolean;
  onAcceptReturnSuggestion?: () => void;
}

// Check if geolocation is available
function isGeolocationAvailable(): boolean {
  return typeof window !== "undefined" && "geolocation" in navigator;
}

// Animated stop row component
function AnimatedStopRow({ 
  stop, 
  index, 
  onUpdate, 
  onRemove,
  isNew 
}: { 
  stop: Location; 
  index: number; 
  onUpdate: (val: Location) => void; 
  onRemove: () => void;
  isNew: boolean;
}) {
  const [isVisible, setIsVisible] = useState(!isNew);

  useEffect(() => {
    if (isNew) {
      // Trigger animation after mount
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    }
  }, [isNew]);

  return (
    <div 
      className={`transition-all duration-250 ease-out ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="flex gap-2 items-end py-0.5">
        <div className="flex-1">
          <AutocompleteInput
            label={`Stop ${index + 1}`}
            placeholder="Enter stop address..."
            value={stop}
            setValue={onUpdate}
            onSearch={searchAddress}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M12 8v8M8 12h8" />
              </svg>
            }
          />
        </div>
        <button
          onClick={onRemove}
          className="glow-card mb-1 p-1.5 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40"
          aria-label="Remove stop"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function JourneyForm({ 
  pickup, 
  dropoff, 
  setPickup, 
  setDropoff, 
  stops, 
  setStops,
  showReturnSuggestion = false,
  onAcceptReturnSuggestion,
}: JourneyFormProps) {
  // Track which stops are newly added for animation
  const [newStopIndices, setNewStopIndices] = useState<Set<number>>(new Set());
  // Track stops being removed for exit animation
  const [removingIndices, setRemovingIndices] = useState<Set<number>>(new Set());
  
  // Use My Location state
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [hasGeolocation, setHasGeolocation] = useState(false);

  // Check for geolocation support on mount
  useEffect(() => {
    setHasGeolocation(isGeolocationAvailable());
  }, []);

  // Clear location error after 5 seconds
  useEffect(() => {
    if (locationError) {
      const timer = setTimeout(() => setLocationError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [locationError]);

  // Handle "Use My Location" click - uses Mapbox reverse geocoding
  async function handleUseMyLocation() {
    if (!isGeolocationAvailable()) {
      setLocationError("Geolocation is not supported by your browser");
      return;
    }

    setIsLoadingLocation(true);
    setLocationError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        });
      });

      const { latitude, longitude } = position.coords;

      // Reverse geocode using Mapbox/Nominatim
      const response = await fetch(`/api/geocode?lat=${latitude}&lng=${longitude}`);
      
      if (!response.ok) {
        throw new Error("Failed to get address for your location");
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      const address = data.address || data.label || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      
      // Set pickup with the geocoded address
      setPickup({
        address,
        lat: latitude,
        lng: longitude,
      });

      // Save to recent addresses
      saveRecentAddress({
        label: address,
        lat: latitude,
        lng: longitude,
      });

    } catch (error: unknown) {
      if (error instanceof GeolocationPositionError) {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError("Location access denied. Please enable location permissions.");
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError("Location unavailable. Please try again.");
            break;
          case error.TIMEOUT:
            setLocationError("Location request timed out. Please try again.");
            break;
          default:
            setLocationError("Could not get your location.");
        }
      } else if (error instanceof Error) {
        setLocationError(error.message);
      } else {
        setLocationError("Could not get your location. Please try again.");
      }
    } finally {
      setIsLoadingLocation(false);
    }
  }

  function updateStop(i: number, value: Location) {
    const updated = [...stops];
    updated[i] = value;
    setStops(updated);
  }

  function addStop() {
    const newIndex = stops.length;
    setNewStopIndices(prev => new Set(prev).add(newIndex));
    setStops([...stops, { address: "", lat: null, lng: null }]);
    
    // Clear the "new" flag after animation completes
    setTimeout(() => {
      setNewStopIndices(prev => {
        const next = new Set(prev);
        next.delete(newIndex);
        return next;
      });
    }, 300);
  }

  function removeStop(i: number) {
    // Mark as removing to trigger exit animation
    setRemovingIndices(prev => new Set(prev).add(i));
    
    // Actually remove after animation
    setTimeout(() => {
      setStops(stops.filter((_, idx) => idx !== i));
      setRemovingIndices(prev => {
        const next = new Set(prev);
        next.delete(i);
        return next;
      });
    }, 200);
  }

  return (
    <div className="space-y-1">
      {/* Location Error Message */}
      {locationError && (
        <div className="mb-2 p-2 bg-red-500/10 border border-red-500/30 rounded-md text-xs text-red-400 flex items-center gap-2">
          <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          {locationError}
        </div>
      )}

      {/* Pickup */}
      <AutocompleteInput 
        label="Pickup" 
        placeholder="Enter pickup address..."
        value={pickup} 
        setValue={setPickup} 
        onSearch={searchAddress}
        showUseMyLocation={hasGeolocation}
        onUseMyLocation={handleUseMyLocation}
        isLoadingLocation={isLoadingLocation}
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="10" r="3" />
            <path d="M12 2a8 8 0 0 0-8 8c0 5.4 8 12 8 12s8-6.6 8-12a8 8 0 0 0-8-8z" />
          </svg>
        }
      />

      {/* Add Stop button */}
      <button
        onClick={addStop}
        className="glow-card text-xs text-[#ffd55c] hover:text-[#ffcc33] flex items-center gap-1 py-1.5 px-3 mt-1 border border-[#ffd55c]/20 hover:border-[#ffd55c]/40 bg-[#ffd55c]/5"
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add Stop
      </button>

      {/* Animated Stops - each stop needs relative positioning for dropdown z-index */}
      {stops.map((stop, i) => (
        <div 
          key={i}
          className={`relative grid transition-all duration-200 ease-out ${
            removingIndices.has(i) ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'
          }`}
          style={{ zIndex: 60 - i }} // Higher z-index for earlier stops
        >
          {/* Use overflow-hidden only during remove animation, otherwise allow dropdown overflow */}
          <div className={removingIndices.has(i) ? 'overflow-hidden' : ''}>
            <AnimatedStopRow
              stop={stop}
              index={i}
              onUpdate={(val) => updateStop(i, val)}
              onRemove={() => removeStop(i)}
              isNew={newStopIndices.has(i)}
            />
          </div>
        </div>
      ))}

      {/* Faint divider line */}
      <div className="border-t border-[#ffffff10] my-2" />

      {/* Drop-off */}
      <AutocompleteInput
        label="Drop-off"
        placeholder="Enter destination..."
        value={dropoff}
        setValue={setDropoff}
        onSearch={searchAddress}
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        }
      />

      {/* Return Journey Suggestion */}
      {showReturnSuggestion && onAcceptReturnSuggestion && (
        <div className="glow-row mt-3 p-3 bg-[#ffd55c]/5 border border-[#ffd55c]/20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[#ffd55c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 14l-4-4 4-4" />
                <path d="M5 10h11a4 4 0 1 1 0 8h-1" />
              </svg>
              <span className="text-xs text-[#ccc]">Would you like to book a return journey?</span>
            </div>
            <button
              type="button"
              onClick={onAcceptReturnSuggestion}
              className="glow-card text-xs px-3 py-1.5 bg-[#ffd55c]/10 border border-[#ffd55c]/30 text-[#ffd55c] hover:bg-[#ffd55c]/20 whitespace-nowrap"
            >
              Yes, add return
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
