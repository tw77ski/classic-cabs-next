// NOTE: Recent Addresses feature — ask to revert if needed.
// FEATURE_VERSION: 1.0

export interface RecentAddress {
  label: string;
  address: string;
  lat: number;
  lng: number;
  timestamp: number;
}

const STORAGE_KEY = "recent_addresses";
const MAX_RECENT = 5;

/**
 * Get recent addresses from localStorage
 */
export function getRecentAddresses(): RecentAddress[] {
  if (typeof window === "undefined") return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    
    return parsed;
  } catch {
    return [];
  }
}

/**
 * Save a new address to recent addresses
 * - Deduplicates by lat/lng
 * - Most recent first
 * - Max 5 entries
 */
export function saveRecentAddress(address: {
  label: string;
  lat: number;
  lng: number;
}): void {
  if (typeof window === "undefined") return;
  if (!address.label || !address.lat || !address.lng) return;
  
  try {
    const existing = getRecentAddresses();
    
    // Check for duplicates (same lat/lng within small tolerance)
    const isDuplicate = existing.some(
      (a) => 
        Math.abs(a.lat - address.lat) < 0.0001 && 
        Math.abs(a.lng - address.lng) < 0.0001
    );
    
    if (isDuplicate) {
      // Move existing to top by removing and re-adding
      const filtered = existing.filter(
        (a) => 
          Math.abs(a.lat - address.lat) >= 0.0001 || 
          Math.abs(a.lng - address.lng) >= 0.0001
      );
      const newEntry: RecentAddress = {
        label: address.label,
        address: address.label,
        lat: address.lat,
        lng: address.lng,
        timestamp: Date.now(),
      };
      const updated = [newEntry, ...filtered].slice(0, MAX_RECENT);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } else {
      // Add new entry
      const newEntry: RecentAddress = {
        label: address.label,
        address: address.label,
        lat: address.lat,
        lng: address.lng,
        timestamp: Date.now(),
      };
      const updated = [newEntry, ...existing].slice(0, MAX_RECENT);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  } catch (error) {
    console.error("Failed to save recent address:", error);
  }
}

/**
 * Clear all recent addresses
 */
export function clearRecentAddresses(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}










