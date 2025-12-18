import { NextRequest, NextResponse } from "next/server";
import type { CancelResponse } from "@/lib/taxicaller-types";

// =============================================================================
// TaxiCaller Booker API - Cancel Order
// POST https://api-rc.taxicaller.net/api/v1/booker/order/{order_id}/cancel
//
// IMPORTANT: The TaxiCaller cancel API requires the order_id (hex string like
// "66cc3c074e2208db"), NOT the job_id (numeric like "5325418")
// =============================================================================

const isDev = process.env.NODE_ENV === "development";

export async function DELETE(req: NextRequest) {
  if (isDev) console.log("🚫 Cancel booking request received");

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json<CancelResponse>(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // Prioritize order_id (hex string) for API call, fall back to job_id
  // The TaxiCaller cancel endpoint requires the order_id format (hex string like "66cc3c074e2208db")
  const orderId = body.order_id || body.orderId || body.internal_order_id;
  const jobId = body.bookingId || body.booking_id || body.jobId || body.job_id;
  
  if (!orderId && !jobId) {
    return NextResponse.json<CancelResponse>(
      { success: false, error: "Missing booking/order ID" },
      { status: 400 }
    );
  }

  // Check if we have the correct order_id format
  // TaxiCaller cancel API expects a hex string, not a numeric job_id
  const isHexOrderId = orderId && /^[0-9a-f]+$/i.test(orderId);
  const cancelId = isHexOrderId ? orderId : (orderId || jobId);
  
  if (isDev) console.log("📋 Cancelling booking:", cancelId, "(order_id:", orderId, ", job_id:", jobId, ", isHex:", isHexOrderId, ")");
  
  // Warn if we're using a numeric job_id instead of hex order_id
  if (!isHexOrderId && jobId) {
    console.warn("⚠️ Using numeric job_id for cancel - may fail. For reliable cancellation, use order_id from booking response.");
  }

  const apiDomain = process.env.TAXICALLER_API_DOMAIN || "api-rc.taxicaller.net";
  const apiKey = process.env.TAXICALLER_API_KEY;
  const jwt = process.env.TAXICALLER_DEV_JWT || process.env.TAXICALLER_JWT;
  const companyId = Number(process.env.TAXICALLER_COMPANY_ID) || 8284;

  // Use Booker API endpoint for cancellation
  // Per TaxiCaller docs: POST /api/v1/booker/order/{order_id}/cancel
  const url = `https://${apiDomain}/api/v1/booker/order/${cancelId}/cancel`;

  if (isDev) console.log("📡 URL:", url);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwt}`,
        "x-api-key": apiKey || "",
      },
      body: JSON.stringify({ 
        company_id: companyId,
        reason: body.reason || "Cancelled by customer via web booking",
      }),
    });

    const raw = await response.text();
    if (isDev) {
      console.log("📥 Response status:", response.status);
      console.log("📥 Response body:", raw.substring(0, 500));
    }

    // Check for HTML error pages (404, 502, etc.)
    if (raw.includes("<html") || raw.includes("<!DOCTYPE")) {
      // If 404, the job ID might not exist or already cancelled
      if (response.status === 404) {
        return NextResponse.json<CancelResponse>(
          { success: false, error: "Booking not found or already cancelled" },
          { status: 404 }
        );
      }
      return NextResponse.json<CancelResponse>(
        { success: false, error: "TaxiCaller service error" },
        { status: 502 }
      );
    }

    // Try to parse JSON
    let data: { message?: string; error?: string; err_msg?: string };
    try {
      data = JSON.parse(raw);
    } catch {
      // If no JSON but status is OK, consider it success
      if (response.ok) {
        if (isDev) console.log("✅ Booking cancelled (no JSON response):", cancelId);
        return NextResponse.json<CancelResponse>({
          success: true,
          message: "Booking cancelled successfully",
        });
      }
      return NextResponse.json<CancelResponse>(
        { success: false, error: "Invalid response from TaxiCaller" },
        { status: 502 }
      );
    }

    if (!response.ok) {
      const errorMessage = data.message || data.error || data.err_msg || "Failed to cancel booking";
      return NextResponse.json<CancelResponse>(
        { success: false, error: errorMessage },
        { status: response.status }
      );
    }

    if (isDev) console.log("✅ Booking cancelled:", cancelId);

    return NextResponse.json<CancelResponse>({
      success: true,
      message: data.message || "Booking cancelled successfully",
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Cancel error:", errorMessage);
    return NextResponse.json<CancelResponse>(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// Also support POST method for backwards compatibility
export async function POST(req: NextRequest) {
  return DELETE(req);
}
