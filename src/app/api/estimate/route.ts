import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validate required fields
    if (!body.pickup?.lat || !body.pickup?.lng) {
      return NextResponse.json(
        { error: "Pickup coordinates (lat/lng) are required" },
        { status: 400 }
      );
    }

    if (!body.dropoff?.lat || !body.dropoff?.lng) {
      return NextResponse.json(
        { error: "Dropoff coordinates (lat/lng) are required" },
        { status: 400 }
      );
    }

    const apiDomain = process.env.TAXICALLER_API_DOMAIN || "api-rc.taxicaller.net";
    const url = `https://${apiDomain}/external/v1/estimates`;

    console.log("📤 Sending estimate request to TaxiCaller");
    console.log("📡 POST URL:", url);
    console.log("🔑 Company ID:", process.env.TAXICALLER_COMPANY_ID);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.TAXICALLER_API_KEY!,
        "X-Company-ID": process.env.TAXICALLER_COMPANY_ID!,
      },
      body: JSON.stringify({
        company_id: Number(process.env.TAXICALLER_COMPANY_ID),
        ...body,
      }),
    });

    // Safely parse response - handle non-JSON responses
    const raw = await response.text();
    console.log("📥 RAW TAXICALLER RESPONSE:", raw.substring(0, 500));
    
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("❌ TaxiCaller estimate: Non-JSON response:", raw.substring(0, 500));
      return NextResponse.json(
        { error: "Invalid response from TaxiCaller", raw: raw.substring(0, 200) },
        { status: 502 }
      );
    }

    if (!response.ok) {
      console.error("❌ TaxiCaller estimate error:", response.status, parsed);
      return NextResponse.json(
        { error: "Estimate request failed", details: parsed },
        { status: response.status }
      );
    }

    console.log("✅ TaxiCaller estimate success");
    return NextResponse.json(parsed);

  } catch (err: any) {
    console.error("❌ Estimate API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
