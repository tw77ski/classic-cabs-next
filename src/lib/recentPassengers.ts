// Recent Passengers feature - stores passenger details for quick selection
// FEATURE_VERSION: 1.0

export interface RecentPassenger {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  timestamp: number;
}

const STORAGE_KEY = "recent_passengers";
const MAX_RECENT = 10;

/**
 * Generate a unique ID for a passenger based on name and phone
 */
function generateId(firstName: string, lastName: string, phone: string): string {
  return `${firstName.toLowerCase()}-${lastName.toLowerCase()}-${phone.replace(/\D/g, "")}`;
}

/**
 * Get recent passengers from localStorage
 */
export function getRecentPassengers(): RecentPassenger[] {
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
 * Save a passenger to recent passengers
 * - Deduplicates by name + phone
 * - Most recent first
 * - Max 10 entries
 */
export function saveRecentPassenger(passenger: {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
}): void {
  if (typeof window === "undefined") return;
  if (!passenger.firstName || !passenger.lastName || !passenger.phone) return;
  
  try {
    const existing = getRecentPassengers();
    const newId = generateId(passenger.firstName, passenger.lastName, passenger.phone);
    
    // Remove duplicate if exists
    const filtered = existing.filter((p) => p.id !== newId);
    
    // Add new entry at the top
    const newEntry: RecentPassenger = {
      id: newId,
      firstName: passenger.firstName,
      lastName: passenger.lastName,
      phone: passenger.phone,
      email: passenger.email || "",
      timestamp: Date.now(),
    };
    
    const updated = [newEntry, ...filtered].slice(0, MAX_RECENT);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Failed to save recent passenger:", error);
  }
}

/**
 * Search passengers by name (fuzzy match)
 */
export function searchPassengers(query: string): RecentPassenger[] {
  if (!query || query.length < 2) return [];
  
  const passengers = getRecentPassengers();
  const lowerQuery = query.toLowerCase();
  
  return passengers.filter((p) => {
    const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
    return fullName.includes(lowerQuery) || 
           p.firstName.toLowerCase().includes(lowerQuery) ||
           p.lastName.toLowerCase().includes(lowerQuery) ||
           p.phone.includes(query);
  });
}

/**
 * Clear all recent passengers
 */
export function clearRecentPassengers(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

