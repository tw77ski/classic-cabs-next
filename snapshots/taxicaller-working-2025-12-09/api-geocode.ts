import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { successResponse, errorResponse, log, logError } from "@/lib/api-utils";

// =============================================================================
// Multi-source Geocoding API
// Priority: Nominatim (OSM) → Mapbox → Foursquare (if configured)
// All results include locationType: "address" for TaxiCaller compatibility
// =============================================================================

interface SearchResult {
  label: string;
  lat: number;
  lng: number;
  locationType: "address";  // Required for TaxiCaller
  type?: string;
  source?: string;
  relevance?: number;
}

// GET handler for reverse geocoding (lat/lng to address)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");

    if (!lat || !lng) {
      return errorResponse("Missing lat/lng parameters", 400, "MISSING_PARAMS");
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return errorResponse("Invalid lat/lng values", 400, "INVALID_PARAMS");
    }

    log("🗺️ Reverse geocoding:", `${latitude}, ${longitude}`);

    // Try Nominatim reverse geocoding first (free)
    try {
      const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1&accept-language=en`;
      
      const res = await fetch(nominatimUrl, {
        headers: {
          "User-Agent": "ClassicCabs-BookingForm/1.0",
        },
      });

      const data = await res.json();

      if (data && data.display_name) {
        // Format a cleaner address
        const parts = [];
        const addr = data.address || {};
        
        if (addr.house_number && addr.road) {
          parts.push(`${addr.house_number} ${addr.road}`);
        } else if (addr.road) {
          parts.push(addr.road);
        } else if (addr.building || addr.amenity || addr.shop) {
          parts.push(addr.building || addr.amenity || addr.shop);
        }
        
        if (addr.suburb || addr.neighbourhood || addr.hamlet) {
          parts.push(addr.suburb || addr.neighbourhood || addr.hamlet);
        }
        
        if (addr.town || addr.city || addr.village) {
          parts.push(addr.town || addr.city || addr.village);
        }
        
        const address = parts.length > 0 
          ? parts.join(", ") 
          : data.display_name.split(",").slice(0, 3).join(",");

        return successResponse({
          address,
          label: address,
          lat: latitude,
          lng: longitude,
          locationType: "address",  // TaxiCaller required
          full_address: data.display_name,
          source: "nominatim",
        });
      }
    } catch (e) {
      log("Nominatim reverse geocoding failed:", String(e));
    }

    // Fallback to Mapbox reverse geocoding
    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
    if (mapboxToken) {
      try {
        const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?types=address,poi&limit=1&access_token=${mapboxToken}`;
        
        const res = await fetch(mapboxUrl);
        const data = await res.json();

        if (data.features && data.features.length > 0) {
          const feature = data.features[0];
          return successResponse({
            address: feature.place_name,
            label: feature.place_name,
            lat: latitude,
            lng: longitude,
            locationType: "address",  // TaxiCaller required
            source: "mapbox",
          });
        }
      } catch (e) {
        log("Mapbox reverse geocoding failed:", String(e));
      }
    }

    // If all else fails, return coordinates as address
    return successResponse({
      address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
      label: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
      lat: latitude,
      lng: longitude,
      locationType: "address",  // TaxiCaller required
      source: "coordinates",
    });

  } catch (error: any) {
    logError("Reverse geocode error:", error);
    return errorResponse("Failed to reverse geocode location", 500, "GEOCODE_ERROR");
  }
}

// POST handler for forward geocoding (address to lat/lng)
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { address } = body;

    if (!address || address.length < 2) {
      return NextResponse.json([]);
    }

    log("🔍 Forward geocoding:", address);

    // Combine results from multiple sources
    const results: SearchResult[] = [];

    // 1. Try Nominatim (OpenStreetMap) - Free, good POI data
    try {
      const nominatimResults = await searchNominatim(address);
      results.push(...nominatimResults);
      log(`Nominatim: ${nominatimResults.length} results`);
    } catch (e) {
      log("Nominatim failed:", String(e));
    }

    // 2. Add Mapbox results for better address coverage
    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
    if (mapboxToken) {
      try {
        const mapboxResults = await searchMapbox(address, mapboxToken);
        // Only add results not already in the list
        for (const result of mapboxResults) {
          if (!results.some(r => isSimilarLocation(r, result))) {
            results.push(result);
          }
        }
        log(`Mapbox: ${mapboxResults.length} results`);
      } catch (e) {
        log("Mapbox failed:", String(e));
      }
    }

    // 3. Try Foursquare if configured (excellent POI data)
    const foursquareKey = process.env.FOURSQUARE_API_KEY;
    if (foursquareKey) {
      try {
        const fsqResults = await searchFoursquare(address, foursquareKey);
        for (const result of fsqResults) {
          if (!results.some(r => isSimilarLocation(r, result))) {
            results.push(result);
          }
        }
        log(`Foursquare: ${fsqResults.length} results`);
      } catch (e) {
        log("Foursquare failed:", String(e));
      }
    }

    // If no results from any source, return empty
    if (results.length === 0) {
      log("No geocoding results found");
      return NextResponse.json([]);
    }

    // Sort by relevance and limit
    const sortedResults = results
      .sort((a, b) => (b.relevance || 0) - (a.relevance || 0))
      .slice(0, 8);

    return NextResponse.json(sortedResults);
  } catch (error: any) {
    logError("Geocode route error:", error);
    return errorResponse("Server error", 500, "GEOCODE_ERROR");
  }
}

// Check if two locations are similar (within ~100m)
function isSimilarLocation(a: SearchResult, b: SearchResult): boolean {
  const latDiff = Math.abs(a.lat - b.lat);
  const lngDiff = Math.abs(a.lng - b.lng);
  return latDiff < 0.001 && lngDiff < 0.001;
}

// Nominatim (OpenStreetMap) - Free, good coverage, includes POIs
async function searchNominatim(query: string): Promise<SearchResult[]> {
  const encodedQuery = encodeURIComponent(query);
  
  // Jersey bounding box: SW to NE
  const viewbox = "-2.26,49.16,-2.00,49.27";
  
  const url = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&addressdetails=1&limit=8&viewbox=${viewbox}&bounded=1&accept-language=en`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "ClassicCabs-BookingForm/1.0",
    },
  });

  const data = await res.json();

  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((item: any) => ({
    label: item.display_name,
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    locationType: "address" as const,  // TaxiCaller required
    type: item.type || item.class || "address",
    source: "osm",
    relevance: parseFloat(item.importance || 0.5),
  }));
}

// Mapbox Geocoding - Good address coverage
async function searchMapbox(query: string, token: string): Promise<SearchResult[]> {
  const encodedQuery = encodeURIComponent(query);
  
  // Jersey center for proximity bias
  const jerseyLng = -2.1313;
  const jerseyLat = 49.2144;
  
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?autocomplete=true&country=je&types=poi,address,postcode,place&proximity=${jerseyLng},${jerseyLat}&limit=8&access_token=${token}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.message) {
    throw new Error(data.message);
  }

  if (!data.features) {
    return [];
  }

  return data.features.map((f: any) => ({
    label: f.place_name,
    lat: f.center[1],
    lng: f.center[0],
    locationType: "address" as const,  // TaxiCaller required
    type: f.place_type?.[0] || "address",
    source: "mapbox",
    relevance: f.relevance || 0.5,
  }));
}

// Foursquare Places API - Excellent POI coverage
async function searchFoursquare(query: string, apiKey: string): Promise<SearchResult[]> {
  const encodedQuery = encodeURIComponent(query);
  
  // Jersey center
  const ll = "49.2144,-2.1313";
  
  const url = `https://api.foursquare.com/v3/places/search?query=${encodedQuery}&ll=${ll}&radius=15000&limit=8`;

  const res = await fetch(url, {
    headers: {
      "Authorization": apiKey,
      "Accept": "application/json",
    },
  });

  const data = await res.json();

  if (!data.results) {
    return [];
  }

  return data.results
    .filter((place: any) => place.geocodes?.main?.latitude && place.geocodes?.main?.longitude)
    .map((place: any) => ({
      label: `${place.name}, ${place.location?.formatted_address || place.location?.address || "Jersey"}`,
      lat: place.geocodes.main.latitude,
      lng: place.geocodes.main.longitude,
      locationType: "address" as const,  // TaxiCaller required
      type: place.categories?.[0]?.name || "poi",
      source: "foursquare",
      relevance: 0.8,
    }));
}

















