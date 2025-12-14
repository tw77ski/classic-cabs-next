// src/app/api/corporate-accounts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

// ---- TaxiCaller env ----
const TC_DOMAIN =
process.env.TAXICALLER_API_DOMAIN || 'api-rc.taxicaller.net';
const ADMIN_JWT_HOST =
process.env.TAXICALLER_ADMIN_HOST || 'api-rc.taxicaller.net';
const TC_KEY = process.env.TAXICALLER_API_KEY;
const TC_COMPANY_ID = Number(process.env.TAXICALLER_COMPANY_ID);
const TC_SUB = process.env.TAXICALLER_SUB || '*';

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

// ---- GET /api/corporate-accounts ----
export async function GET(req: NextRequest) {
    try {
        const jwt = await getAdminJwt();

        const { searchParams } = new URL(req.url);
        const q = (searchParams.get('q') || '').trim().toLowerCase();

        const url = `https://${TC_DOMAIN}/api/v1/company/${TC_COMPANY_ID}/customer/account/list`;

        // This is the call that previously worked and logged:
        // [TC accounts raw] {"list":[{"cname":"inko co.","name":"2511171","id":574252,...}, ...]}
        const { data } = await axios.get(url, {
            headers: { Authorization: `Bearer ${jwt}` },
        });

        console.log('[TC accounts raw]', JSON.stringify(data));

        // TaxiCaller RC: list of accounts is in data.list
        const raw: any[] = Array.isArray((data as any).list)
        ? (data as any).list
        : Array.isArray((data as any).accounts)
        ? (data as any).accounts
        : Array.isArray(data as any)
        ? (data as any)
        : [];

        let accounts = raw
        .map((acc: any) => ({
            id: acc.id, // 574252, 574254, ...
            // cname = company name ("inko co.", "bambola tltd", "The Little, John")
            name:
            (acc.cname && String(acc.cname).trim()) ||
            acc.company ||
            'Unnamed account',
            // "name" field is your internal account code ("2511171", ...)
            code: acc.name ? String(acc.name).trim() : '',
        }))
        .filter(a => a.id != null);

        // Local search filtering by name/code/id
        if (q) {
            accounts = accounts.filter(acc => {
                const haystack = `${acc.name} ${acc.code} ${acc.id}`.toLowerCase();
                return haystack.includes(q);
            });
        }

        return NextResponse.json({ success: true, accounts }, { status: 200 });
    } catch (err: any) {
        const status = err?.response?.status;
        const detail = err?.response?.data || err?.message;
        console.error('Account list error:', status, detail);

        return NextResponse.json(
            {
                success: false,
                error:
                (detail && (detail.message || String(detail))) ||
                'Failed to load accounts',
            },
            { status: 500 }
        );
    }
}
