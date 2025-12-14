import { NextResponse } from "next/server";

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

  // Intermediate stops
  for (const stop of stops) {
    if (!stop.address) continue;
    const p = normPoint(stop.address, stop.lat, stop.lng);
    nodes.push({
      seq: seq++,
      actions: [{ "@type": "client_action", item_seq: 0, action: "out" }],
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

export async function POST(req: Request) {
  try {
    const body = await req.json();

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

    // Build notes with vehicle type info
    const noteParts = [];
    if (body.vehicle_type === "luxury" || body.vehicleType === "luxury") {
      noteParts.push("Executive V-Class requested");
    }
    if (body.notes) {
      noteParts.push(body.notes);
    }
    const mergedNotes = noteParts.join(" • ");

    // Get JWT token (per official TaxiCaller API docs)
    console.log("🔑 Getting JWT token...");
    const jwt = await getJwt();
    console.log("✅ JWT token obtained");

    // Build stops array
    const stops = (body.stops || [])
      .filter((s: any) => s.address || (s.lat && s.lng))
      .map((s: any) => ({
        address: s.address || "",
        lat: s.lat,
        lng: s.lng,
      }));

    // Build route nodes
    const nodes = buildRouteNodes({
      pickupAddress: body.pickup.address || "",
      pickupLat: body.pickup.lat,
      pickupLng: body.pickup.lng,
      dropoffAddress: body.dropoff.address || "",
      dropoffLat: body.dropoff.lat,
      dropoffLng: body.dropoff.lng,
      stops,
      pickupTimeUnix: pickupUnix,
      notes: mergedNotes,
    });

    // Build order payload
    const orderPayload = {
      order: {
        company_id: TC_COMPANY_ID,
        provider_id: 0,
        items: [
          {
            "@type": "passengers",
            seq: 0,
            passenger: {
              name: body.rider.name,
              phone: body.rider.phone,
              email: body.rider.email || "",
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

    // Extract the job_id from meta - this is the ID shown in TaxiCaller dispatch
    const jobId = parsed.meta?.job_id;
    const orderId = parsed.order?.order_id;
    
    console.log("📋 Job ID:", jobId, "| Order ID:", orderId);

    // Return success with job_id as the primary booking ID (matches TaxiCaller dispatch)
    return NextResponse.json({
      ok: true,
      order_id: String(jobId || orderId || parsed.id),
      job_id: jobId,
      internal_order_id: orderId,
      status: "confirmed",
      taxicaller: parsed,
    });

  } catch (err: any) {
    console.error("❌ Booking API error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Booking failed" },
      { status: 500 }
    );
  }
}
