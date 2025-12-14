import { NextRequest, NextResponse } from "next/server";
import type { EstimateResponse } from "@/lib/taxicaller-types";

// =============================================================================
// TaxiCaller Booker API - Fare Estimates
// POST https://api-rc.taxicaller.net/api/v1/booker/fare
//
// Uses integer coordinates (lat/lng * 1e6) like the booking endpoint
// =============================================================================

const isDev = process.env.NODE_ENV === "development";

function toTaxiCallerCoords(lat: number, lng: number): [number, number] {
  return [Math.round(lng * 1e6), Math.round(lat * 1e6)];
}

export async function POST(req: NextRequest) {
  if (isDev) console.log("📊 Estimate request received");

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json<EstimateResponse>(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // Validate required fields
  if (!body.pickup?.lat || !body.pickup?.lng) {
    return NextResponse.json<EstimateResponse>(
      { success: false, error: "Missing pickup coordinates" },
      { status: 400 }
    );
  }

  if (!body.dropoff?.lat || !body.dropoff?.lng) {
    return NextResponse.json<EstimateResponse>(
      { success: false, error: "Missing dropoff coordinates" },
      { status: 400 }
    );
  }

  const companyId = Number(process.env.TAXICALLER_COMPANY_ID) || 8284;
  const apiDomain = process.env.TAXICALLER_API_DOMAIN || "api-rc.taxicaller.net";
  const apiKey = process.env.TAXICALLER_API_KEY;
  const jwt = process.env.TAXICALLER_DEV_JWT || process.env.TAXICALLER_JWT;

  // Build waypoints array with TC coordinate format [lng*1e6, lat*1e6]
  const waypoints: [number, number][] = [];
  
  // Pickup
  waypoints.push(toTaxiCallerCoords(body.pickup.lat, body.pickup.lng));
  
  // Intermediate stops
  if (body.stops && Array.isArray(body.stops)) {
    for (const stop of body.stops) {
      if (stop?.lat && stop?.lng) {
        waypoints.push(toTaxiCallerCoords(stop.lat, stop.lng));
      }
    }
  }
  
  // Dropoff
  waypoints.push(toTaxiCallerCoords(body.dropoff.lat, body.dropoff.lng));

  // Calculate pickup time - use current time for ASAP, or the scheduled time
  const now = Math.floor(Date.now() / 1000);
  let pickupTime = now;
  
  if (body.when?.time) {
    pickupTime = Math.floor(new Date(body.when.time).getTime() / 1000);
  } else if (body.pickupTimeUnix) {
    pickupTime = body.pickupTimeUnix;
  }

  // Build Booker fare payload
  const payload = {
    company_id: companyId,
    waypoints,
    time: pickupTime,
    num_passengers: body.passengers ?? 1,
  };

  const url = `https://${apiDomain}/api/v1/booker/fare`;

  if (isDev) {
    console.log("📡 Calling TaxiCaller Booker API:", url);
    console.log("📤 Payload:", JSON.stringify(payload, null, 2));
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwt}`,
        "x-api-key": apiKey || "",
      },
      body: JSON.stringify(payload),
    });

    const raw = await response.text();
    if (isDev) {
      console.log("📥 Response status:", response.status);
      console.log("📥 Response body:", raw.substring(0, 500));
    }

    if (!response.ok) {
      // Fare API might not be available - calculate estimate from distance
      if (isDev) console.log("⚠️ Fare API unavailable, using distance-based estimate");
      
      // Try to get route distance from Mapbox for fallback
      return await calculateFallbackEstimate(body, waypoints);
    }

    // Parse successful response
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw);
    } catch {
      return await calculateFallbackEstimate(body, waypoints);
    }

    if (isDev) console.log("✅ Fare estimate received:", data);

    // TaxiCaller fare response may have different field names
    const fare = data.fare || data.price || data.amount || data.estimated_fare || data.total;
    const distance = data.distance || data.dist || data.total_distance;
    const duration = data.duration || data.time || data.est_dur || data.total_duration;

    return NextResponse.json<EstimateResponse>({
      success: true,
      distance: typeof distance === 'number' ? distance : undefined,
      duration: typeof duration === 'number' ? duration : undefined,
      estimated_amount: typeof fare === 'number' ? fare : undefined,
      currency: typeof data.currency === 'string' ? data.currency : "GBP",
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Estimate error:", errorMessage);
    return await calculateFallbackEstimate(body, waypoints);
  }
}

// Fallback: Calculate estimate based on distance using Mapbox
async function calculateFallbackEstimate(
  _body: unknown, 
  waypoints: [number, number][]
): Promise<NextResponse<EstimateResponse>> {
  void _body; // Reserved for future use
  const isDev = process.env.NODE_ENV === "development";
  
  try {
    // Convert TC coordinates back to decimal for Mapbox
    const coords = waypoints.map(([lng, lat]) => `${lng / 1e6},${lat / 1e6}`).join(';');
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.MAPBOX_ACCESS_TOKEN;
    
    if (!mapboxToken) {
      return NextResponse.json<EstimateResponse>({
        success: true,
        distance: undefined,
        duration: undefined,
        estimated_amount: undefined,
        currency: "GBP",
        error: "Unable to calculate fare - please contact us for a quote",
      });
    }

    const mapboxUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?access_token=${mapboxToken}&overview=false`;
    
    const mapboxRes = await fetch(mapboxUrl);
    const mapboxData = await mapboxRes.json();
    
    if (mapboxData.routes && mapboxData.routes.length > 0) {
      const route = mapboxData.routes[0];
      const distanceKm = route.distance / 1000;
      const durationMin = Math.ceil(route.duration / 60);
      
      // Base fare calculation: £3.50 base + £2.50/km (typical Jersey taxi rates)
      const baseFare = 3.50;
      const perKmRate = 2.50;
      const estimatedFare = Math.ceil(baseFare + (distanceKm * perKmRate));
      
      if (isDev) {
        console.log(`📐 Fallback estimate: ${distanceKm.toFixed(1)}km, ${durationMin}min, £${estimatedFare}`);
      }
      
      return NextResponse.json<EstimateResponse>({
        success: true,
        distance: Math.round(route.distance), // meters
        duration: Math.round(route.duration), // seconds
        estimated_amount: estimatedFare,
        currency: "GBP",
      });
    }
    
    return NextResponse.json<EstimateResponse>({
      success: true,
      estimated_amount: undefined,
      currency: "GBP",
      error: "Unable to calculate route",
    });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    if (isDev) console.error("Fallback estimate error:", errorMessage);
    return NextResponse.json<EstimateResponse>({
      success: true,
      estimated_amount: undefined,
      currency: "GBP",
      error: "Unable to calculate fare estimate",
    });
  }
}
