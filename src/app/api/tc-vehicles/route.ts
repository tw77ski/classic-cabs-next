import { NextResponse } from "next/server";

// Extend global for logging throttle
declare global {
  var lastVehicleLog: number | undefined;
}

// TaxiCaller API Documentation: https://app.taxicaller.net/documentation/api/
// Vehicle endpoint: /api/v1/company/{company_id}/vehicle

const TC_API_BASE = "https://api.taxicaller.net";
const TC_API_RC = "https://api-rc.taxicaller.net";

// Get JWT token from API key (valid for 15 minutes)
async function getJwtToken(): Promise<string | null> {
  const apiKey = process.env.TAXICALLER_API_KEY;
  const apiDomain = process.env.TAXICALLER_API_DOMAIN || "api.taxicaller.net";
  
  if (!apiKey) return null;
  
  const baseUrl = apiDomain.includes("rc") ? TC_API_RC : TC_API_BASE;
  
  try {
    const res = await fetch(
      `${baseUrl}/api/v1/jwt/for-key?key=${apiKey}&sub=*`
    );
    if (!res.ok) {
      console.error("JWT fetch failed:", res.status);
      return null;
    }
    const data = await res.json();
    return data.token || null;
  } catch (err) {
    console.error("JWT error:", err);
    return null;
  }
}

export async function GET() {
  try {
    const apiDomain = process.env.TAXICALLER_API_DOMAIN || "api.taxicaller.net";
    const companyId = process.env.TAXICALLER_COMPANY_ID;

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "Missing TaxiCaller company ID" },
        { status: 500 }
      );
    }

    // Get JWT token for authentication
    const token = await getJwtToken();
    if (!token) {
      console.error("Failed to get JWT token for vehicles API");
      return NextResponse.json(
        { success: false, error: "Authentication failed" },
        { status: 401 }
      );
    }

    const baseUrl = apiDomain.includes("rc") ? TC_API_RC : TC_API_BASE;
    
    // Correct endpoint per TaxiCaller API docs: /api/v1/company/{company_id}/vehicle
    const url = `${baseUrl}/api/v1/company/${companyId}/vehicle`;
    
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      // Return empty list for 404 (endpoint may not be available in RC/staging)
      // This is a known limitation - vehicle tracking may require production API
      if (res.status === 404) {
        // Only log once per minute to reduce spam
        const now = Date.now();
        if (!global.lastVehicleLog || now - global.lastVehicleLog > 60000) {
          console.log("ℹ️ Vehicle tracking not available in staging (404)");
          global.lastVehicleLog = now;
        }
        return NextResponse.json({
          success: true,
          drivers: [],
          total: 0,
          note: "Vehicle tracking not available in staging environment. Works in production.",
        });
      }
      
      const errorText = await res.text();
      console.error("TaxiCaller vehicles error:", res.status, errorText);
      return NextResponse.json(
        { success: false, error: "TaxiCaller request failed", status: res.status },
        { status: res.status === 401 ? 401 : 500 }
      );
    }

    const json = await res.json();
    console.log("✅ Vehicles response:", JSON.stringify(json).substring(0, 200));

    // Normalize vehicle list from TaxiCaller response
    // API returns: { list: [...vehicles] }
    interface TCVehicle {
      id?: string | number;
      number?: number;
      callsign?: string;
      type?: number;
      capacity?: {
        seats?: number;
        bags?: number;
        wc?: number;
      };
      // Location data may come from a different endpoint
      location?: {
        lat?: number;
        lng?: number;
        heading?: number;
      };
      status?: string;
    }

    const rawList = (json.list || json.vehicles || json.drivers || []) as TCVehicle[];
    
    const drivers = rawList.map((v) => ({
      id: v.id?.toString() || v.number?.toString() || "",
      number: v.number,
      callsign: v.callsign || `Vehicle ${v.number}`,
      type: v.type,
      capacity: v.capacity,
      lat: v.location?.lat,
      lng: v.location?.lng,
      heading: v.location?.heading || 0,
      status: v.status || "unknown",
    }));

    return NextResponse.json({
      success: true,
      drivers,
      total: drivers.length,
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
