import { successResponse, errorResponse, log, logError } from "@/lib/api-utils";

// =============================================================================
// Mapbox Directions API - Route Path
// Returns geometry, distance, and duration for a route
// =============================================================================

interface Coordinate {
  lat: number;
  lng: number;
}

interface RouteResponse {
  geometry: GeoJSON.LineString;
  distance: number;  // meters
  duration: number;  // seconds
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    
    if (!body) {
      return errorResponse("Invalid JSON body", 400, "INVALID_JSON");
    }

    const { pickup, stops, dropoff } = body as {
      pickup?: Coordinate;
      stops?: Coordinate[];
      dropoff?: Coordinate;
    };

    // Validate required coordinates
    if (!pickup?.lat || !pickup?.lng) {
      return errorResponse("Pickup coordinates are required", 400, "MISSING_PICKUP");
    }

    if (!dropoff?.lat || !dropoff?.lng) {
      return errorResponse("Dropoff coordinates are required", 400, "MISSING_DROPOFF");
    }

    // Validate coordinate ranges (Jersey area)
    if (!isValidCoordinate(pickup.lat, pickup.lng)) {
      return errorResponse("Invalid pickup coordinates", 400, "INVALID_PICKUP");
    }

    if (!isValidCoordinate(dropoff.lat, dropoff.lng)) {
      return errorResponse("Invalid dropoff coordinates", 400, "INVALID_DROPOFF");
    }

    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
    if (!mapboxToken) {
      return errorResponse("Routing service not configured", 500, "CONFIG_ERROR");
    }

    // Build coordinates string: pickup;stops;dropoff
    // Format: lng,lat;lng,lat;...
    const coordinates: string[] = [];
    coordinates.push(`${pickup.lng},${pickup.lat}`);
    
    if (stops && stops.length > 0) {
      for (const stop of stops) {
        if (stop.lat && stop.lng && isValidCoordinate(stop.lat, stop.lng)) {
          coordinates.push(`${stop.lng},${stop.lat}`);
        }
      }
    }
    
    coordinates.push(`${dropoff.lng},${dropoff.lat}`);

    const coordString = coordinates.join(";");

    log("🛣️ Routing request:", coordString);

    // Call Mapbox Directions API
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordString}?geometries=geojson&overview=full&access_token=${mapboxToken}`;

    const response = await fetch(url);
    
    // Safely parse response
    const text = await response.text();
    
    // Handle empty responses
    if (!text || text.trim().length === 0) {
      logError("Mapbox returned empty response");
      return errorResponse("Routing service returned empty response", 502, "EMPTY_RESPONSE");
    }

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      logError("Mapbox returned non-JSON:", text.substring(0, 200));
      return errorResponse("Invalid response from routing service", 502, "INVALID_RESPONSE");
    }

    // Handle Mapbox API errors
    if (!response.ok) {
      const errorMessage = data.message || data.error || `Mapbox error: ${response.status}`;
      logError("Mapbox API error:", data);
      return errorResponse(errorMessage, response.status >= 500 ? 502 : 400, "MAPBOX_ERROR");
    }

    if (data.code !== "Ok") {
      const errorMessage = mapboxCodeToMessage(data.code);
      logError("Mapbox routing failed:", data.code);
      return errorResponse(errorMessage, 400, "ROUTING_FAILED");
    }

    const route = data.routes?.[0];
    if (!route) {
      return errorResponse("No route found between locations", 404, "NO_ROUTE");
    }

    // Validate route data
    if (!route.geometry || !route.distance || !route.duration) {
      logError("Incomplete route data:", route);
      return errorResponse("Incomplete route data received", 502, "INCOMPLETE_DATA");
    }

    log("✅ Route found:", `${(route.distance / 1000).toFixed(1)}km, ${Math.round(route.duration / 60)}min`);

    return successResponse<RouteResponse>({
      geometry: route.geometry,
      distance: route.distance,
      duration: route.duration,
    });

  } catch (err: any) {
    logError("Route path error:", err.message);
    return errorResponse(err.message || "Server error", 500, "SERVER_ERROR");
  }
}

// Validate coordinates are within reasonable bounds
function isValidCoordinate(lat: number, lng: number): boolean {
  // Very loose bounds (allows worldwide but catches NaN/Infinity)
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    isFinite(lat) &&
    isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

// Map Mapbox error codes to user-friendly messages
function mapboxCodeToMessage(code: string): string {
  switch (code) {
    case "NoRoute":
      return "No drivable route found between these locations";
    case "NoSegment":
      return "One or more locations cannot be reached by road";
    case "ProfileNotFound":
      return "Routing profile not available";
    case "InvalidInput":
      return "Invalid coordinates provided";
    default:
      return `Routing error: ${code}`;
  }
}











