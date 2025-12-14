import { NextRequest, NextResponse } from "next/server";
import type { BookingStatusResponse } from "@/lib/taxicaller-types";

// =============================================================================
// TaxiCaller Booker API - Order Status
// GET https://api-rc.taxicaller.net/api/v1/booker/order/{orderId}/status
// =============================================================================

// Internal type for TaxiCaller status response
interface TCStatusResponse {
  message?: string;
  error?: string;
  err_msg?: string;
  status?: string;
  order_status?: {
    job?: {
      state?: string;
    };
    state?: {
      state?: string;
    };
    resource?: {
      name?: string;
      driver_name?: string;
      phone?: string;
      vehicle_reg?: string;
      registration?: string;
      vehicle_model?: string;
      vehicle?: string;
      eta?: number;
    };
    eta_minutes?: number;
  };
}

const isDev = process.env.NODE_ENV === "development";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bookingId = searchParams.get("bookingId") || searchParams.get("booking_id");

  if (!bookingId) {
    return NextResponse.json<BookingStatusResponse>(
      { success: false, error: "Missing booking ID" },
      { status: 400 }
    );
  }

  if (isDev) console.log("📊 Status request for booking:", bookingId);

  const apiDomain = process.env.TAXICALLER_API_DOMAIN || "api-rc.taxicaller.net";
  const apiKey = process.env.TAXICALLER_API_KEY;
  const jwt = process.env.TAXICALLER_DEV_JWT || process.env.TAXICALLER_JWT;
  
  // Use Booker API endpoint for order status
  const url = `https://${apiDomain}/api/v1/booker/order/${bookingId}/status`;

  if (isDev) console.log("📡 URL:", url);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwt}`,
        "x-api-key": apiKey || "",
      },
    });

    const raw = await response.text();
    if (isDev) {
      console.log("📥 Response status:", response.status);
      console.log("📥 Response body:", raw.substring(0, 500));
    }

    // Check for HTML error pages (404, 502, etc.)
    if (raw.includes("<html") || raw.includes("<!DOCTYPE")) {
      // If 404, the booking might not exist or was cancelled
      if (response.status === 404) {
        return NextResponse.json<BookingStatusResponse>({
          success: true,
          booking_id: bookingId,
          status: "not_found",
        });
      }
      return NextResponse.json<BookingStatusResponse>(
        { success: false, error: "TaxiCaller service error" },
        { status: 502 }
      );
    }

    // Try to parse JSON
    let data: TCStatusResponse;
    try {
      data = JSON.parse(raw) as TCStatusResponse;
    } catch {
      // If not JSON but status OK, return unknown status
      if (response.ok) {
        return NextResponse.json<BookingStatusResponse>({
          success: true,
          booking_id: bookingId,
          status: "unknown",
        });
      }
      return NextResponse.json<BookingStatusResponse>(
        { success: false, error: "Invalid response from TaxiCaller" },
        { status: 502 }
      );
    }

    if (!response.ok) {
      const errorMessage = data.message || data.error || data.err_msg || "Failed to get booking status";
      return NextResponse.json<BookingStatusResponse>(
        { success: false, error: errorMessage },
        { status: response.status }
      );
    }

    // Booker API returns order_status object with job state
    // Example: { order_status: { job: { state: "cancelled" }, ... } }
    const orderStatus = data.order_status;
    const jobState = orderStatus?.job?.state || orderStatus?.state?.state || data.status || "pending";
    
    // Extract driver/resource info if available
    const resource = orderStatus?.resource;
    const driver = resource ? {
      name: resource.name || resource.driver_name,
      phone: resource.phone,
      vehicle_reg: resource.vehicle_reg || resource.registration,
      vehicle_model: resource.vehicle_model || resource.vehicle,
      eta_minutes: orderStatus?.eta_minutes || resource.eta,
    } : undefined;

    if (isDev) console.log("✅ Status retrieved:", jobState);

    return NextResponse.json<BookingStatusResponse>({
      success: true,
      booking_id: bookingId,
      status: jobState,
      driver,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Status error:", errorMessage);
    return NextResponse.json<BookingStatusResponse>(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// Also support POST for backwards compatibility
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const bookingId = body.bookingId || body.booking_id;
  
  // Create a new URL with the booking ID as a query param
  const url = new URL(req.url);
  url.searchParams.set("bookingId", bookingId);
  
  // Create a new request with the modified URL
  const newReq = new NextRequest(url, {
    method: "GET",
    headers: req.headers,
  });
  
  return GET(newReq);
}
