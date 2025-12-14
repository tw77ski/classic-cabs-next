import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const TC_DOMAIN = process.env.TAXICALLER_API_DOMAIN || "api-rc.taxicaller.net";
const TC_KEY = process.env.TAXICALLER_API_KEY;
const TC_COMPANY_ID = Number(process.env.TAXICALLER_COMPANY_ID || 0);
const TC_SUB = process.env.TAXICALLER_SUB || "*";

let bookerJwt: string | null = null;
let bookerJwtExp = 0;

// --------------------------
//  GET JWT (Booker token)
// --------------------------
async function getBookerJwt(): Promise<string> {
    if (!TC_KEY) throw new Error("Missing TAXICALLER_API_KEY");

    const now = Math.floor(Date.now() / 1000);

    // Cached JWT still valid?
    if (bookerJwt && now < bookerJwtExp - 60) return bookerJwt;

    const ttl = 900;
    const url = `https://${TC_DOMAIN}/BookerService/v1/jwt/for-key`;
    const params = { key: TC_KEY, sub: TC_SUB, ttl };

    const { data } = await axios.get(url, { params });

    if (!data?.token) throw new Error("Failed to get Booker JWT");

    const token = data.token;
    bookerJwt = token;

    try {
        const payload = JSON.parse(
            Buffer.from(token.split(".")[1], "base64").toString("utf8")
        );
        bookerJwtExp = payload.exp || now + 840;
    } catch {
        bookerJwtExp = now + 840;
    }

    return token;
}

// ===============================
//    /api/taxicaller-live
// ===============================
export async function GET(_req: NextRequest) {
    void _req; // NextRequest available if needed
    try {
        const jwt = await getBookerJwt();

        const url = `https://${TC_DOMAIN}/api/v1/booker/vehicle/list`;

        const params = {
            company_id: TC_COMPANY_ID,
            limit: 200
        };

        const { data } = await axios.get(url, {
            params,
            headers: { Authorization: `Bearer ${jwt}` }
        });

        const list = Array.isArray(data?.list) ? data.list : [];

        interface TCVehicleItem {
            id?: string | number;
            driver?: { name?: string };
            status?: string;
            lat?: number;
            lng?: number;
            heading?: number;
            vehicle?: string;
        }

        const vehicles = (list as TCVehicleItem[]).map((v) => ({
            id: v.id,
            driver: v.driver?.name || "Unknown",
            status: v.status || "",
            lat: v.lat ? v.lat / 1e6 : null,
            lng: v.lng ? v.lng / 1e6 : null,
            heading: v.heading || 0,
            vehicle: v.vehicle || "",
        }));

        return NextResponse.json({ success: true, vehicles });
    } catch (err: unknown) {
        console.error("Live vehicle API error:", err);
        const errorMessage = err instanceof Error ? err.message : "Failed to load live vehicles";
        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500 }
        );
    }
}
