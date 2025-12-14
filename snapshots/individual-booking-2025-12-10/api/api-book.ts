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
  return_order_id?: string; // If return trip was booked
  raw?: unknown;
}

interface ErrorResponse {
  ok: false;
  error: string;
  fields?: string[];
  details?: unknown;
}

type BookApiResponse = SuccessResponse | ErrorResponse;

// TaxiCaller API response types
interface TaxiCallerResponse {
  order_token?: string;
  order_id?: string;
  id?: string;
  orderId?: string;
  booking_id?: string;
  message?: string;
  error?: string;
  errors?: Array<{ err_msg?: string; message?: string }>;
  meta?: {
    job_id?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// Stop location type
interface StopLocation {
  address?: string;
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
}

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
function log(message: string, data?: unknown) {
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
function logError(message: string, data?: unknown) {
  if (isDev) {
    console.error(message, data);
  } else {
    const dataObj = data && typeof data === "object" ? data as Record<string, unknown> : null;
    console.error(message, dataObj?.message || dataObj?.error || "");
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

  // Build notes (return trip handled as separate booking, not in notes)
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
  if (body.luggage > 0) {
    notesParts.push(`🧳 Luggage: ${body.luggage}`);
  }
  if (body.notes) {
    notesParts.push(`📝 ${body.notes}`);
  }
  // If return trip is requested, note it on the outbound booking for reference
  if (body.return_trip && body.return_time) {
    const returnDate = new Date(body.return_time);
    const formattedReturn = returnDate.toLocaleString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    notesParts.push(`🔄 Return booked: ${formattedReturn}`);
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

  // Extract valid stops (must have lat, lng, and address)
  const validStops = ((body.stops || []) as StopLocation[]).filter((stop) => 
    stop && 
    stop.address && 
    (stop.lat != null || stop.latitude != null) && 
    (stop.lng != null || stop.longitude != null)
  ).map((stop) => ({
    address: stop.address!,
    lat: stop.lat ?? stop.latitude!,
    lng: stop.lng ?? stop.longitude!,
  }));

  // Build route nodes: pickup -> stops -> dropoff
  // Based on TaxiCaller support example from Juliana
  const routeNodes: RouteNode[] = [];
  let currentSeq = 0;

  // Store all coordinates for building legs
  const allCoords: [number, number][] = [];
  const pickupCoords = toTaxiCallerCoords(pickupLat, pickupLng);
  allCoords.push(pickupCoords);

  // Pickup node (seq: 0) - passenger gets IN
  routeNodes.push({
    actions: [
      {
        "@type": "client_action",
        item_seq: 0,
        action: "in", // Pickup
      },
    ],
    location: {
      name: body.pickup.address,
      coords: pickupCoords,
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
    seq: currentSeq++,
  });

  // Intermediate stop nodes - waypoints (empty actions array per Juliana's example)
  for (const stop of validStops) {
    const stopCoords = toTaxiCallerCoords(stop.lat, stop.lng);
    allCoords.push(stopCoords);
    
    routeNodes.push({
      actions: [], // Waypoint - empty actions array
      location: {
        name: stop.address,
        coords: stopCoords,
      },
      // Per Juliana's example: stops need times object with target: 0, latest: 0
      times: {
        arrive: {
          target: 0,
          latest: 0,
        },
      },
      info: {},
      seq: currentSeq++,
    });
  }

  // Dropoff node (final seq) - passenger gets OUT
  const dropoffCoords = toTaxiCallerCoords(dropoffLat, dropoffLng);
  allCoords.push(dropoffCoords);
  
  routeNodes.push({
    actions: [
      {
        "@type": "client_action",
        item_seq: 0,
        action: "out", // Dropoff
      },
    ],
    location: {
      name: body.dropoff.address,
      coords: dropoffCoords,
    },
    // Per Juliana's example: dropoff also needs times object
    times: {
      arrive: {
        target: 0,
        latest: 0,
      },
    },
    info: {},
    seq: currentSeq,
  });

  // Build legs connecting all nodes with pts array (per Juliana's example)
  const routeLegs: RouteLeg[] = [];
  for (let i = 0; i < routeNodes.length - 1; i++) {
    const fromCoords = allCoords[i];
    const toCoords = allCoords[i + 1];
    
    routeLegs.push({
      from_seq: i,
      to_seq: i + 1,
      meta: {
        dist: 0, // Will be calculated by TaxiCaller
        est_dur: 0,
      },
      // Include pts array with from and to coordinates (per Juliana's example)
      pts: [fromCoords[0], fromCoords[1], toCoords[0], toCoords[1]],
    });
  }

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

      // Route with nodes (pickup -> stops -> dropoff)
      route: {
        nodes: routeNodes,
        legs: routeLegs,
        meta: {
          dist: 0,
          est_dur: 0,
        },
      },
    },
  };

  log(`📍 Route: ${routeNodes.length} nodes (pickup + ${validStops.length} stops + dropoff)`);

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
    let data: TaxiCallerResponse;
    try {
      data = JSON.parse(rawText) as TaxiCallerResponse;
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
              errorMessage = data.errors.map((e) => e.err_msg || e.message || String(e)).join(", ");
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

    // Extract the proper order_id from the order_token JWT
    // The JWT contains: { oid: "hex_order_id", jid: numeric_job_id, ... }
    // The cancel API expects the hex oid, not the numeric jid
    let orderId = "unknown";
    
    if (data.order_token) {
      try {
        // Decode JWT payload (base64url encoded, 2nd part)
        const parts = data.order_token.split('.');
        if (parts.length >= 2) {
          const payload = JSON.parse(
            Buffer.from(parts[1], 'base64url').toString('utf-8')
          );
          orderId = payload.oid || payload.order_id || String(payload.jid) || "unknown";
          log("   Decoded JWT - oid: " + payload.oid + ", jid: " + payload.jid);
        }
      } catch {
        log("   Could not decode order_token JWT, falling back to meta.job_id");
        orderId = data.order_id || data.id || data.orderId || data.booking_id || 
                  String(data.meta?.job_id) || "unknown";
      }
    } else {
      orderId = data.order_id || data.id || data.orderId || data.booking_id || 
                String(data.meta?.job_id) || "unknown";
    }

    log("\n" + "═".repeat(70));
    log("✅ BOOKING CREATED SUCCESSFULLY!");
    log("═".repeat(70));
    log("   Order ID:", orderId);

    // ─────────────────────────────────────────────────────────────────────────
    // 8. CREATE RETURN TRIP BOOKING (if requested)
    // ─────────────────────────────────────────────────────────────────────────

    let returnOrderId: string | undefined;

    if (body.return_trip && body.return_time) {
      log("\n" + "─".repeat(70));
      log("🔄 CREATING RETURN TRIP BOOKING");
      log("─".repeat(70));

      // Parse return time - convert ISO to Unix timestamp
      const returnTimeUnix = toUnixSeconds(body.return_time);
      log("   Return Time (Unix):", returnTimeUnix);
      log("   Return Time (ISO):", body.return_time);

      // Build REVERSED route: dropoff becomes pickup, pickup becomes dropoff
      const returnRouteNodes: RouteNode[] = [];
      let returnSeq = 0;

      // Return trip pickup (original dropoff location)
      returnRouteNodes.push({
        actions: [
          {
            "@type": "client_action",
            item_seq: 0,
            action: "in",
          },
        ],
        location: {
          name: body.dropoff.address,
          coords: dropoffCoords,
        },
        times: {
          arrive: {
            target: returnTimeUnix,
            latest: 0,
          },
        },
        info: {
          all: `🔄 RETURN TRIP | Original booking: ${orderId}`,
        },
        seq: returnSeq++,
      });

      // Return trip dropoff (original pickup location)
      returnRouteNodes.push({
        actions: [
          {
            "@type": "client_action",
            item_seq: 0,
            action: "out",
          },
        ],
        location: {
          name: body.pickup.address,
          coords: pickupCoords,
        },
        times: {
          arrive: {
            target: 0,
            latest: 0,
          },
        },
        info: {},
        seq: returnSeq,
      });

      // Build return legs
      const returnRouteLegs: RouteLeg[] = [
        {
          from_seq: 0,
          to_seq: 1,
          meta: { dist: 0, est_dur: 0 },
          pts: [dropoffCoords[0], dropoffCoords[1], pickupCoords[0], pickupCoords[1]],
        },
      ];

      const returnPayload: BookerPayload = {
        order: {
          company_id: companyId,
          provider_id: providerId,
          items: [
            {
              "@type": "passengers",
              seq: 0,
              passenger: {
                name: customerName,
                phone: customerPhone,
                email: customerEmail,
              },
              client_id: null,
              account: null,
              require: {
                seats: body.passengers || 1,
                wc: 0,
                bags: body.luggage || 0,
              },
              pay_info: [{ "@t": 0, data: null }],
            },
          ],
          route: {
            nodes: returnRouteNodes,
            legs: returnRouteLegs,
            meta: { dist: 0, est_dur: 0 },
          },
        },
      };

      log("📤 Return trip payload:", returnPayload);

      try {
        const returnResponse = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "Authorization": `Bearer ${jwt}`,
          },
          body: JSON.stringify(returnPayload),
        });

        const returnRawText = await returnResponse.text();
        log("📥 Return trip response status:", `${returnResponse.status}`);
        log("📥 Return trip response:", returnRawText.substring(0, 500));

        if (returnResponse.ok) {
          const returnData = JSON.parse(returnRawText);
          
          // Extract proper order_id from return trip's order_token JWT
          if (returnData.order_token) {
            try {
              const parts = returnData.order_token.split('.');
              if (parts.length >= 2) {
                const payload = JSON.parse(
                  Buffer.from(parts[1], 'base64url').toString('utf-8')
                );
                returnOrderId = payload.oid || String(payload.jid);
              }
            } catch {
              returnOrderId = returnData.order_id || String(returnData.meta?.job_id);
            }
          } else {
            returnOrderId = returnData.order_id || returnData.id || returnData.orderId || 
                            returnData.booking_id || String(returnData.meta?.job_id);
          }
          
          log("✅ Return trip booked successfully! Order ID:", returnOrderId);
        } else {
          logError("⚠️ Return trip booking failed:", returnRawText.substring(0, 300));
        }
      } catch (returnError: unknown) {
        const errorMessage = returnError instanceof Error ? returnError.message : "Unknown error";
        logError("⚠️ Return trip booking error:", errorMessage);
      }
    }

    return NextResponse.json<SuccessResponse>({
      ok: true,
      order_id: orderId,
      return_order_id: returnOrderId,
      raw: isDev ? data : undefined,
    });

  } catch (error: unknown) {
    // ─────────────────────────────────────────────────────────────────────────
    // NETWORK/FETCH ERRORS
    // ─────────────────────────────────────────────────────────────────────────

    const err = error instanceof Error ? error : new Error("Unknown error");
    const errWithCode = error as Error & { code?: string };

    logError("❌ Network error:", err.message);

    let errorMessage = "Failed to connect to TaxiCaller";

    if (err.name === "AbortError") {
      errorMessage = "Request timed out - please try again";
    } else if (errWithCode.code === "ENOTFOUND") {
      errorMessage = "TaxiCaller DNS lookup failed";
    } else if (errWithCode.code === "ECONNREFUSED") {
      errorMessage = "TaxiCaller connection refused";
    } else if (errWithCode.code === "ETIMEDOUT") {
      errorMessage = "TaxiCaller connection timed out";
    }

    return NextResponse.json<ErrorResponse>(
      { 
        ok: false, 
        error: errorMessage,
        details: isDev ? { message: err.message } : undefined,
      },
      { status: 503 }
    );
  }
}
