// TaxiCaller API Client
// Handles JWT generation, caching, and API calls
// Never exposes API keys to frontend

interface TaxiCallerJWT {
  token: string;
  expiresAt: number; // Unix timestamp
}

// In-memory cache for JWTs (per company)
const jwtCache = new Map<number, TaxiCallerJWT>();

// JWT cache duration (refresh 2 minutes before expiry)
const JWT_REFRESH_BUFFER = 2 * 60 * 1000; // 2 minutes
const JWT_DEFAULT_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * Get TaxiCaller configuration
 */
function getConfig() {
  const apiKey = process.env.TAXICALLER_API_KEY;
  const apiDomain = process.env.TAXICALLER_API_DOMAIN || "api-rc.taxicaller.net";
  const companyId = process.env.TAXICALLER_COMPANY_ID;

  if (!apiKey) {
    throw new Error("TAXICALLER_API_KEY is not configured");
  }

  return { apiKey, apiDomain, companyId: companyId ? parseInt(companyId) : undefined };
}

/**
 * Get or generate a TaxiCaller JWT for a specific company
 */
export async function getTaxiCallerJWT(companyId?: number): Promise<string> {
  const config = getConfig();
  const cacheKey = companyId || config.companyId || 0;

  // Check cache
  const cached = jwtCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + JWT_REFRESH_BUFFER) {
    return cached.token;
  }

  // Generate new JWT
  console.log(`[TaxiCaller] Generating JWT for company ${cacheKey}...`);

  const response = await fetch(`https://${config.apiDomain}/api/v1/jwt/for-key`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": config.apiKey,
    },
    body: JSON.stringify({
      company_id: cacheKey,
      sub: "*",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[TaxiCaller] JWT generation failed: ${response.status} ${errorText}`);
    throw new Error(`Failed to generate TaxiCaller JWT: ${response.status}`);
  }

  const data = await response.json();
  const token = data.jwt || data.token;

  if (!token) {
    throw new Error("No JWT token in response");
  }

  // Cache the JWT
  jwtCache.set(cacheKey, {
    token,
    expiresAt: Date.now() + JWT_DEFAULT_TTL,
  });

  console.log(`[TaxiCaller] JWT generated and cached for company ${cacheKey}`);
  return token;
}

/**
 * Make an authenticated request to TaxiCaller API
 */
export async function taxiCallerRequest<T = unknown>(
  endpoint: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: Record<string, unknown>;
    companyId?: number;
  } = {}
): Promise<T> {
  const config = getConfig();
  const { method = "GET", body, companyId } = options;

  const jwt = await getTaxiCallerJWT(companyId);

  const url = `https://${config.apiDomain}${endpoint}`;
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[TaxiCaller] API request failed: ${response.status} ${errorText}`);
    throw new Error(`TaxiCaller API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Get jobs/bookings for a company
 */
export async function getCompanyJobs(
  companyId: number,
  options: {
    status?: string;
    from?: string;
    to?: string;
    limit?: number;
  } = {}
) {
  const params = new URLSearchParams();
  if (options.status) params.set("status", options.status);
  if (options.from) params.set("from", options.from);
  if (options.to) params.set("to", options.to);
  if (options.limit) params.set("limit", options.limit.toString());

  const queryString = params.toString();
  const endpoint = `/api/v1/jobs${queryString ? `?${queryString}` : ""}`;

  return taxiCallerRequest(endpoint, { companyId });
}

/**
 * Create a new booking
 */
export async function createBooking(
  companyId: number,
  bookingData: Record<string, unknown>
) {
  return taxiCallerRequest("/api/v1/jobs", {
    method: "POST",
    body: bookingData,
    companyId,
  });
}

/**
 * Cancel a booking
 */
export async function cancelBooking(
  companyId: number,
  jobId: number | string,
  reason?: string
) {
  return taxiCallerRequest(`/api/v1/jobs/${jobId}/cancel`, {
    method: "POST",
    body: { reason },
    companyId,
  });
}

/**
 * Get company accounts (for corporate account list)
 */
export async function getCompanyAccounts(companyId: number) {
  return taxiCallerRequest("/api/v1/accounts", { companyId });
}

/**
 * Get vehicles for a company
 */
export async function getCompanyVehicles(companyId: number) {
  return taxiCallerRequest("/api/v1/vehicles", { companyId });
}

/**
 * Clear JWT cache (useful for testing or forced refresh)
 */
export function clearJWTCache(companyId?: number) {
  if (companyId) {
    jwtCache.delete(companyId);
  } else {
    jwtCache.clear();
  }
}



