// =============================================================================
// Booking Request Validation Middleware
// Use this in frontend components before submitting to /api/book
// =============================================================================

export type BookingFormData = {
  pickup: { address: string; lat: number | null; lng: number | null };
  dropoff: { address: string; lat: number | null; lng: number | null };
  passengers: number;
  luggage?: number;
  when: { type: "asap" | "scheduled"; time?: string };
  rider: { name: string; phone: string; email?: string };
  vehicle_type?: string;
  notes?: string;
  flightNumber?: string;
  airportPickup?: boolean;
  airportNotes?: string;
  return_trip?: boolean;
  return_time?: string;
};

export interface ValidationResult {
  ok: boolean;
  errors: Record<string, string>;
}

/**
 * Validate booking form data before submission
 * Returns { ok: true } if valid, or { ok: false, errors: {...} } if invalid
 */
export function validateBookingForm(data: BookingFormData): ValidationResult {
  const errors: Record<string, string> = {};

  // Pickup validation
  if (!data.pickup?.address) {
    errors.pickup = "Pickup address is required";
  } else if (data.pickup.lat == null || data.pickup.lng == null) {
    errors.pickup = "Please select a pickup location from the suggestions";
  }

  // Dropoff validation
  if (!data.dropoff?.address) {
    errors.dropoff = "Dropoff address is required";
  } else if (data.dropoff.lat == null || data.dropoff.lng == null) {
    errors.dropoff = "Please select a dropoff location from the suggestions";
  }

  // Passenger count validation
  if (!data.passengers || data.passengers < 1) {
    errors.passengers = "At least 1 passenger is required";
  } else if (data.passengers > 8) {
    errors.passengers = "Maximum 8 passengers allowed";
  }

  // Rider name validation
  if (!data.rider?.name || data.rider.name.trim().length === 0) {
    errors.name = "Name is required";
  } else if (data.rider.name.trim().length < 2) {
    errors.name = "Name must be at least 2 characters";
  }

  // Phone validation (must start with +)
  if (!data.rider?.phone) {
    errors.phone = "Phone number is required";
  } else {
    const cleanPhone = data.rider.phone.replace(/[\s\-\(\)]/g, "");
    if (!cleanPhone.startsWith("+")) {
      errors.phone = "Phone must include country code (e.g., +44)";
    } else if (cleanPhone.length < 10) {
      errors.phone = "Phone number is too short";
    } else if (cleanPhone.length > 16) {
      errors.phone = "Phone number is too long";
    }
  }

  // When validation
  if (!data.when?.type) {
    errors.when = "Please select ASAP or Schedule";
  }

  // Scheduled time validation
  if (data.when?.type === "scheduled") {
    if (!data.when.time) {
      errors.time = "Scheduled pickup time is required";
    } else {
      const scheduledDate = new Date(data.when.time);
      const now = new Date();
      if (scheduledDate <= now) {
        errors.time = "Scheduled time must be in the future";
      }
    }
  }

  // Return trip time validation
  if (data.return_trip && !data.return_time) {
    errors.return_time = "Return pickup time is required";
  }

  // Email validation (if provided)
  if (data.rider?.email && data.rider.email.trim().length > 0) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.rider.email)) {
      errors.email = "Invalid email format";
    }
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Get the first error message (useful for showing a single alert)
 */
export function getFirstError(result: ValidationResult): string | null {
  if (result.ok) return null;
  const firstKey = Object.keys(result.errors)[0];
  return result.errors[firstKey] || null;
}

/**
 * Check if a specific field has an error
 */
export function hasFieldError(result: ValidationResult, field: string): boolean {
  return !result.ok && field in result.errors;
}




















