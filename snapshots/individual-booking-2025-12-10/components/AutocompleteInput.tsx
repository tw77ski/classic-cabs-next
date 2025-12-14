// NOTE: Mapbox + Nominatim geocoding only — TaxiCaller geocoding removed
// FEATURE_VERSION: 3.0
// FEATURE: Luxury Focus Styling (gold glow)

"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { searchPOI, getPopularLocations, POILocation } from "@/lib/poiSearch";
import { getRecentAddresses, saveRecentAddress, RecentAddress } from "@/lib/recentAddresses";

interface Suggestion {
  label: string;
  lat: number;
  lng: number;
}

interface AutocompleteInputProps {
  label: string;
  placeholder?: string;
  value: { address: string; lat: number | null; lng: number | null };
  setValue: (val: { address: string; lat: number | null; lng: number | null }) => void;
  onSearch: (query: string) => Promise<Suggestion[]>;
  icon: React.ReactNode;
  showUseMyLocation?: boolean;
  onUseMyLocation?: () => void;
  isLoadingLocation?: boolean;
}

export default function AutocompleteInput({ 
  label, 
  placeholder, 
  value, 
  setValue, 
  onSearch, 
  icon,
  showUseMyLocation = false,
  onUseMyLocation,
  isLoadingLocation = false,
}: AutocompleteInputProps) {
  const [mapboxSuggestions, setMapboxSuggestions] = useState<Suggestion[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [recentAddresses, setRecentAddresses] = useState<RecentAddress[]>([]);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Get popular locations (only 3 items)
  const popularLocations = useMemo(() => getPopularLocations(), []);

  // Load recent addresses on mount
  useEffect(() => {
    setRecentAddresses(getRecentAddresses());
  }, []);

  // Refresh recent addresses when focused
  useEffect(() => {
    if (isFocused) {
      setRecentAddresses(getRecentAddresses());
    }
  }, [isFocused]);

  // Fuzzy search POIs based on input
  const fuzzyPOIResults = useMemo(() => {
    if (value.address.length < 2) return [];
    return searchPOI(value.address);
  }, [value.address]);

  // Determine which POI results to show
  const poiResults: POILocation[] = value.address.length < 2 
    ? popularLocations 
    : fuzzyPOIResults;

  // Show sections based on input state
  const showRecent = isFocused && value.address.length <= 1 && recentAddresses.length > 0;
  const showPopular = isFocused && value.address.length < 2;
  const hasPOIResults = poiResults.length > 0;
  const hasMapboxResults = mapboxSuggestions.length > 0;
  const showDropdown = isFocused && (showRecent || showPopular || hasPOIResults || hasMapboxResults);

  // Debounced Mapbox search - always search when user types 3+ chars
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (value.address.length < 3) {
      setMapboxSuggestions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await onSearch(value.address);
        // Filter out duplicates that match popular locations
        const popularLabels = new Set(popularLocations.map(p => p.label.toLowerCase()));
        const filtered = results.filter(r => !popularLabels.has(r.label.toLowerCase()));
        setMapboxSuggestions(filtered);
      } catch (error) {
        console.error("Search error:", error);
        setMapboxSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value.address, onSearch, popularLocations]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const text = e.target.value;
    setValue({ ...value, address: text, lat: null, lng: null });
  }

  function applySuggestion(s: Suggestion | POILocation | RecentAddress) {
    setValue({ address: s.label, lat: s.lat, lng: s.lng });
    setMapboxSuggestions([]);
    setIsFocused(false);
    
    // Save to recent addresses
    saveRecentAddress({ label: s.label, lat: s.lat, lng: s.lng });
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-[#aaa]">
          {label}
        </label>
        
        {/* Use My Location button - only for Pickup */}
        {showUseMyLocation && onUseMyLocation && (
          <button
            type="button"
            onClick={onUseMyLocation}
            disabled={isLoadingLocation}
            className="text-[10px] text-[#ffd55c] hover:text-[#ffcc33] flex items-center gap-1 transition disabled:opacity-50"
          >
            {isLoadingLocation ? (
              <>
                <div className="w-3 h-3 border border-[#ffd55c]/30 border-t-[#ffd55c] rounded-full animate-spin" />
                <span>Locating...</span>
              </>
            ) : (
              <>
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                </svg>
                <span>Use My Location</span>
              </>
            )}
          </button>
        )}
      </div>
      
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ffd55c]/60">
          {icon}
        </span>
        <input
          value={value.address}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          placeholder={placeholder}
          className="glow-input w-full pl-9 pr-8 p-2 text-sm h-9 bg-[#111] border border-[#333] text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/30 focus:shadow-[0_0_16px_rgba(212,175,55,0.35)]"
        />
        
        {/* Loading indicator */}
        {(isLoading || isLoadingLocation) && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <div className="w-3.5 h-3.5 border-2 border-[#ffd55c]/30 border-t-[#ffd55c] rounded-full animate-spin" />
          </span>
        )}
        
        {/* Checkmark when location is valid */}
        {!isLoading && !isLoadingLocation && value.lat && value.lng && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-400">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        )}
        
        {/* X indicator when address typed but not geocoded */}
        {!isLoading && !isLoadingLocation && value.address.length >= 3 && !value.lat && !value.lng && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-red-400">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </span>
        )}
      </div>

      {/* Floating dropdown - high z-index to appear above all form sections */}
      {showDropdown && (
        <div className="absolute z-[100] w-full mt-1 bg-[#1a1a1a] border border-[#333] rounded-md shadow-xl max-h-72 overflow-y-auto">
          
          {/* Recent Addresses Section */}
          {showRecent && (
            <>
              <div className="px-3 py-1.5 bg-[#151515] border-b border-[#333] sticky top-0 z-10">
                <span className="text-[10px] uppercase tracking-wider text-[#666] font-semibold">
                  Recently Used
                </span>
              </div>
              {recentAddresses.map((addr, i) => (
                <div
                  key={`recent-${i}`}
                  onClick={() => applySuggestion(addr)}
                  className="px-3 py-2 cursor-pointer hover:bg-[#252525] border-b border-[#222] last:border-b-0 transition"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-3 h-3 text-[#ffd55c]/70 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span className="text-xs text-[#f5f5f5] truncate">{addr.label}</span>
                  </div>
                </div>
              ))}
            </>
          )}
          
          {/* POI Results Section (Fuzzy matched or Popular) */}
          {(showPopular || hasPOIResults) && (
            <>
              <div className={`px-3 py-1.5 bg-[#151515] border-b border-[#333] sticky top-0 z-10 ${showRecent ? 'border-t border-t-[#333]' : ''}`}>
                <span className="text-[10px] uppercase tracking-wider text-[#666] font-semibold">
                  {value.address.length < 2 ? "Popular Locations" : "Matched Locations"}
                </span>
              </div>
              {poiResults.slice(0, 15).map((loc, i) => (
                <div
                  key={`poi-${i}`}
                  onClick={() => applySuggestion(loc)}
                  className="px-3 py-2 cursor-pointer hover:bg-[#252525] border-b border-[#222] last:border-b-0 transition"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-3 h-3 text-[#ffd55c] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    <span className="text-xs text-[#f5f5f5] truncate">{loc.label}</span>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Mapbox Search Results (fallback when few POI matches) */}
          {hasMapboxResults && (
            <>
              <div className="px-3 py-1.5 bg-[#151515] border-b border-[#333] border-t border-t-[#333] sticky top-0 z-10">
                <span className="text-[10px] uppercase tracking-wider text-[#666] font-semibold">
                  More Results
                </span>
              </div>
              {mapboxSuggestions.map((s, i) => (
                <div
                  key={`search-${i}`}
                  onClick={() => applySuggestion(s)}
                  className="px-3 py-2 cursor-pointer hover:bg-[#252525] border-b border-[#222] last:border-b-0 transition"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-3 h-3 text-[#ffd55c]/50 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span className="text-xs text-[#ccc] truncate">{s.label}</span>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Empty state when searching but no results */}
          {value.address.length >= 3 && !hasPOIResults && !hasMapboxResults && !isLoading && (
            <div className="px-3 py-3 text-center text-xs text-[#666]">
              No results found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
