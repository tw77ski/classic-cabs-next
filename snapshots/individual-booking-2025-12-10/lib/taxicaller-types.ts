// =============================================================================
// TaxiCaller External API Types
// Documentation: https://app.taxicaller.net/documentation/api/
// =============================================================================

// =============================================================================
// Common Types
// =============================================================================

export interface Location {
  address: string;
  latitude: number;
  longitude: number;
}

export interface LocationCoords {
  latitude: number;
  longitude: number;
}

// =============================================================================
// TaxiCaller Internal API Types (for Booker API)
// =============================================================================

export interface TaxiCallerCoords {
  name: string;
  coords: [number, number]; // [lng * 1e6, lat * 1e6]
}

export interface TaxiCallerAction {
  "@type": "client_action";
  item_seq: number;
  action: "in" | "out";
}

export interface TaxiCallerRouteNode {
  actions: TaxiCallerAction[];
  location: TaxiCallerCoords;
  times: {
    arrive: {
      target: number;
      latest: number;
    };
  } | null;
  info: {
    all?: string;
  };
  seq: number;
}

export interface TaxiCallerRouteLeg {
  meta: {
    dist: number;
    est_dur: number;
  };
  pts: number[];
  from_seq: number;
  to_seq: number;
}

export interface TaxiCallerPassenger {
  "@type": "passengers";
  seq: number;
  passenger: {
    name: string;
    phone: string;
    email: string;
  };
  client_id: number | null;
  account: { id: number; extra: null } | null;
  require: {
    seats: number;
    wc: number;
    bags: number;
  };
  pay_info: Array<{ "@t": number; data: null }>;
  custom_fields?: Record<string, string>;
}

export interface TaxiCallerOrder {
  company_id: number;
  provider_id: number;
  items: TaxiCallerPassenger[];
  route: {
    nodes: TaxiCallerRouteNode[];
    legs: TaxiCallerRouteLeg[];
    meta: {
      dist: number;
      est_dur: number;
    };
  };
}

export interface TaxiCallerBookerPayload {
  order: TaxiCallerOrder;
}

// =============================================================================
// TaxiCaller API Response Types
// =============================================================================

export interface TaxiCallerOrderResponse {
  order_token?: string;
  order_id?: string;
  id?: string;
  orderId?: string;
  booking_id?: string;
  meta?: {
    job_id?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface TaxiCallerErrorItem {
  err_msg?: string;
  message?: string;
  field?: string;
  [key: string]: unknown;
}

export interface TaxiCallerErrorResponse {
  message?: string;
  error?: string;
  errors?: TaxiCallerErrorItem[];
  [key: string]: unknown;
}

export interface TaxiCallerVehicle {
  id: string | number;
  name?: string;
  reg?: string;
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  heading?: number;
  status?: string;
  driver?: {
    name?: string;
    phone?: string;
  };
}

export interface TaxiCallerVehiclesResponse {
  vehicles?: TaxiCallerVehicle[];
  data?: TaxiCallerVehicle[];
  [key: string]: unknown;
}

export interface TaxiCallerJob {
  id: string | number;
  order_id?: string;
  status?: string;
  pickup?: {
    address?: string;
    lat?: number;
    lng?: number;
  };
  dropoff?: {
    address?: string;
    lat?: number;
    lng?: number;
  };
  driver?: {
    name?: string;
    phone?: string;
    vehicle?: string;
  };
  eta?: number;
  fare?: number;
  created?: string;
  pickup_time?: string;
  [key: string]: unknown;
}

export interface TaxiCallerJobsResponse {
  jobs?: TaxiCallerJob[];
  data?: TaxiCallerJob[];
  [key: string]: unknown;
}

export interface TaxiCallerAccountsResponse {
  accounts?: TaxiCallerAccount[];
  data?: TaxiCallerAccount[];
  [key: string]: unknown;
}

export interface TaxiCallerAccount {
  id: number;
  name: string;
  code?: string;
  email?: string;
  phone?: string;
  balance?: number;
  [key: string]: unknown;
}

export interface TaxiCallerHistoryJob {
  id: string | number;
  ref?: string;
  pickup_time?: string;
  from?: string;
  to?: string;
  fare?: number;
  status?: string;
  [key: string]: unknown;
}

export interface TaxiCallerHistoryResponse {
  success?: boolean;
  jobs?: TaxiCallerHistoryJob[];
  from?: string;
  to?: string;
  [key: string]: unknown;
}

// =============================================================================
// Geocoding Types
// =============================================================================

export interface GeocodeSuggestion {
  address: string;
  lat: number;
  lng: number;
  place_id?: string;
  type?: string;
  [key: string]: unknown;
}

export interface GeocodeResponse {
  suggestions?: GeocodeSuggestion[];
  results?: GeocodeSuggestion[];
  [key: string]: unknown;
}

export interface MapboxFeature {
  id?: string;
  place_name?: string;
  center?: [number, number];
  geometry?: {
    type: string;
    coordinates: [number, number];
  };
  properties?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface MapboxResponse {
  features?: MapboxFeature[];
  [key: string]: unknown;
}

// =============================================================================
// Route/Directions Types
// =============================================================================

export interface RouteGeometry {
  type: "LineString";
  coordinates: Array<[number, number]>;
}

export interface RouteResponse {
  routes?: Array<{
    geometry?: RouteGeometry | string;
    distance?: number;
    duration?: number;
    legs?: Array<{
      distance?: number;
      duration?: number;
    }>;
  }>;
  [key: string]: unknown;
}

// =============================================================================
// Estimate Types
// =============================================================================

export interface EstimateRequest {
  company_id: number;
  pickup: LocationCoords;
  dropoff: LocationCoords;
  num_passengers?: number;
}

export interface EstimateResponse {
  success: boolean;
  distance?: number;        // meters
  duration?: number;        // seconds
  estimated_amount?: number;
  currency?: string;
  error?: string;
}

// =============================================================================
// Booking Types
// =============================================================================

export interface BookingWhen {
  type: "asap" | "scheduled";
  time?: string; // ISO8601 for scheduled bookings
}

export interface BookingRequest {
  company_id: number;
  pickup: Location;
  dropoff: Location;
  num_passengers: number;
  customer_name: string;
  phone: string;
  email?: string;
  notes?: string;
  when: BookingWhen;
}

export interface BookingResponse {
  success: boolean;
  booking_id?: string;
  status?: string;
  message?: string;
  error?: string;
  raw?: unknown;
}

// =============================================================================
// Booking Status Types
// =============================================================================

export interface DriverInfo {
  name?: string;
  phone?: string;
  vehicle_reg?: string;
  vehicle_model?: string;
  eta_minutes?: number;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface BookingStatusResponse {
  success: boolean;
  booking_id?: string;
  status?: "pending" | "assigned" | "on_the_way" | "arrived" | "in_progress" | "completed" | "cancelled" | string;
  driver?: DriverInfo;
  pickup?: Location;
  dropoff?: Location;
  error?: string;
}

// =============================================================================
// Cancel Types
// =============================================================================

export interface CancelRequest {
  company_id: number;
}

export interface CancelResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// =============================================================================
// Frontend Types (for form submission)
// =============================================================================

export interface FrontendLocation {
  address: string;
  lat: number | null;
  lng: number | null;
}

export interface FrontendBookingRequest {
  pickup: FrontendLocation;
  dropoff: FrontendLocation;
  stops?: FrontendLocation[];
  passengers: number;
  luggage: number;
  when: {
    type: "asap" | "scheduled";
    time?: string;
  };
  return_trip: boolean;
  return_time?: string;
  rider: {
    name: string;
    phone: string;
    email: string;
  };
  vehicleType?: string;
  notes?: string;
  flightNumber?: string;
  airportPickup?: boolean;
  airportNotes?: string;
}

// =============================================================================
// API Route Request Body Types
// =============================================================================

export interface BookingRequestBody {
  pickup?: {
    address?: string;
    lat?: number;
    lng?: number;
    latitude?: number;
    longitude?: number;
  };
  dropoff?: {
    address?: string;
    lat?: number;
    lng?: number;
    latitude?: number;
    longitude?: number;
  };
  stops?: Array<{
    address?: string;
    lat?: number;
    lng?: number;
    latitude?: number;
    longitude?: number;
  }>;
  passengers?: number;
  luggage?: number;
  rider?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  customer?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  when?: {
    type?: string;
    time?: string;
  };
  asap?: boolean;
  vehicle_type?: string;
  vehicleType?: string;
  flightNumber?: string;
  airportPickup?: boolean;
  notes?: string;
  return_trip?: boolean;
  return_time?: string;
}

export interface CorporateBookingRequestBody extends BookingRequestBody {
  companyName?: string;
  contactPerson?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  time?: string;
  accountId?: string | number;
}

export interface GeocodeRequestBody {
  address?: string;
  query?: string;
  lat?: number;
  lng?: number;
}

export interface StatusRequestBody {
  bookingId?: string | number;
  order_id?: string;
}

export interface CancelRequestBody {
  orderId?: string;
  order_id?: string;
  bookingId?: string | number;
  reason?: string;
}

export interface EstimateRequestBody {
  pickup?: {
    lat?: number;
    lng?: number;
  };
  dropoff?: {
    lat?: number;
    lng?: number;
  };
  stops?: Array<{
    lat?: number;
    lng?: number;
  }>;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build notes string from various booking details
 */
export function buildBookingNotes(request: FrontendBookingRequest): string {
  const parts: string[] = [];

  // Vehicle type
  if (request.vehicleType === "luxury") {
    parts.push("🚗 EXECUTIVE SERVICE – Premium V-Class");
  }

  // Flight info
  if (request.flightNumber) {
    parts.push(`✈️ Flight: ${request.flightNumber}`);
  }

  // Airport pickup
  if (request.airportPickup) {
    parts.push("📍 Airport Pickup");
    if (request.airportNotes) {
      parts.push(`   ${request.airportNotes}`);
    }
  }

  // Return trip
  if (request.return_trip && request.return_time) {
    const returnDate = new Date(request.return_time);
    const formatted = returnDate.toLocaleString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    parts.push(`🔄 Return Pickup: ${formatted}`);
  }

  // Luggage
  if (request.luggage > 0) {
    parts.push(`🧳 Luggage: ${request.luggage} bag${request.luggage > 1 ? "s" : ""}`);
  }

  // Stops
  if (request.stops && request.stops.length > 0) {
    const validStops = request.stops.filter(s => s.lat && s.lng);
    if (validStops.length > 0) {
      parts.push(`📍 Stops: ${validStops.map(s => s.address).join(" → ")}`);
    }
  }

  // User notes
  if (request.notes) {
    parts.push(`📝 Notes: ${request.notes}`);
  }

  return parts.join("\n");
}

/**
 * Normalize phone number to E.164 format
 */
export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, "");
  if (!cleaned.startsWith("+")) {
    // Assume UK if no prefix
    if (cleaned.startsWith("0")) {
      cleaned = "+44" + cleaned.substring(1);
    } else {
      cleaned = "+" + cleaned;
    }
  }
  return cleaned;
}

/**
 * Type guard to check if a value is an Error
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Get error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Unknown error";
}

/**
 * Type guard for network errors
 */
export function isNetworkError(error: unknown): error is Error & { code?: string; name?: string } {
  return isError(error);
}
