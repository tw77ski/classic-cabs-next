import Fuse from "fuse.js";
import { POPULAR_LOCATIONS, POILocation } from "./popular-locations";

// Configure Fuse.js for fuzzy searching POIs
const fuse = new Fuse(POPULAR_LOCATIONS, {
  keys: ["label"],
  threshold: 0.35,    // typo tolerance level (0 = exact match, 1 = match anything)
  distance: 80,       // how far to search for matches
  minMatchCharLength: 2,
  includeScore: true,
});

/**
 * Search POIs with fuzzy matching
 * @param query - Search query string
 * @returns Array of matching POI locations sorted by relevance
 */
export function searchPOI(query: string): POILocation[] {
  if (!query || query.length < 2) return [];
  
  const results = fuse.search(query);
  return results.map(r => r.item);
}

/**
 * Get initial popular locations to show when field is focused
 * @returns Array of all popular locations (currently 3)
 */
export function getPopularLocations(): POILocation[] {
  return POPULAR_LOCATIONS;
}

export { POPULAR_LOCATIONS, type POILocation };

