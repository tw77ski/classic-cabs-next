// =============================================================================
// Frontend API Layer - TaxiCaller External API
// Simplified to match External API requirements
// =============================================================================

// =============================================================================
// Types
// =============================================================================

interface Location {
  address: string;
  lat: number | null;
  lng: number | null;
}

interface LocationInput {
  lat?: number;
  lng?: number;
}

interface EstimateRequest {
  pickup: Location;
  dropoff: Location;
  stops?: Location[];
  passengers: number;
  luggage: number;
  when: {
    type: "asap" | "scheduled";
    time?: string;
  };
  vehicleType?: string;
}

interface BookingRequest extends EstimateRequest {
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

interface EstimateResponse {
  success: boolean;
  distance?: number;
  duration?: number;
  estimated_amount?: number;
  currency?: string;
  error?: string;
}

interface BookingResponse {
  success: boolean;
  booking_id?: string;           // Primary ID - hex order_id for API operations
  job_id?: number;               // Display ID - numeric job_id shown in TaxiCaller dispatch
  return_booking_id?: string;    // For return trip bookings
  status?: string;
  message?: string;
  error?: string;
}

interface StatusResponse {
  success: boolean;
  booking_id?: string;
  status?: string;
  driver?: {
    name?: string;
    phone?: string;
    vehicle_reg?: string;
    vehicle_model?: string;
    eta_minutes?: number;
    location?: {
      latitude: number;
      longitude: number;
    };
  };
  error?: string;
}

interface CancelResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// =============================================================================
// Address Search (Mapbox)
// =============================================================================

export async function searchAddress(query: string) {
  if (!query || query.length < 2) return [];

  try {
    const res = await fetch("/api/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: query }),
    });

    if (!res.ok) return [];

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Geocoding error:", error);
    return [];
  }
}

// =============================================================================
// Get Fare Estimate
// =============================================================================

export async function getEstimate(request: EstimateRequest): Promise<EstimateResponse> {
  const payload = {
    pickup: {
      lat: request.pickup.lat,
      lng: request.pickup.lng,
      address: request.pickup.address,
    },
    dropoff: {
      lat: request.dropoff.lat,
      lng: request.dropoff.lng,
      address: request.dropoff.address,
    },
    passengers: request.passengers,
    when: request.when,
  };

  try {
    const res = await fetch("/api/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return await res.json();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to get estimate";
    return {
      success: false,
      error: errorMessage,
    };
  }
}

// =============================================================================
// Create Booking
// =============================================================================

export async function createBooking(request: BookingRequest): Promise<BookingResponse> {
  // Build payload for External API
  const payload = {
    pickup: {
      lat: request.pickup.lat,
      lng: request.pickup.lng,
      address: request.pickup.address,
      locationType: "address",
    },
    dropoff: {
      lat: request.dropoff.lat,
      lng: request.dropoff.lng,
      address: request.dropoff.address,
      locationType: "address",
    },
    // Filter valid stops and include locationType for TaxiCaller compatibility
    stops: request.stops?.filter(s => s.lat && s.lng).map(s => ({
      lat: s.lat,
      lng: s.lng,
      address: s.address,
      locationType: "address",
    })) || [],
    passengers: request.passengers,
    luggage: request.luggage,
    when: request.when,
    return_trip: request.return_trip,
    return_time: request.return_time,
    rider: request.rider,
    vehicle_type: request.vehicleType,
    notes: request.notes,
    flightNumber: request.flightNumber,
    airportPickup: request.airportPickup,
    airportNotes: request.airportNotes,
  };

  try {
    const res = await fetch("/api/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    
    // Map API response to BookingResponse
    // booking_id = hex order_id (needed for TaxiCaller API operations like cancel/amend)
    // job_id = numeric ID shown in TaxiCaller dispatch
    return {
      success: data.ok === true,
      booking_id: data.order_id || data.booking_id,  // Hex order_id for API calls
      job_id: data.job_id,  // Numeric job_id for display
      return_booking_id: data.return_order_id,
      status: data.ok ? "confirmed" : "failed",
      message: data.ok ? "Booking confirmed" : data.error,
      error: data.error,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to create booking";
    return {
      success: false,
      error: errorMessage,
    };
  }
}

// =============================================================================
// Get Booking Status
// =============================================================================

export async function getBookingStatus(bookingId: string): Promise<StatusResponse> {
  try {
    const res = await fetch(`/api/status?bookingId=${encodeURIComponent(bookingId)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    return await res.json();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to get booking status";
    return {
      success: false,
      error: errorMessage,
    };
  }
}

// =============================================================================
// Cancel Booking
// =============================================================================

export async function cancelBooking(bookingId: string): Promise<CancelResponse> {
  try {
    const res = await fetch("/api/cancel", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId }),
    });

    return await res.json();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to cancel booking";
    return {
      success: false,
      error: errorMessage,
    };
  }
}

// =============================================================================
// Legacy Functions (Backwards Compatibility)
// =============================================================================

interface LegacyBookingBody {
  pickupAddress?: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoffAddress?: string;
  dropoffLat?: number;
  dropoffLng?: number;
  stops?: LocationInput[];
  seats?: number;
  bags?: number;
  asap?: boolean;
  pickupTimeUnix?: number;
  vehicleType?: string;
  passengerName?: string;
  passengerPhone?: string;
  passengerEmail?: string;
  returnTrip?: boolean;
}

export async function checkFareRequest(body: LegacyBookingBody) {
  return getEstimate({
    pickup: { address: body.pickupAddress || "", lat: body.pickupLat ?? null, lng: body.pickupLng ?? null },
    dropoff: { address: body.dropoffAddress || "", lat: body.dropoffLat ?? null, lng: body.dropoffLng ?? null },
    stops: (body.stops || []).map(s => ({ address: "", lat: s.lat ?? null, lng: s.lng ?? null })),
    passengers: body.seats || 1,
    luggage: body.bags || 0,
    when: {
      type: body.asap ? "asap" : "scheduled",
      time: body.pickupTimeUnix ? new Date(body.pickupTimeUnix * 1000).toISOString() : undefined,
    },
    vehicleType: body.vehicleType || "standard",
  });
}

export async function bookRideRequest(body: LegacyBookingBody) {
  return createBooking({
    pickup: { address: body.pickupAddress || "", lat: body.pickupLat ?? null, lng: body.pickupLng ?? null },
    dropoff: { address: body.dropoffAddress || "", lat: body.dropoffLat ?? null, lng: body.dropoffLng ?? null },
    stops: (body.stops || []).map(s => ({ address: "", lat: s.lat ?? null, lng: s.lng ?? null })),
    passengers: body.seats || 1,
    luggage: body.bags || 0,
    when: {
      type: body.asap ? "asap" : "scheduled",
      time: body.pickupTimeUnix ? new Date(body.pickupTimeUnix * 1000).toISOString() : undefined,
    },
    return_trip: body.returnTrip || false,
    rider: {
      name: body.passengerName || "",
      phone: body.passengerPhone || "",
      email: body.passengerEmail || "",
    },
    vehicleType: body.vehicleType || "standard",
  });
}

// Type exports for backwards compatibility
export type { CancelResponse as CancelBookingResult };
