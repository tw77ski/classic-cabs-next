import { NextResponse, NextRequest } from "next/server";

// ---- CSRF Protection Helper ----
/**
 * Basic CSRF protection via Origin header validation
 * Ensures requests come from the same origin (prevents cross-site form submissions)
 */
function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  
  // Allow requests without origin header (same-origin requests in some browsers)
  if (!origin) return true;
  
  // Extract hostname from origin
  try {
    const originUrl = new URL(origin);
    // Check if origin matches the host (or localhost for development)
    const isValid = originUrl.host === host || 
                    originUrl.hostname === "localhost" ||
                    originUrl.hostname === "127.0.0.1" ||
                    (host ? host.includes("vercel.app") : false); // Allow Vercel preview deployments
    return isValid;
  } catch {
    return false;
  }
}

// ---- TaxiCaller env ----
const TC_DOMAIN = process.env.TAXICALLER_API_DOMAIN || "api-rc.taxicaller.net";
const TC_KEY = process.env.TAXICALLER_API_KEY;
const TC_COMPANY_ID = Number(process.env.TAXICALLER_COMPANY_ID);
const TC_SUB = process.env.TAXICALLER_SUB || "*";

// ---- JWT cache ----
let cachedJwt: string | null = null;
let jwtExp = 0;

/**
 * Get JWT token using the official TaxiCaller API endpoint
 * See: https://app.taxicaller.net/documentation/api/#api_v1_booker
 * GET /api/v1/jwt/for-key?key={API_KEY}&sub={SUBJECT}
 */
async function getJwt(): Promise<string> {
  if (!TC_KEY) throw new Error("TAXICALLER_API_KEY not configured");

  const now = Math.floor(Date.now() / 1000);
  // Return cached token if still valid (with 60s buffer)
  if (cachedJwt && now < jwtExp - 60) return cachedJwt;

  // Official endpoint per TaxiCaller docs
  const url = `https://${TC_DOMAIN}/api/v1/jwt/for-key`;
  const params = new URLSearchParams({ key: TC_KEY, sub: TC_SUB });

  console.log("🔑 Fetching JWT from:", url);
  
  const res = await fetch(`${url}?${params}`);
  if (!res.ok) {
    const text = await res.text();
    console.error("❌ JWT fetch failed:", res.status, text);
    throw new Error(`Failed to get JWT: ${res.status} ${text}`);
  }
  
  const data = await res.json();
  if (!data || !data.token) throw new Error("Failed to obtain JWT - no token in response");

  const token: string = data.token;
  cachedJwt = token;

  // Parse expiry from JWT payload
  try {
    const payloadJson = Buffer.from(token.split(".")[1], "base64").toString("utf8");
    const payload = JSON.parse(payloadJson);
    jwtExp = payload.exp || now + 840; // Default 14 min if no exp
  } catch {
    jwtExp = now + 840;
  }

  console.log("✅ JWT obtained, expires in", jwtExp - now, "seconds");
  return token;
}

// ---- Helpers ----
const jerseyFallback = { lat: 49.21, lng: -2.13 };

/**
 * Sanitize user input to prevent XSS (Critical Security Fix)
 * Removes < > \ characters, trims, and limits length
 */
function sanitizeText(text: string, maxLength: number = 500): string {
  if (!text) return "";
  return text
    .replace(/[<>\\]/g, "") // Remove potentially dangerous characters
    .trim()
    .slice(0, maxLength);
}

const toTC = (lng: number, lat: number) => [
  Math.round(lng * 1e6),
  Math.round(lat * 1e6),
];

function normPoint(
  name: string,
  lat?: number | null,
  lng?: number | null
): { name: string; lat: number; lng: number } {
  if (
    typeof lat === "number" &&
    typeof lng === "number" &&
    !Number.isNaN(lat) &&
    !Number.isNaN(lng)
  ) {
    return { name, lat, lng };
  }
  return { name, ...jerseyFallback };
}

interface RouteNode {
  seq: number;
  actions: Array<{ "@type": string; item_seq: number; action: string }>;
  location: { name: string; coords: number[] };
  times: { arrive: { target: number; latest: number } } | null;
  info: { all: string };
}

// Stop interface for booking request
interface BookingStop {
  address?: string;
  lat?: number;
  lng?: number;
}

// Request body interface
interface BookingRequestBody {
  pickup: { address?: string; lat: number; lng: number };
  dropoff: { address?: string; lat: number; lng: number };
  stops?: BookingStop[];
  rider: { name: string; phone: string; email?: string };
  when: { type: "asap" | "scheduled"; time?: string };
  vehicle_type?: string;
  vehicleType?: string;
  notes?: string;
  passengers?: number;
  luggage?: number;
}

function buildRouteNodes({
  pickupAddress,
  pickupLat,
  pickupLng,
  dropoffAddress,
  dropoffLat,
  dropoffLng,
  stops = [],
  pickupTimeUnix = 0,
  notes = "",
}: {
  pickupAddress: string;
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffAddress: string;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  stops?: Array<{ address: string; lat?: number | null; lng?: number | null }>;
  pickupTimeUnix?: number;
  notes?: string;
}): RouteNode[] {
  const safeNotes = (notes || "").trim();
  const pickup = normPoint(pickupAddress, pickupLat, pickupLng);
  const dropoff = normPoint(dropoffAddress, dropoffLat, dropoffLng);

  let seq = 0;
  const nodes: RouteNode[] = [];

  // Pickup node
  nodes.push({
    seq: seq++,
    actions: [{ "@type": "client_action", item_seq: 0, action: "in" }],
    location: {
      name: pickup.name,
      coords: toTC(pickup.lng, pickup.lat),
    },
    times:
      pickupTimeUnix > 0
        ? { arrive: { target: pickupTimeUnix, latest: 0 } }
        : null,
    info: { all: safeNotes },
  });

  // Intermediate stops (via points - passenger stays in vehicle)
  // Per TaxiCaller API docs: action "via" for intermediate stops
  for (const stop of stops) {
    if (!stop.address) continue;
    const p = normPoint(stop.address, stop.lat, stop.lng);
    nodes.push({
      seq: seq++,
      actions: [{ "@type": "client_action", item_seq: 0, action: "via" }],
      location: {
        name: p.name,
        coords: toTC(p.lng, p.lat),
      },
      times: null,
      info: { all: "" },
    });
  }

  // Dropoff node
  nodes.push({
    seq: seq++,
    actions: [{ "@type": "client_action", item_seq: 0, action: "out" }],
    location: {
      name: dropoff.name,
      coords: toTC(dropoff.lng, dropoff.lat),
    },
    times: null,
    info: { all: "" },
  });

  return nodes;
}

export async function POST(req: NextRequest) {
  try {
    // CSRF Protection: Validate request origin
    if (!validateOrigin(req)) {
      console.warn("🚫 [CSRF] Request rejected - invalid origin");
      return NextResponse.json(
        { ok: false, error: "Invalid request origin" },
        { status: 403 }
      );
    }
    
    const body = await req.json() as BookingRequestBody;

    // Validate pickup coordinates
    if (!body.pickup?.lat || !body.pickup?.lng) {
      return NextResponse.json(
        { ok: false, error: "Pickup coordinates (lat/lng) are required" },
        { status: 400 }
      );
    }

    // Validate dropoff coordinates
    if (!body.dropoff?.lat || !body.dropoff?.lng) {
      return NextResponse.json(
        { ok: false, error: "Dropoff coordinates (lat/lng) are required" },
        { status: 400 }
      );
    }

    // Validate rider info
    if (!body.rider?.name || !body.rider?.phone) {
      return NextResponse.json(
        { ok: false, error: "Rider name and phone are required" },
        { status: 400 }
      );
    }

    // Validate when object
    if (!body.when || !body.when.type) {
      return NextResponse.json(
        { ok: false, error: "Booking time (when) is required" },
        { status: 400 }
      );
    }

    // For scheduled bookings, time is required
    if (body.when.type === "scheduled" && !body.when.time) {
      return NextResponse.json(
        { ok: false, error: "Scheduled time is required for scheduled bookings" },
        { status: 400 }
      );
    }

    // TEMPORARY: Mock booking response for testing
    const MOCK_BOOKING = process.env.MOCK_TAXICALLER_BOOKING === "true";
    if (MOCK_BOOKING) {
      const mockBookingId = `MOCK-${Date.now()}`;
      console.log("✅ MOCK BOOKING CREATED:", mockBookingId);
      return NextResponse.json({
        ok: true,
        order_id: mockBookingId,
        status: "confirmed",
        message: "Mock booking created (TaxiCaller API disabled)",
      });
    }

    // Calculate pickup time
    const isAsap = body.when.type === "asap";
    const pickupUnix = !isAsap && body.when.time 
      ? Math.floor(Date.parse(body.when.time) / 1000) 
      : 0;

    // Build notes with vehicle type info (with XSS sanitization)
    const noteParts = [];
    if (body.vehicle_type === "luxury" || body.vehicleType === "luxury") {
      noteParts.push("Executive V-Class requested");
    }
    if (body.notes) {
      // Sanitize user-provided notes to prevent XSS attacks
      noteParts.push(sanitizeText(body.notes, 500));
    }
    const mergedNotes = noteParts.join(" • ");

    // Get JWT token (per official TaxiCaller API docs)
    console.log("🔑 Getting JWT token...");
    const jwt = await getJwt();
    console.log("✅ JWT token obtained");

    // Build stops array
    const stops = (body.stops || [])
      .filter((s: BookingStop) => s.address || (s.lat && s.lng))
      .map((s: BookingStop) => ({
        address: s.address || "",
        lat: s.lat,
        lng: s.lng,
      }));

    // Build route nodes (with sanitized addresses)
    const nodes = buildRouteNodes({
      pickupAddress: sanitizeText(body.pickup.address || "", 200),
      pickupLat: body.pickup.lat,
      pickupLng: body.pickup.lng,
      dropoffAddress: sanitizeText(body.dropoff.address || "", 200),
      dropoffLat: body.dropoff.lat,
      dropoffLng: body.dropoff.lng,
      stops: stops.map(s => ({
        ...s,
        address: sanitizeText(s.address || "", 200),
      })),
      pickupTimeUnix: pickupUnix,
      notes: mergedNotes,
    });

    // Build order payload (with sanitized user inputs)
    const orderPayload = {
      order: {
        company_id: TC_COMPANY_ID,
        provider_id: 0,
        items: [
          {
            "@type": "passengers",
            seq: 0,
            passenger: {
              name: sanitizeText(body.rider.name, 100),
              phone: sanitizeText(body.rider.phone, 20),
              email: sanitizeText(body.rider.email || "", 100),
            },
            client_id: 0,
            require: {
              seats: body.passengers || 1,
              wc: 0,
              bags: body.luggage || 0,
            },
            info: { all: mergedNotes },
            pay_info: [],
          },
        ],
        route: {
          meta: { dist: 0, est_dur: 0 },
          nodes,
          legs: [],
        },
        info: { all: mergedNotes },
      },
    };

    console.log("📤 Sending booking to TaxiCaller:", JSON.stringify(orderPayload, null, 2));

    const url = `https://${TC_DOMAIN}/api/v1/booker/order`;
    console.log("📡 POST URL:", url);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify(orderPayload),
    });

    const raw = await response.text();
    console.log("📥 RAW TAXICALLER RESPONSE:", raw);
    console.log("📊 Response Status:", response.status);

    // Parse response
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      console.error("❌ Failed to parse TaxiCaller JSON:", error);
      return NextResponse.json(
        { ok: false, error: "Invalid JSON received from TaxiCaller", raw: raw.substring(0, 500) },
        { status: 500 }
      );
    }

    if (!response.ok) {
      console.error("❌ TaxiCaller booking error:", response.status, parsed);
      return NextResponse.json(
        { ok: false, error: parsed.message || parsed.error || "Booking request failed", details: parsed },
        { status: response.status }
      );
    }

    console.log("✅ TaxiCaller booking success:", parsed);

    // Extract IDs from response
    // job_id = numeric ID shown in TaxiCaller dispatch (e.g. 5325418)
    // order_id = hex string needed for API calls like cancel (e.g. "66cc3c074e2208db")
    const jobId = parsed.meta?.job_id;
    const orderId = parsed.order?.order_id;
    
    console.log("📋 Job ID:", jobId, "| Order ID:", orderId);

    // Return hex order_id as the primary ID (needed for TaxiCaller API operations)
    // Also include job_id for display (matches what users see in TaxiCaller dispatch)
    return NextResponse.json({
      ok: true,
      // Primary ID - use hex order_id for API operations (cancel/amend)
      order_id: orderId || String(jobId || parsed.id),
      // Display ID - numeric job_id shown in TaxiCaller dispatch
      job_id: jobId,
      // Backwards compatibility
      booking_id: orderId || String(jobId || parsed.id),
      status: "confirmed",
      taxicaller: parsed,
    });

  } catch (err: unknown) {
    console.error("❌ Booking API error:", err);
    const message = err instanceof Error ? err.message : "Booking failed";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
