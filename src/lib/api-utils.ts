// =============================================================================
// Shared Backend Utilities
// Standardized responses, validation, logging, and error handling
// =============================================================================

import { NextResponse } from "next/server";
import { TaxiCallerErrorItem, getErrorMessage } from "./taxicaller-types";

// =============================================================================
// Environment
// =============================================================================

export const isDev = process.env.NODE_ENV === "development";

// =============================================================================
// Standardized API Response Types
// =============================================================================

export interface ApiSuccessResponse<T = unknown> {
  ok: true;
  data: T;
}

export interface ApiErrorResponse {
  ok: false;
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// =============================================================================
// Response Builders
// =============================================================================

export function successResponse<T>(data: T, status: number = 200) {
  return NextResponse.json<ApiSuccessResponse<T>>(
    { ok: true, data },
    { status }
  );
}

export function errorResponse(
  message: string,
  status: number = 400,
  code?: string,
  details?: unknown
) {
  const errorObj: ApiErrorResponse["error"] = { message };
  if (code) errorObj.code = code;
  if (isDev && details) errorObj.details = details;
  
  const response: ApiErrorResponse = {
    ok: false,
    error: errorObj,
  };
  return NextResponse.json(response, { status });
}

// =============================================================================
// Logging Utilities
// =============================================================================

export function log(message: string, data?: unknown) {
  if (isDev) {
    if (data !== undefined) {
      console.log(message, typeof data === "string" ? data : JSON.stringify(data, null, 2));
    } else {
      console.log(message);
    }
  }
}

export function logError(message: string, data?: unknown) {
  if (isDev) {
    console.error(message, data);
  } else {
    const errorMsg = data ? getErrorMessage(data) : "";
    console.error(message, errorMsg);
  }
}

export function logSection(title: string) {
  if (isDev) {
    console.log("\n" + "═".repeat(60));
    console.log(title);
    console.log("═".repeat(60));
  }
}

export function logSubsection(title: string) {
  if (isDev) {
    console.log("\n" + "─".repeat(60));
    console.log(title);
    console.log("─".repeat(60));
  }
}

// =============================================================================
// Phone Normalization (E.164)
// =============================================================================

export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, "");
  if (!cleaned.startsWith("+")) {
    if (cleaned.startsWith("0")) {
      cleaned = "+44" + cleaned.substring(1);
    } else {
      cleaned = "+" + cleaned;
    }
  }
  return cleaned;
}

// =============================================================================
// Validation Utilities
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateRequired(
  obj: Record<string, unknown>,
  fields: { path: string; name: string }[]
): ValidationResult {
  const errors: string[] = [];

  for (const field of fields) {
    const value = getNestedValue(obj, field.path);
    if (value === undefined || value === null || value === "") {
      errors.push(`${field.name} is required`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

// =============================================================================
// TaxiCaller Error Parsing
// =============================================================================

export function parseTaxiCallerError(status: number, data: unknown, raw: string): string {
  // Check for NullPointerException
  if (raw.includes("NullPointerException")) {
    return "TaxiCaller server error - missing required field in payload";
  }

  // Check for HTML error pages
  if (raw.includes("<html") || raw.includes("<!DOCTYPE")) {
    return "TaxiCaller service unavailable";
  }

  // Type guard for data object
  const dataObj = data && typeof data === "object" ? data as Record<string, unknown> : null;

  // Standard HTTP errors
  switch (status) {
    case 400:
      if (dataObj?.errors && Array.isArray(dataObj.errors)) {
        return (dataObj.errors as TaxiCallerErrorItem[])
          .map((e) => e.message || e.field || String(e))
          .join(", ");
      }
      return (dataObj?.message as string) || (dataObj?.error as string) || "Invalid request data";
    case 401:
      return "Authentication failed - invalid API credentials";
    case 403:
      return "Access denied - insufficient permissions";
    case 404:
      return "TaxiCaller API endpoint not found";
    case 500:
      return "TaxiCaller server error - please try again";
    default:
      return (dataObj?.message as string) || (dataObj?.error as string) || `API error: ${status}`;
  }
}

// =============================================================================
// Location with locationType
// =============================================================================

export interface TaxiCallerLocation {
  address: string;
  latitude: number;
  longitude: number;
  locationType: "address";
}

export function toTaxiCallerLocation(
  address: string,
  lat: number,
  lng: number
): TaxiCallerLocation {
  return {
    address,
    latitude: lat,
    longitude: lng,
    locationType: "address",
  };
}
