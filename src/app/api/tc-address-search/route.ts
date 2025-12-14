import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const TC_DOMAIN =
process.env.TAXICALLER_API_DOMAIN || 'api-rc.taxicaller.net';
const ADMIN_JWT_HOST =
process.env.TAXICALLER_ADMIN_HOST || 'api.taxicaller.net';
const TC_KEY = process.env.TAXICALLER_API_KEY;
const TC_COMPANY_ID = Number(process.env.TAXICALLER_COMPANY_ID);
const TC_SUB = process.env.TAXICALLER_SUB || '*';

if (!TC_KEY || !TC_COMPANY_ID) {
    console.error(
        '[TaxiCaller] Missing TAXICALLER_API_KEY or TAXICALLER_COMPANY_ID in .env.local'
    );
}

// --- Admin JWT cache (same pattern as other routes) ---

let adminJwt: string | null = null;
let adminJwtExp = 0;

async function getAdminJwt(): Promise<string> {
    if (!TC_KEY) throw new Error('TAXICALLER_API_KEY not configured');

    const now = Math.floor(Date.now() / 1000);
    if (adminJwt && now < adminJwtExp - 60) return adminJwt;

    const ttl = 900;
    const url = `https://${ADMIN_JWT_HOST}/AdminService/v1/jwt/for-key`;
    const params = { key: TC_KEY, sub: TC_SUB, ttl };

    const { data } = await axios.get(url, { params });
    if (!data || !data.token) throw new Error('Failed to obtain Admin JWT');

    const token = data.token;
    adminJwt = token;

    try {
        const payloadJson = Buffer.from(token.split('.')[1], 'base64').toString(
            'utf8'
        );
        const payload = JSON.parse(payloadJson);
        adminJwtExp = payload.exp || now + 840;
    } catch {
        adminJwtExp = now + 840;
    }

    return token;
}

// GET /api/tc-address-search?q=...

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const q = (searchParams.get('q') || '').trim();

        if (!q || q.length < 3) {
            return NextResponse.json(
                { success: true, suggestions: [] },
                { status: 200 }
            );
        }

        const jwt = await getAdminJwt();

        // ⚠️ TODO with Juliana:
        // Ask TaxiCaller support which endpoint to use for address / POI search.
        //
        // Examples they might give you:
        //   /api/v1/company/{company_id}/place/search
        //   /api/v1/company/{company_id}/poi/search
        //   /api/v1/booker/geodata/search
        //
        // When you know the correct path, update ONLY this line:
        const url = `https://${TC_DOMAIN}/api/v1/company/${TC_COMPANY_ID}/place/list`;

        interface TCAddressSearchResponse {
          list?: TCAddressItem[];
          [key: string]: unknown;
        }
        interface TCAddressItem {
          id?: string | number;
          place_id?: string | number;
          poi_id?: string | number;
          name?: string;
          cname?: string;
          address?: string;
          label?: string;
          lat?: number;
          latitude?: number;
          lng?: number;
          longitude?: number;
        }
        interface AxiosErrorLike {
          response?: { status?: number; data?: unknown };
          message?: string;
        }
        
        let data: TCAddressSearchResponse | TCAddressItem[];
        try {
            const resp = await axios.get(url, {
                headers: { Authorization: `Bearer ${jwt}` },
                // If TaxiCaller requires ?data=..., you'll put it here:
                // params: { data: JSON.stringify({ query: q, ... }) },
            });
            data = resp.data;
        } catch (err: unknown) {
            const axiosErr = err as AxiosErrorLike;
            const status = axiosErr?.response?.status;
            // If TaxiCaller says 404 Not Found for this path,
            // we just return an empty suggestion list (no 500 in Next.js).
            if (status === 404) {
                console.warn('[TaxiCaller] Address search endpoint 404. Check API path.');
                return NextResponse.json(
                    { success: true, suggestions: [] },
                    { status: 200 }
                );
            }
            console.error('TaxiCaller address search error', axiosErr?.response?.data || err);
            throw err;
        }

        // Try to normalise TaxiCaller response to a simple array
        const rawList: TCAddressItem[] = Array.isArray((data as TCAddressSearchResponse)?.list)
        ? (data as TCAddressSearchResponse).list!
        : Array.isArray(data)
        ? (data as TCAddressItem[])
        : [];

        // Filter on 'q'
        const filtered = rawList.filter((item) => {
            const label = (
                item.name ||
                item.cname ||
                item.address ||
                item.label ||
                ''
            ).toString();
            return label.toLowerCase().includes(q.toLowerCase());
        });

        // Map to light suggestions – we can include coords if available
        const suggestions = filtered.slice(0, 10).map((item) => ({
            id: item.id ?? item.place_id ?? item.poi_id ?? null,
            label:
            item.cname ||
            item.name ||
            item.address ||
            item.label ||
            'Unnamed',
            lat: item.lat ?? item.latitude ?? null,
            lng: item.lng ?? item.longitude ?? null,
        }));

        return NextResponse.json(
            { success: true, suggestions },
            { status: 200 }
        );
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        console.error('TaxiCaller address search outer error', errorMessage);
        // Fallback: never break the UI, just return no suggestions
        return NextResponse.json(
            { success: true, suggestions: [] },
            { status: 200 }
        );
    }
}
