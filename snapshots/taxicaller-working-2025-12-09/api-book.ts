import { NextRequest, NextResponse } from "next/server";

// =============================================================================
// TaxiCaller Booker API — Create Order
// POST https://api-rc.taxicaller.net/api/v1/booker/order
//
// Based on official documentation: https://app.taxicaller.net/documentation/api/
//
// KEY REQUIREMENTS:
// - Payload must be wrapped in "order" object
// - Coordinates must be multiplied by 1e6 (integers, not decimals)
// - Times must be Unix timestamps in seconds
// - Route nodes use "in" (pickup) and "out" (dropoff) actions
// =============================================================================

const isDev = process.env.NODE_ENV === "development";

// =============================================================================
// TYPE DEFINITIONS (Based on Official API Docs)
// =============================================================================

interface PassengerItem {
  "@type": "passengers";
  seq: number;
  passenger: {
    name: string;
    phone: string;
    email: string;
  };
  client_id: number | null;
  account: { id: number; extra: null } | null;
  require: {
    seats: number;
    wc: number;
    bags: number;
  };
  pay_info: Array<{ "@t": number; data: null }>;
  custom_fields?: Record<string, string>;
}

interface RouteNode {
  actions: Array<{
    "@type": "client_action";
    item_seq: number;
    action: "in" | "out";
  }>;
  location: {
    name: string;
    coords: [number, number]; // [lng * 1e6, lat * 1e6]
  };
  times: {
    arrive: {
      target: number; // Unix timestamp in seconds
      latest: number;
    };
  } | null;
  info: {
    all?: string;
  };
  seq: number;
}

interface RouteLeg {
  meta: {
    dist: number;
    est_dur: number;
  };
  pts: number[];
  from_seq: number;
  to_seq: number;
}

interface BookerOrder {
  company_id: number;
  provider_id: number;
  items: PassengerItem[];
  route: {
    nodes: RouteNode[];
    legs: RouteLeg[];
    meta: {
      dist: number;
      est_dur: number;
    };
  };
}

interface BookerPayload {
  order: BookerOrder;
}

interface SuccessResponse {
  ok: true;
  order_id: string;
  raw?: any;
}

interface ErrorResponse {
  ok: false;
  error: string;
  fields?: string[];
  details?: any;
}

type ApiResponse = SuccessResponse | ErrorResponse;

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Convert decimal coordinates to TaxiCaller format (multiply by 1e6)
 */
function toTaxiCallerCoords(lat: number, lng: number): [number, number] {
  return [Math.round(lng * 1e6), Math.round(lat * 1e6)];
}

/**
 * Convert ISO date string or Date to Unix timestamp in seconds
 */
function toUnixSeconds(dateInput: string | Date): number {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return Math.floor(date.getTime() / 1000);
}

/**
 * Normalize phone to E.164 format
 */
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, "");
  if (!cleaned.startsWith("+")) {
    if (cleaned.startsWith("0")) {
      cleaned = "+44" + cleaned.substring(1);
    } else {
      cleaned = "+" + cleaned;
    }
  }
  return cleaned;
}

/**
 * Dev-only logging (never logs in production)
 */
function log(message: string, data?: any) {
  if (isDev) {
    if (data !== undefined) {
      console.log(message, typeof data === "string" ? data : JSON.stringify(data, null, 2));
    } else {
      console.log(message);
    }
  }
}

/**
 * Error logging (minimal in production)
 */
function logError(message: string, data?: any) {
  if (isDev) {
    console.error(message, data);
  } else {
    console.error(message, typeof data === "object" ? data?.message || data?.error : "");
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function POST(req: NextRequest) {
  log("\n" + "═".repeat(70));
  log("📦 TAXICALLER BOOKER API — CREATE ORDER");
  log("═".repeat(70));

  // ─────────────────────────────────────────────────────────────────────────
  // 1. PARSE REQUEST BODY
  // ─────────────────────────────────────────────────────────────────────────

  const body = await req.json().catch(() => null);
  
  if (!body) {
    return NextResponse.json<ErrorResponse>(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  log("📋 Request body:", body);

  // ─────────────────────────────────────────────────────────────────────────
  // 2. VALIDATE REQUIRED FIELDS
  // ─────────────────────────────────────────────────────────────────────────

  const missingFields: string[] = [];

  // Pickup validation
  if (!body.pickup?.address) missingFields.push("pickup.address");
  if (body.pickup?.lat == null && body.pickup?.latitude == null) missingFields.push("pickup.lat");
  if (body.pickup?.lng == null && body.pickup?.longitude == null) missingFields.push("pickup.lng");

  // Dropoff validation
  if (!body.dropoff?.address) missingFields.push("dropoff.address");
  if (body.dropoff?.lat == null && body.dropoff?.latitude == null) missingFields.push("dropoff.lat");
  if (body.dropoff?.lng == null && body.dropoff?.longitude == null) missingFields.push("dropoff.lng");

  // Passenger count validation
  if (!body.passengers || body.passengers < 1) {
    missingFields.push("passengers");
  }

  // Customer validation
  if (!body.rider?.name && !body.customer?.name) missingFields.push("rider.name");
  if (!body.rider?.phone && !body.customer?.phone) missingFields.push("rider.phone");

  // When validation
  const whenType = body.when?.type || (body.asap === false ? "scheduled" : "now");
  if (whenType === "scheduled" && !body.when?.time) {
    missingFields.push("when.time");
  }

  if (missingFields.length > 0) {
    logError("❌ Validation failed - missing fields:", missingFields);
    return NextResponse.json<ErrorResponse>(
      { 
        ok: false, 
        error: "Missing required fields", 
        fields: missingFields 
      },
      { status: 400 }
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. EXTRACT VALUES
  // ─────────────────────────────────────────────────────────────────────────

  // Extract coordinates
  const pickupLat = body.pickup.lat ?? body.pickup.latitude;
  const pickupLng = body.pickup.lng ?? body.pickup.longitude;
  const dropoffLat = body.dropoff.lat ?? body.dropoff.latitude;
  const dropoffLng = body.dropoff.lng ?? body.dropoff.longitude;

  // Extract customer info
  const customerName = body.rider?.name || body.customer?.name;
  const customerPhone = normalizePhone(body.rider?.phone || body.customer?.phone);
  const customerEmail = body.rider?.email || body.customer?.email || "";

  // Build notes
  const notesParts: string[] = [];
  if (body.vehicle_type === "luxury" || body.vehicleType === "luxury") {
    notesParts.push("🚗 EXECUTIVE SERVICE – Premium V-Class");
  }
  if (body.flightNumber) {
    notesParts.push(`✈️ Flight: ${body.flightNumber}`);
  }
  if (body.airportPickup) {
    notesParts.push("📍 Airport Pickup");
  }
  if (body.return_trip && body.return_time) {
    notesParts.push(`🔄 Return: ${body.return_time}`);
  }
  if (body.luggage > 0) {
    notesParts.push(`🧳 Luggage: ${body.luggage}`);
  }
  if (body.notes) {
    notesParts.push(`📝 ${body.notes}`);
  }

  // Determine pickup time
  const isScheduled = whenType === "scheduled";
  const pickupTime = isScheduled && body.when?.time 
    ? toUnixSeconds(body.when.time)
    : toUnixSeconds(new Date()); // Now

  // ─────────────────────────────────────────────────────────────────────────
  // 4. BUILD TAXICALLER BOOKER PAYLOAD (Per Official Documentation)
  // ─────────────────────────────────────────────────────────────────────────

  const companyId = Number(process.env.TAXICALLER_COMPANY_ID) || 8284;
  const providerId = Number(process.env.TAXICALLER_PROVIDER_ID) || companyId;

  const payload: BookerPayload = {
    order: {
      company_id: companyId,
      provider_id: providerId,

      // Items array - passengers
      items: [
        {
          "@type": "passengers",
          seq: 0,
          passenger: {
            name: customerName,
            phone: customerPhone,
            email: customerEmail,
          },
          client_id: null, // Guest booking
          account: null, // No account
          require: {
            seats: body.passengers || 1,
            wc: 0,
            bags: body.luggage || 0,
          },
          pay_info: [
            {
              "@t": 0, // CASH
              data: null,
            },
          ],
        },
      ],

      // Route with nodes
      route: {
        nodes: [
          // Pickup node (seq: 0)
          {
            actions: [
              {
                "@type": "client_action",
                item_seq: 0,
                action: "in", // Pickup
              },
            ],
            location: {
              name: body.pickup.address,
              coords: toTaxiCallerCoords(pickupLat, pickupLng),
            },
            times: {
              arrive: {
                target: pickupTime,
                latest: 0,
              },
            },
            info: {
              all: notesParts.join(" | ") || "",
            },
            seq: 0,
          },
          // Dropoff node (seq: 1)
          {
            actions: [
              {
                "@type": "client_action",
                item_seq: 0,
                action: "out", // Dropoff
              },
            ],
            location: {
              name: body.dropoff.address,
              coords: toTaxiCallerCoords(dropoffLat, dropoffLng),
            },
            times: null, // Dropoff time is null
            info: {},
            seq: 1,
          },
        ],
        legs: [
          {
            meta: {
              dist: 0, // Unknown, will be calculated by TaxiCaller
              est_dur: 0,
            },
            pts: [], // No detailed route points
            from_seq: 0,
            to_seq: 1,
          },
        ],
        meta: {
          dist: 0,
          est_dur: 0,
        },
      },
    },
  };

  log("\n" + "─".repeat(70));
  log("📤 TAXICALLER PAYLOAD (Official API Structure):");
  log("─".repeat(70));
  log("", payload);

  // ─────────────────────────────────────────────────────────────────────────
  // 5. SEND REQUEST TO TAXICALLER
  // ─────────────────────────────────────────────────────────────────────────

  const apiDomain = process.env.TAXICALLER_API_DOMAIN || "api-rc.taxicaller.net";
  const apiKey = process.env.TAXICALLER_API_KEY;
  const jwt = process.env.TAXICALLER_DEV_JWT || process.env.TAXICALLER_JWT;

  const url = `https://${apiDomain}/api/v1/booker/order`;

  log("\n📡 Endpoint:", url);
  log("🔑 API Key:", apiKey ? "✓ present" : "✗ MISSING");
  log("🔑 JWT:", jwt ? `✓ present (${jwt.substring(0, 15)}...)` : "✗ MISSING");

  if (!apiKey || !jwt) {
    logError("❌ Missing API credentials");
    return NextResponse.json<ErrorResponse>(
      { ok: false, error: "Server configuration error - missing API credentials" },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "Authorization": `Bearer ${jwt}`,
      },
      body: JSON.stringify(payload),
    });

    const rawText = await response.text();

    log("\n📥 Response Status:", `${response.status} ${response.statusText}`);
    log("📥 Response Body:", rawText.substring(0, 1000));

    // ─────────────────────────────────────────────────────────────────────────
    // 6. HANDLE ERRORS
    // ─────────────────────────────────────────────────────────────────────────

    // Check for HTML error pages
    if (rawText.includes("<html") || rawText.includes("<!DOCTYPE")) {
      logError("❌ TaxiCaller returned HTML error page");
      return NextResponse.json<ErrorResponse>(
        { ok: false, error: "TaxiCaller service unavailable" },
        { status: 503 }
      );
    }

    // Parse JSON
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      logError("❌ TaxiCaller returned non-JSON response");
      return NextResponse.json<ErrorResponse>(
        { 
          ok: false, 
          error: "Invalid response from TaxiCaller",
          details: isDev ? { raw: rawText.substring(0, 300) } : undefined,
        },
        { status: 502 }
      );
    }

    // Handle HTTP error status codes
    if (!response.ok) {
      let errorMessage = "Booking failed";

      // Check for NullPointerException
      if (rawText.includes("NullPointerException")) {
        errorMessage = "TaxiCaller server error - missing required field in payload";
        logError("❌ NullPointerException detected! Check payload structure against API docs.");
      } else {
        switch (response.status) {
          case 400:
            errorMessage = data.message || data.error || "Invalid booking data";
            if (data.errors && Array.isArray(data.errors)) {
              errorMessage = data.errors.map((e: any) => e.err_msg || e.message || e).join(", ");
            }
            break;
          case 401:
            errorMessage = "Authentication failed - invalid API key or JWT";
            break;
          case 403:
            errorMessage = "Access denied - check API permissions";
            break;
          case 404:
            errorMessage = "TaxiCaller endpoint not found";
            break;
          case 500:
            errorMessage = "TaxiCaller server error - please try again";
            break;
          default:
            errorMessage = data.message || data.error || `TaxiCaller error: ${response.status}`;
        }
      }

      logError(`❌ TaxiCaller API error (${response.status}):`, data);

      return NextResponse.json<ErrorResponse>(
        { 
          ok: false, 
          error: errorMessage,
          details: isDev ? data : undefined,
        },
        { status: response.status >= 500 ? 502 : response.status }
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. SUCCESS RESPONSE
    // ─────────────────────────────────────────────────────────────────────────

    const orderId = data.order_id || data.id || data.orderId || data.booking_id;

    log("\n" + "═".repeat(70));
    log("✅ BOOKING CREATED SUCCESSFULLY!");
    log("═".repeat(70));
    log("   Order ID:", orderId);

    return NextResponse.json<SuccessResponse>({
      ok: true,
      order_id: orderId,
      raw: isDev ? data : undefined,
    });

  } catch (error: any) {
    // ─────────────────────────────────────────────────────────────────────────
    // NETWORK/FETCH ERRORS
    // ─────────────────────────────────────────────────────────────────────────

    logError("❌ Network error:", error.message);

    let errorMessage = "Failed to connect to TaxiCaller";

    if (error.name === "AbortError") {
      errorMessage = "Request timed out - please try again";
    } else if (error.code === "ENOTFOUND") {
      errorMessage = "TaxiCaller DNS lookup failed";
    } else if (error.code === "ECONNREFUSED") {
      errorMessage = "TaxiCaller connection refused";
    } else if (error.code === "ETIMEDOUT") {
      errorMessage = "TaxiCaller connection timed out";
    }

    return NextResponse.json<ErrorResponse>(
      { 
        ok: false, 
        error: errorMessage,
        details: isDev ? { message: error.message } : undefined,
      },
      { status: 503 }
    );
  }
}











