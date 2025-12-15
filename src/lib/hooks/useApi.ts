// SWR hooks for API calls with caching
import useSWR, { SWRConfiguration } from "swr";
import useSWRMutation from "swr/mutation";

// Default fetcher
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error("An error occurred while fetching data.");
    throw error;
  }
  return res.json();
};

// POST fetcher
const postFetcher = async (url: string, { arg }: { arg: unknown }) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });
  return res.json();
};

// Default SWR config for the app
export const swrConfig: SWRConfiguration = {
  revalidateOnFocus: false, // Don't refetch when window regains focus
  revalidateOnReconnect: true, // Refetch when coming back online
  dedupingInterval: 5000, // Dedupe requests within 5 seconds
  errorRetryCount: 3,
  errorRetryInterval: 1000,
  shouldRetryOnError: true,
};

// =============================================================================
// Address Search with caching
// =============================================================================
export function useAddressSearch(query: string) {
  const shouldFetch = query && query.length >= 2;
  
  return useSWR(
    shouldFetch ? `/api/geocode?q=${encodeURIComponent(query)}` : null,
    async (url) => {
      const res = await fetch(url.replace("/api/geocode?q=", "/api/geocode"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: query }),
      });
      return res.json();
    },
    {
      ...swrConfig,
      dedupingInterval: 30000, // Cache address searches for 30 seconds
      revalidateOnFocus: false,
    }
  );
}

// =============================================================================
// Route calculation with caching
// =============================================================================
interface RouteParams {
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
  stops?: { lat: number; lng: number }[];
}

export function useRoute(params: RouteParams | null) {
  const cacheKey = params
    ? `route-${params.pickup.lat}-${params.pickup.lng}-${params.dropoff.lat}-${params.dropoff.lng}-${params.stops?.length || 0}`
    : null;

  return useSWR(
    cacheKey,
    async () => {
      if (!params) return null;
      
      const res = await fetch("/api/route-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      return res.json();
    },
    {
      ...swrConfig,
      dedupingInterval: 60000, // Cache routes for 1 minute
    }
  );
}

// =============================================================================
// Corporate history with caching
// =============================================================================
export function useCorporateHistory(accountId: string, from: string, to: string) {
  return useSWR(
    accountId ? `/api/corporate-history?accountId=${accountId}&from=${from}&to=${to}` : null,
    fetcher,
    {
      ...swrConfig,
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Cache for 1 minute
    }
  );
}

// =============================================================================
// Corporate session
// =============================================================================
export function useCorporateSession() {
  return useSWR("/api/corporate/auth/session", fetcher, {
    ...swrConfig,
    revalidateOnFocus: true,
    dedupingInterval: 10000, // Check session every 10 seconds max
  });
}

// =============================================================================
// Booking mutations (no caching, but with optimistic updates)
// =============================================================================
export function useCreateBooking() {
  return useSWRMutation("/api/book", postFetcher);
}

export function useCancelBooking() {
  return useSWRMutation("/api/cancel", async (url, { arg }: { arg: { bookingId: string } }) => {
    const res = await fetch(url, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(arg),
    });
    return res.json();
  });
}

// =============================================================================
// Popular locations (static, cache forever)
// =============================================================================
export function usePopularLocations() {
  return useSWR(
    "popular-locations",
    async () => {
      // This could fetch from API, but we use static data
      const { POPULAR_LOCATIONS } = await import("@/lib/popular-locations");
      return POPULAR_LOCATIONS;
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      dedupingInterval: Infinity,
    }
  );
}

// =============================================================================
// Online status hook
// =============================================================================
export function useOnlineStatus() {
  return useSWR(
    "online-status",
    () => navigator.onLine,
    {
      refreshInterval: 5000, // Check every 5 seconds
      revalidateOnFocus: true,
    }
  );
}

