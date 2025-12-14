import { NextResponse } from "next/server";

export async function GET() {
    try {
    const apiDomain = process.env.TAXICALLER_API_DOMAIN || "api.taxicaller.net";
        const apiKey = process.env.TAXICALLER_API_KEY;
        const companyId = process.env.TAXICALLER_COMPANY_ID;
    const jwt = process.env.TAXICALLER_DEV_JWT;

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "Missing TaxiCaller company ID" },
        { status: 500 }
      );
    }

    // Try JWT auth first (for RC environment), fall back to API key
    let url: string;
    let headers: Record<string, string> = {};

    if (jwt && apiDomain.includes("rc")) {
      // RC environment with JWT
      url = `https://${apiDomain}/booker/vehicles?company_id=${companyId}`;
      headers = {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      };
    } else if (apiKey) {
      // Production with API key
      url = `https://${apiDomain}/v2/drivers/locations?api_key=${apiKey}&coid=${companyId}`;
    } else {
            return NextResponse.json(
        { success: false, error: "Missing TaxiCaller credentials" },
                { status: 500 }
            );
        }

    const res = await fetch(url, { headers });

        if (!res.ok) {
      const errorText = await res.text();
      console.error("TaxiCaller vehicles error:", res.status, errorText);
            return NextResponse.json(
                { success: false, error: "TaxiCaller request failed" },
                { status: 500 }
            );
        }

        const json = await res.json();

    // Normalize driver/vehicle list
    interface TCVehicle {
      uid?: string;
      id?: string;
      lat?: number;
      lng?: number;
      heading?: number;
      status?: string;
      name?: string;
    }
    
    const rawList = (json.drivers || json.vehicles || []) as TCVehicle[];
    const drivers = rawList.map((d) => ({
      id: d.uid || d.id,
            lat: d.lat,
            lng: d.lng,
            heading: d.heading || 0,
            status: d.status || "unknown",
      name: d.name || "",
        }));

        return NextResponse.json({
            success: true,
            drivers,
        });
    } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("TC vehicles error:", err);
        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500 }
        );
    }
}
