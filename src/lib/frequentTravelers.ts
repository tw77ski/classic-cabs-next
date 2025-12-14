// Frequent Travelers - connects to corporate passengers storage
// FEATURE_VERSION: 2.0
// Uses the same storage as the Passengers page

export interface TravelerAddress {
  label: string;
  address: string;
  lat?: number;
  lng?: number;
}

export interface FrequentTraveler {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  department?: string;
  notes?: string;
  homeAddress?: TravelerAddress;
  workAddress?: TravelerAddress;
  otherAddresses?: TravelerAddress[];
  createdAt: string;
  lastUsed?: string;
  bookingCount: number;
}

// Use the same storage key as the Passengers page
const STORAGE_KEY = "corporate_passengers";

/**
 * Generate a unique ID
 */
function generateId(): string {
  return Date.now().toString();
}

/**
 * Get all frequent travelers (from corporate passengers storage)
 */
export function getFrequentTravelers(): FrequentTraveler[] {
  if (typeof window === "undefined") return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    
    // Sort by name
    return parsed.sort((a: FrequentTraveler, b: FrequentTraveler) => {
      const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
      const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });
  } catch {
    return [];
  }
}

/**
 * Add a new frequent traveler
 */
export function addFrequentTraveler(traveler: {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  department?: string;
  notes?: string;
}): FrequentTraveler {
  const travelers = getFrequentTravelers();
  
  const newTraveler: FrequentTraveler = {
    id: generateId(),
    firstName: traveler.firstName,
    lastName: traveler.lastName,
    phone: traveler.phone,
    email: traveler.email || "",
    department: traveler.department || "",
    notes: traveler.notes || "",
    createdAt: new Date().toISOString(),
    bookingCount: 0,
  };
  
  travelers.push(newTraveler);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(travelers));
  
  return newTraveler;
}

/**
 * Update an existing frequent traveler
 */
export function updateFrequentTraveler(id: string, updates: Partial<FrequentTraveler>): FrequentTraveler | null {
  const travelers = getFrequentTravelers();
  const index = travelers.findIndex(t => t.id === id);
  
  if (index === -1) return null;
  
  travelers[index] = {
    ...travelers[index],
    ...updates,
  };
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(travelers));
  return travelers[index];
}

/**
 * Update traveler's last used date and increment booking count
 */
export function markTravelerUsed(id: string): void {
  const travelers = getFrequentTravelers();
  const index = travelers.findIndex(t => t.id === id);
  
  if (index === -1) return;
  
  travelers[index] = {
    ...travelers[index],
    lastUsed: new Date().toISOString(),
    bookingCount: (travelers[index].bookingCount || 0) + 1,
  };
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(travelers));
}

/**
 * Delete a frequent traveler
 */
export function deleteFrequentTraveler(id: string): boolean {
  const travelers = getFrequentTravelers();
  const filtered = travelers.filter(t => t.id !== id);
  
  if (filtered.length === travelers.length) return false;
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  return true;
}

/**
 * Search frequent travelers by name, phone, or department
 */
export function searchFrequentTravelers(query: string): FrequentTraveler[] {
  if (!query || query.length < 1) return getFrequentTravelers();
  
  const travelers = getFrequentTravelers();
  const lowerQuery = query.toLowerCase();
  
  return travelers.filter((t) => {
    const fullName = `${t.firstName} ${t.lastName}`.toLowerCase();
    return fullName.includes(lowerQuery) || 
           t.firstName.toLowerCase().includes(lowerQuery) ||
           t.lastName.toLowerCase().includes(lowerQuery) ||
           t.phone.includes(query) ||
           (t.department && t.department.toLowerCase().includes(lowerQuery)) ||
           (t.email && t.email.toLowerCase().includes(lowerQuery));
  });
}

/**
 * Get traveler by ID
 */
export function getFrequentTravelerById(id: string): FrequentTraveler | null {
  const travelers = getFrequentTravelers();
  return travelers.find(t => t.id === id) || null;
}

/**
 * Clear all frequent travelers
 */
export function clearFrequentTravelers(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
