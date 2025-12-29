// Corporate Dashboard API
// GET /api/corporate/dashboard
// Returns real stats and bookings from TaxiCaller for the logged-in company

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const TC_DOMAIN = process.env.TAXICALLER_API_DOMAIN || 'api-rc.taxicaller.net';
const TC_COMPANY_ID = Number(process.env.TAXICALLER_COMPANY_ID) || 8284;

// Get JWT token
async function getJwt(): Promise<string> {
  const jwt = process.env.TAXICALLER_DEV_JWT || process.env.TAXICALLER_JWT;
  if (!jwt) throw new Error('TaxiCaller JWT not configured');
  return jwt;
}

// Fetch jobs for an account within a date range
async function fetchAccountJobs(accountId: number, from: Date, to: Date) {
  try {
    const jwt = await getJwt();
    
    // Try the reports endpoint
    const reportsUrl = `https://${TC_DOMAIN}/api/v1/reports/typed/generate`;
    const reportPayload = {
      company_id: TC_COMPANY_ID,
      report_type: 'jobs',
      output_format: 'json',
      template_id: 4,
      search_query: {
        period: {
          '@type': 'custom',
          start: from.toISOString().split('.')[0],
          end: to.toISOString().split('.')[0],
        },
        account_id: accountId,
      },
    };

    const response = await fetch(reportsUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reportPayload),
    });

    if (response.ok) {
      const data = await response.json();
      return data.rows || [];
    }
    
    // Return empty if API fails
    return [];
  } catch (error) {
    console.error('[Dashboard API] Error fetching jobs:', error);
    return [];
  }
}

// Parse job data from API response
interface RawJob {
  job_id?: string | number;
  order_id?: string;
  reference?: string;
  start?: string;
  'pick-up'?: string;
  drop_off?: string;
  payable?: string;
  status?: string;
  passenger_name?: string;
}

interface ParsedJob {
  id: string;
  ref: string;
  passenger: string;
  pickup: string;
  dropoff: string;
  time: string;
  fare: number;
  status: string;
}

function parseJobs(rawJobs: RawJob[]): ParsedJob[] {
  return rawJobs.map((j) => ({
    id: String(j.job_id || j.order_id || ''),
    ref: j.reference || String(j.job_id || ''),
    passenger: j.passenger_name || 'Unknown',
    pickup: j['pick-up'] || '',
    dropoff: j.drop_off || '',
    time: j.start || '',
    fare: parseFloat(j.payable || '0'),
    status: j.status || 'completed',
  }));
}

// Format relative time
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    const hours = date.getHours().toString().padStart(2, '0');
    const mins = date.getMinutes().toString().padStart(2, '0');
    return `Today ${hours}:${mins}`;
  } else if (diffDays === 1) {
    const hours = date.getHours().toString().padStart(2, '0');
    const mins = date.getMinutes().toString().padStart(2, '0');
    return `Tomorrow ${hours}:${mins}`;
  } else if (diffDays === -1) {
    return 'Yesterday';
  } else if (diffDays > 1 && diffDays <= 7) {
    return date.toLocaleDateString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  } else {
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }
}

export async function GET() {
  try {
    // Get Auth.js session
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const accountId = (session.user as any).taxiCallerCompanyId || TC_COMPANY_ID;
    
    // Calculate date ranges
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    
    // Fetch this month's jobs
    const thisMonthJobs = await fetchAccountJobs(accountId, thisMonthStart, now);
    const parsedThisMonth = parseJobs(thisMonthJobs);
    
    // Fetch last month's jobs
    const lastMonthJobs = await fetchAccountJobs(accountId, lastMonthStart, lastMonthEnd);
    const parsedLastMonth = parseJobs(lastMonthJobs);
    
    // Calculate stats
    const thisMonthTotal = parsedThisMonth.reduce((sum, j) => sum + j.fare, 0);
    const lastMonthTotal = parsedLastMonth.reduce((sum, j) => sum + j.fare, 0);
    
    // Get recent completed bookings (last 5)
    const recentBookings = parsedThisMonth
      .filter(j => j.status === 'completed' || !j.status)
      .slice(0, 5)
      .map(j => ({
        id: j.id,
        passenger: j.passenger,
        pickup: j.pickup,
        dropoff: j.dropoff,
        time: formatRelativeTime(j.time),
        status: 'completed',
      }));
    
    // Get upcoming bookings (future dates)
    const upcomingBookings = parsedThisMonth
      .filter(j => new Date(j.time) > now)
      .slice(0, 5)
      .map(j => ({
        id: j.id,
        passenger: j.passenger,
        pickup: j.pickup,
        dropoff: j.dropoff,
        time: formatRelativeTime(j.time),
      }));

    return NextResponse.json({
      success: true,
      stats: {
        thisMonth: {
          totalJobs: parsedThisMonth.length,
          totalSpend: thisMonthTotal,
        },
        lastMonth: {
          totalJobs: parsedLastMonth.length,
          totalSpend: lastMonthTotal,
        },
      },
      recentBookings,
      upcomingBookings,
      company: {
        name: session.user.name || 'Corporate',
        accountId,
      },
    });
  } catch (error) {
    console.error('[Dashboard API] Error:', error);
    
    // Return mock data as fallback
    return NextResponse.json({
      success: true,
      stats: {
        thisMonth: { totalJobs: 0, totalSpend: 0 },
        lastMonth: { totalJobs: 0, totalSpend: 0 },
      },
      recentBookings: [],
      upcomingBookings: [],
      note: 'Using fallback data - API unavailable',
    });
  }
}






