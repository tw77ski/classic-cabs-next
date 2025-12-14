import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

// ---- TaxiCaller env ----
const TC_DOMAIN =
process.env.TAXICALLER_API_DOMAIN || 'api-rc.taxicaller.net';
const ADMIN_JWT_HOST =
process.env.TAXICALLER_ADMIN_HOST || 'api.taxicaller.net';
const TC_KEY = process.env.TAXICALLER_API_KEY;
const TC_COMPANY_ID = Number(process.env.TAXICALLER_COMPANY_ID);
const TC_SUB = process.env.TAXICALLER_SUB || '*';

const CORPORATE_DEFAULT_ACCOUNT_ID =
process.env.CORPORATE_DEFAULT_ACCOUNT_ID || '';

if (!TC_KEY || !TC_COMPANY_ID) {
    console.error(
        '[TaxiCaller] Missing TAXICALLER_API_KEY or TAXICALLER_COMPANY_ID in .env.local'
    );
}

// ---- Admin JWT cache ----
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

    const token: string = data.token;
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

async function getBookerToken(): Promise<string> {
    const jwt = await getAdminJwt();
    const url = `https://${TC_DOMAIN}/api/v1/booker/booker-token`;
    const data = { creds: { company_id: TC_COMPANY_ID, ops: 3 } };

    const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${jwt}` },
        params: { data: JSON.stringify(data) },
    });

    if (!res.data || !res.data.token)
        throw new Error('Failed to obtain booker token');
    return res.data.token;
}

// ---- Helpers for nodes ----

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
        typeof lat === 'number' &&
        typeof lng === 'number' &&
        !Number.isNaN(lat) &&
        !Number.isNaN(lng)
    ) {
        return { name, lat, lng };
    }
    return { name, ...jerseyFallback };
}

/**
 * buildRouteNodes:
 *  - node 0: pickup, action "in"
 *  - middle nodes: each stop name, action "out"
 *  - last node: final drop-off, action "out"
 */
function buildRouteNodes({
    pickupAddress,
    pickupLat,
    pickupLng,
    dropoffAddress,
    dropoffLat,
    dropoffLng,
    stopNames = [],
    pickupTimeUnix = 0,
    notes = '',
}: {
    pickupAddress: string;
    pickupLat?: number | null;
    pickupLng?: number | null;
    dropoffAddress: string;
    dropoffLat?: number | null;
    dropoffLng?: number | null;
    stopNames?: string[];
    pickupTimeUnix?: number;
    notes?: string;
}) {
    const safeNotes = (notes || '').trim();
    const pickup = normPoint(pickupAddress, pickupLat, pickupLng);
    const dropoff = normPoint(dropoffAddress, dropoffLat, dropoffLng);

    let seq = 0;
    const nodes: any[] = [];

    // Pickup
    nodes.push({
        seq: seq++,
        actions: [{ '@type': 'client_action', item_seq: 0, action: 'in' }],
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

    // Intermediate stops (by name only, coords = Jersey centre fallback)
    (stopNames || [])
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .forEach((stopName) => {
        const p = normPoint(stopName, undefined, undefined);
        nodes.push({
            seq: seq++,
            actions: [{ '@type': 'client_action', item_seq: 0, action: 'out' }],
            location: {
                name: p.name,
                coords: toTC(p.lng, p.lat),
            },
            times: null,
            info: { all: safeNotes },
        });
    });

    // Drop-off
    nodes.push({
        seq: seq++,
        actions: [{ '@type': 'client_action', item_seq: 0, action: 'out' }],
        location: {
            name: dropoff.name,
            coords: toTC(dropoff.lng, dropoff.lat),
        },
        times: null,
        info: { all: safeNotes },
    });

    return nodes;
}

// ---- POST /api/corporate-book ----

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const {
            firstName,
            lastName,
            phone,
            email,

            companyName,
            contactPerson,
            poNumber,
            costCentre, // Cost centre code

            pickupAddress,
            pickupLat,
            pickupLng,

            dropoffAddress,
            dropoffLat,
            dropoffLng,

            time, // ISO string or empty for ASAP
            notes = '',

            accountId, // optional override, else env default

            // NEW: multi-stops (array of strings)
            stops = [],
        } = body || {};

        const effectiveAccountId = String(
            accountId || CORPORATE_DEFAULT_ACCOUNT_ID || ''
        ).trim();

        if (!effectiveAccountId) {
            return NextResponse.json(
                { success: false, error: 'Missing TaxiCaller accountId.' },
                { status: 400 }
            );
        }

        if (!firstName || !lastName || !phone || !pickupAddress || !dropoffAddress) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                    'Missing required fields (name, phone, pickup or drop-off address).',
                },
                { status: 400 }
            );
        }

        const passengerName = `${firstName} ${lastName}`.trim();
        const isAsap = !time;
        const pickupUnix =
        !isAsap && time ? Math.floor(Date.parse(time) / 1000) : 0;

        const baseNotes = (notes || '').trim();
        const corporateLine = [
            companyName && `Company: ${companyName}`,
            contactPerson && `Contact: ${contactPerson}`,
            poNumber && `PO: ${poNumber}`,
            costCentre && `Cost Centre: ${costCentre}`,
            `Account ID: ${effectiveAccountId}`,
        ]
        .filter(Boolean)
        .join(' | ');

        const mergedNotes = [corporateLine, baseNotes].filter(Boolean).join(' • ');

        const bookerJwt = await getBookerToken();

        const stopNames: string[] = Array.isArray(stops)
        ? stops.map((s: any) => String(s || '')).filter(Boolean)
        : [];

        const nodes = buildRouteNodes({
            pickupAddress,
            pickupLat,
            pickupLng,
            dropoffAddress,
            dropoffLat,
            dropoffLng,
            stopNames,
            pickupTimeUnix: pickupUnix,
            notes: mergedNotes,
        });

        const orderPayload = {
            order: {
                company_id: TC_COMPANY_ID,
                provider_id: 0,
                items: [
                    {
                        '@type': 'passengers',
                        seq: 0,
                        passenger: {
                            name: passengerName,
                            phone,
                            email: email || '',
                        },
                        client_id: 0,
                        // associate TaxiCaller customer account
                        account: {
                            id: Number(effectiveAccountId),
                        },
                        require: {
                            seats: 1,
                            wc: 0,
                            bags: 0,
                        },
                        info: { all: mergedNotes },
                        // driver will select "Billed/Account" in app
                        pay_info: [{ '@t': 0, data: null }],
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

        const url = `https://${TC_DOMAIN}/api/v1/booker/order`;
        const { data } = await axios.post(url, orderPayload, {
            headers: { Authorization: `Bearer ${bookerJwt}` },
        });

        // Extract the job_id from meta - this is the ID shown in TaxiCaller dispatch
        const jobId = data.meta?.job_id;
        const orderId = data.order?.order_id;
        
        console.log('📋 Corporate Booking - Job ID:', jobId, '| Order ID:', orderId);

        return NextResponse.json(
            { 
                success: true, 
                booking_id: String(jobId || orderId),
                job_id: jobId,
                internal_order_id: orderId,
                taxiCaller: data 
            },
            { status: 200 }
        );
    } catch (err: any) {
        const status = err?.response?.status;
        const detail = err?.response?.data || err?.message;
        console.error('Corporate booking error:', status, detail);

        return NextResponse.json(
            {
                success: false,
                error:
                (detail && (detail.message || String(detail))) ||
                'Corporate booking failed',
            },
            { status: 500 }
        );
    }
}
