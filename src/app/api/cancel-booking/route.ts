import { NextResponse } from "next/server";

// =============================================================================
// TaxiCaller Booker API - Cancel Order
// POST https://api-rc.taxicaller.net/api/v1/booker/order/{jobId}/cancel
// =============================================================================

const isDev = process.env.NODE_ENV === "development";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Accept multiple naming conventions for the job/booking ID
    const jobId = body.booking_id || body.bookingId || body.job_id || body.jobId;

    if (!jobId) {
      return NextResponse.json({ error: "Missing booking_id" }, { status: 400 });
    }

    const apiDomain = process.env.TAXICALLER_API_DOMAIN || "api-rc.taxicaller.net";
    const apiKey = process.env.TAXICALLER_API_KEY;
    const jwt = process.env.TAXICALLER_DEV_JWT || process.env.TAXICALLER_JWT;
    const companyId = Number(process.env.TAXICALLER_COMPANY_ID) || 8284;

    // Use Booker API endpoint for cancellation
    const url = `https://${apiDomain}/api/v1/booker/order/${jobId}/cancel`;

    if (isDev) {
      console.log("🗑️ Cancelling booking at:", url);
      console.log("🔑 Company ID:", companyId);
      console.log("🔑 API Key exists:", !!apiKey);
    }

    // Check if mock mode is enabled
    const MOCK_BOOKING = process.env.MOCK_TAXICALLER_BOOKING === "true";
    
    if (MOCK_BOOKING) {
      if (isDev) console.log("✅ MOCK CANCELLATION for booking:", jobId);
      return NextResponse.json({
        status: "cancelled",
        booking_id: jobId,
        message: "Mock booking cancelled",
      });
    }

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
      console.log("📥 TaxiCaller cancel response:", raw.substring(0, 500));
      console.log("📊 Response Status:", response.status);
    }

    // Check for HTML error pages
    if (raw.includes("<html") || raw.includes("<!DOCTYPE")) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: "Booking not found or already cancelled" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "TaxiCaller service error" },
        { status: 502 }
      );
    }

    let parsed;
    try {
      parsed = raw ? JSON.parse(raw) : { status: "cancelled" };
    } catch {
      // If no JSON but status is OK, treat as success
      if (response.ok) {
        if (isDev) console.log("✅ Booking cancelled successfully");
        return NextResponse.json({
          status: "cancelled",
          booking_id: jobId,
        });
      }
      console.error("❌ Failed to parse cancel response");
      return NextResponse.json(
        { error: "Invalid response from TaxiCaller" },
        { status: 502 }
      );
    }

    // If response is OK, treat as success
    if (response.ok) {
      if (isDev) console.log("✅ Booking cancelled successfully");
      return NextResponse.json({
        status: "cancelled",
        booking_id: jobId,
        ...parsed,
      });
    }

    console.error("❌ Cancel failed:", parsed);
    return NextResponse.json(
      { error: parsed.message || parsed.error || "Failed to cancel booking" },
      { status: response.status }
    );

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("❌ Cancel booking error:", err);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
