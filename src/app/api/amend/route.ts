import { NextResponse } from "next/server";

// =============================================================================
// Booking Amendment API
// Attempts to update an existing booking, falls back to cancel & rebook
// =============================================================================

const TC_DOMAIN = process.env.TAXICALLER_API_DOMAIN || "api-rc.taxicaller.net";
const TC_KEY = process.env.TAXICALLER_API_KEY;
const TC_COMPANY_ID = Number(process.env.TAXICALLER_COMPANY_ID);
const TC_SUB = process.env.TAXICALLER_SUB || "*";

// JWT cache
let cachedJwt: string | null = null;
let jwtExp = 0;

async function getJwt(): Promise<string> {
  if (!TC_KEY) throw new Error("TAXICALLER_API_KEY not configured");

  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && now < jwtExp - 60) return cachedJwt;

  const url = `https://${TC_DOMAIN}/api/v1/jwt/for-key`;
  const params = new URLSearchParams({ key: TC_KEY, sub: TC_SUB });

  const res = await fetch(`${url}?${params}`);
  if (!res.ok) throw new Error(`Failed to get JWT: ${res.status}`);
  
  const data = await res.json();
  if (!data?.token) throw new Error("No JWT token in response");

  const token: string = data.token;
  cachedJwt = token;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    jwtExp = payload.exp || now + 840;
  } catch {
    jwtExp = now + 840;
  }

  return token;
}

// Helper to convert coordinates
const toTC = (lng: number, lat: number) => [
  Math.round(lng * 1e6),
  Math.round(lat * 1e6),
];

interface AmendRequest {
  job_id?: string | number;  // Numeric job ID (shown in TaxiCaller dispatch)
  order_id?: string;          // String order ID (required for API calls) - e.g. "66cc3c074e2208db"
  // New details (any can be updated)
  pickup?: { address: string; lat: number; lng: number };
  dropoff?: { address: string; lat: number; lng: number };
  pickup_time?: string; // ISO string
  passenger?: { name: string; phone: string; email?: string };
  passengers?: number;
  luggage?: number;
  notes?: string;
}

export async function POST(req: Request) {
  try {
    const body: AmendRequest = await req.json();

    // TaxiCaller API uses order_id (hex string like "66cc3c074e2208db") for cancel endpoint
    // Per docs: POST /api/v1/booker/order/{order_id}/cancel
    const orderId = body.order_id;
    const jobId = body.job_id;

    if (!orderId && !jobId) {
      return NextResponse.json(
        { ok: false, error: "order_id or job_id is required" },
        { status: 400 }
      );
    }

    // Check if we have a valid hex order_id
    const isHexOrderId = orderId && /^[0-9a-f]+$/i.test(orderId);
    
    // Prefer order_id for API calls (hex string like "66cc3c074e2208db")
    const apiOrderId = isHexOrderId ? orderId : (orderId || String(jobId));

    console.log("📝 Amendment request for order:", apiOrderId, "(job_id:", jobId, ", isHex:", isHexOrderId, ")");
    
    // Warn if we don't have a proper hex order_id
    if (!isHexOrderId) {
      console.warn("⚠️ No hex order_id available - using job_id which may fail with TaxiCaller API");
    }

    const jwt = await getJwt();

    // ==========================================================================
    // STEP 1: Try direct update (PUT/PATCH) - TaxiCaller may support this
    // ==========================================================================
    
    // Try PUT first - use order_id for API calls
    const updateUrl = `https://${TC_DOMAIN}/api/v1/booker/order/${apiOrderId}`;
    console.log("🔄 Attempting direct update via PUT:", updateUrl);

    const updatePayload = buildUpdatePayload(body);
    
    const putRes = await fetch(updateUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify(updatePayload),
    });

    const putText = await putRes.text();
    console.log("📥 PUT response:", putRes.status, putText.substring(0, 200));

    // If PUT works (2xx response with valid JSON), return success
    if (putRes.ok && !putText.includes("<html")) {
      try {
        const putData = JSON.parse(putText);
        console.log("✅ Direct update successful!");
        return NextResponse.json({
          ok: true,
          method: "direct_update",
          order_id: apiOrderId,
          job_id: jobId,
          message: "Booking updated successfully",
          taxicaller: putData,
        });
      } catch {
        // Not valid JSON, continue to fallback
      }
    }

    // Try PATCH as alternative
    console.log("🔄 PUT failed, trying PATCH...");
    const patchRes = await fetch(updateUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify(updatePayload),
    });

    const patchText = await patchRes.text();
    console.log("📥 PATCH response:", patchRes.status, patchText.substring(0, 200));

    if (patchRes.ok && !patchText.includes("<html")) {
      try {
        const patchData = JSON.parse(patchText);
        console.log("✅ PATCH update successful!");
        return NextResponse.json({
          ok: true,
          method: "direct_update",
          order_id: apiOrderId,
          job_id: jobId,
          message: "Booking updated successfully",
          taxicaller: patchData,
        });
      } catch {
        // Not valid JSON, continue to fallback
      }
    }

    // ==========================================================================
    // STEP 2: Fallback to Cancel & Rebook
    // Per TaxiCaller API: POST /api/v1/booker/order/{order_id}/cancel
    // ==========================================================================
    
    console.log("⚠️ Direct update not supported, using Cancel & Rebook");

    // First, cancel the existing booking using order_id (not job_id)
    const cancelUrl = `https://${TC_DOMAIN}/api/v1/booker/order/${apiOrderId}/cancel`;
    console.log("🚫 Cancelling original booking:", cancelUrl);

    const cancelRes = await fetch(cancelUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        company_id: TC_COMPANY_ID,
        reason: "Amended by customer - creating new booking",
      }),
    });

    const cancelText = await cancelRes.text();
    console.log("📥 Cancel response:", cancelRes.status, cancelText.substring(0, 200));

    // Check if cancellation was successful (or booking already doesn't exist)
    if (!cancelRes.ok && cancelRes.status !== 404) {
      // Try to parse error
      let errorMsg = "Failed to cancel original booking";
      try {
        const cancelData = JSON.parse(cancelText);
        errorMsg = cancelData.message || cancelData.error || errorMsg;
      } catch {}
      
      return NextResponse.json(
        { ok: false, error: errorMsg, step: "cancel" },
        { status: 400 }
      );
    }

    console.log("✅ Original booking cancelled");

    // Now create a new booking with the updated details
    const bookUrl = `https://${TC_DOMAIN}/api/v1/booker/order`;
    const newBookingPayload = buildNewBookingPayload(body);

    console.log("📤 Creating new booking:", JSON.stringify(newBookingPayload, null, 2));

    const bookRes = await fetch(bookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify(newBookingPayload),
    });

    const bookText = await bookRes.text();
    console.log("📥 New booking response:", bookRes.status);

    if (!bookRes.ok) {
      let errorMsg = "Failed to create new booking";
      try {
        const bookData = JSON.parse(bookText);
        errorMsg = bookData.message || bookData.errors?.[0]?.message || errorMsg;
      } catch {}
      
      return NextResponse.json(
        { 
          ok: false, 
          error: errorMsg, 
          step: "rebook",
          original_cancelled: true,
          original_order_id: apiOrderId,
          original_job_id: jobId,
        },
        { status: 400 }
      );
    }

    let bookData;
    try {
      bookData = JSON.parse(bookText);
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid response from TaxiCaller" },
        { status: 500 }
      );
    }

    const newJobId = bookData.meta?.job_id;
    const newOrderId = bookData.order?.order_id;

    console.log("✅ Amendment complete! New job ID:", newJobId, "| New order ID:", newOrderId);

    return NextResponse.json({
      ok: true,
      method: "cancel_rebook",
      original_order_id: apiOrderId,
      original_job_id: jobId,
      new_order_id: newOrderId,
      new_job_id: newJobId,
      order_id: newOrderId,
      job_id: newJobId,
      message: "Booking amended successfully (cancelled and rebooked)",
      taxicaller: bookData,
    });

  } catch (err: unknown) {
    console.error("❌ Amendment error:", err);
    const message = err instanceof Error ? err.message : "Amendment failed";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

// Build payload for direct update attempt
function buildUpdatePayload(body: AmendRequest) {
  const payload: Record<string, unknown> = {
    company_id: TC_COMPANY_ID,
  };

  if (body.pickup) {
    payload.pickup = {
      address: body.pickup.address,
      coords: toTC(body.pickup.lng, body.pickup.lat),
    };
  }

  if (body.dropoff) {
    payload.dropoff = {
      address: body.dropoff.address,
      coords: toTC(body.dropoff.lng, body.dropoff.lat),
    };
  }

  if (body.pickup_time) {
    payload.pickup_time = Math.floor(new Date(body.pickup_time).getTime() / 1000);
  }

  if (body.passenger) {
    payload.passenger = body.passenger;
  }

  if (body.notes) {
    payload.notes = body.notes;
  }

  return payload;
}

// Node structure for TaxiCaller API
interface TCRouteNode {
  seq: number;
  actions: { "@type": string; item_seq: number; action: string }[];
  location: {
    name: string;
    coords: number[];
  };
  times: { arrive: { target: number; latest: number } } | null;
  info: { all: string };
}

// Build full booking payload for cancel & rebook
function buildNewBookingPayload(body: AmendRequest) {
  const pickupUnix = body.pickup_time 
    ? Math.floor(new Date(body.pickup_time).getTime() / 1000)
    : 0;

  const nodes: TCRouteNode[] = [];
  let seq = 0;

  // Pickup node
  if (body.pickup) {
    nodes.push({
      seq: seq++,
      actions: [{ "@type": "client_action", item_seq: 0, action: "in" }],
      location: {
        name: body.pickup.address,
        coords: toTC(body.pickup.lng, body.pickup.lat),
      },
      times: pickupUnix > 0 
        ? { arrive: { target: pickupUnix, latest: 0 } }
        : null,
      info: { all: body.notes || "" },
    });
  }

  // Dropoff node
  if (body.dropoff) {
    nodes.push({
      seq: seq++,
      actions: [{ "@type": "client_action", item_seq: 0, action: "out" }],
      location: {
        name: body.dropoff.address,
        coords: toTC(body.dropoff.lng, body.dropoff.lat),
      },
      times: null,
      info: { all: "" },
    });
  }

  return {
    order: {
      company_id: TC_COMPANY_ID,
      provider_id: 0,
      items: [
        {
          "@type": "passengers",
          seq: 0,
          passenger: body.passenger || { name: "Passenger", phone: "", email: "" },
          client_id: 0,
          require: {
            seats: body.passengers || 1,
            wc: 0,
            bags: body.luggage || 0,
          },
          info: { all: body.notes || "" },
          pay_info: [],
        },
      ],
      route: {
        meta: { dist: 0, est_dur: 0 },
        nodes,
        legs: [],
      },
      info: { all: body.notes || "" },
    },
  };
}

// GET endpoint to check amendment support
export async function GET() {
  return NextResponse.json({
    supported: true,
    methods: ["cancel_rebook", "direct_update_attempted"],
    note: "Direct update is attempted first (PUT/PATCH), falls back to cancel & rebook if not supported by TaxiCaller",
    contact: "For native amendment support, contact TaxiCaller support",
  });
}

