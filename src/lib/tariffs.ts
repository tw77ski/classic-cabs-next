// Jersey Taxi Tariff System
// Based on official Jersey taxi fare regulations

export type VehicleType = "standard" | "luxury";

export interface TariffRate {
  initial: number;    // Initial charge in £
  perUnit: number;    // Per unit charge in £
  seconds: number;    // Seconds per unit
}

export interface Tariff {
  name: string;
  active: (date: Date) => boolean;
  rates: {
    prebook: TariffRate;
    flag: TariffRate;
  };
}

export const TARIFFS: Record<string, Tariff> = {
  tariff1: {
    name: "Tariff 1 - Daytime",
    active: (date: Date) => {
      const day = date.getDay();
      const hour = date.getHours();
      // Monday (1) to Saturday (6), 7am to 11pm
      return day >= 1 && day <= 6 && hour >= 7 && hour < 23;
    },
    rates: {
      prebook: { initial: 4.94, perUnit: 0.38, seconds: 51 },
      flag: { initial: 3.95, perUnit: 0.30, seconds: 51 },
    },
  },

  tariff2: {
    name: "Tariff 2 - Evenings & Sundays",
    active: (date: Date) => {
      const day = date.getDay();
      const hour = date.getHours();
      const isSunday = day === 0;
      const isNight = hour < 7 || hour >= 23;
      // Sunday all day, or any day 11pm-7am
      return isSunday || isNight;
    },
    rates: {
      prebook: { initial: 5.06, perUnit: 0.52, seconds: 45 },
      flag: { initial: 4.05, perUnit: 0.42, seconds: 45 },
    },
  },

  tariff3: {
    name: "Tariff 3 - Christmas & New Year",
    active: (date: Date) => {
      const t = date.getTime();
      const year = date.getFullYear();
      // Christmas: 24th Dec 11pm to 26th Dec 7am
      const xmasStart = new Date(year, 11, 24, 23).getTime();
      const xmasEnd = new Date(year, 11, 26, 7).getTime();
      // New Year: 31st Dec 7pm to 2nd Jan 7am
      const newYearStart = new Date(year, 11, 31, 19).getTime();
      const newYearEnd = new Date(year + 1, 0, 2, 7).getTime();
      return (t >= xmasStart && t <= xmasEnd) || (t >= newYearStart && t <= newYearEnd);
    },
    rates: {
      prebook: { initial: 8.69, perUnit: 0.56, seconds: 28 },
      flag: { initial: 6.95, perUnit: 0.45, seconds: 28 },
    },
  },
};

// Card payment fee
const CARD_FEE = 0.50;

// Extra passenger surcharge: £2.50 per passenger over 4
const EXTRA_PASSENGER_FEE = 2.50;

// Luxury V-Class hourly rate
export const LUXURY_HOURLY_RATE = 80;

/**
 * Get the active tariff for a given date/time
 * Priority: Tariff 3 (Christmas/NY) > Tariff 2 (Evenings/Sundays) > Tariff 1 (Daytime)
 */
export function getActiveTariff(date = new Date()): Tariff {
  if (TARIFFS.tariff3.active(date)) return TARIFFS.tariff3;
  if (TARIFFS.tariff2.active(date)) return TARIFFS.tariff2;
  return TARIFFS.tariff1;
}

export interface FareResult {
  fare: number;
  tariff: Tariff | null;
  vehicleType: VehicleType;
  isLuxury: boolean;
  breakdown: {
    base: number;
    units: number;
    unitsCost: number;
    passengerSurcharge: number;
    cardFee: number;
    // Luxury specific
    hours?: number;
    hourlyRate?: number;
  };
}

/**
 * Calculate fare using Jersey tariff rules (standard) or hourly rate (luxury)
 * @param distanceMeters - Distance in meters (from Mapbox Directions)
 * @param durationSeconds - Duration in seconds (from Mapbox Directions)
 * @param passengers - Number of passengers
 * @param isFlag - If true, use flag rates; if false (default), use prebook rates
 * @param date - Date/time of the ride (for tariff selection)
 * @param vehicleType - "standard" or "luxury"
 */
export function calculateFare(
  distanceMeters: number,
  durationSeconds: number,
  passengers: number = 1,
  isFlag: boolean = false,
  date: Date = new Date(),
  vehicleType: VehicleType = "standard"
): FareResult {
  // Luxury V-Class: Hourly rate, no distance/tariff logic
  if (vehicleType === "luxury") {
    const hours = Math.ceil(durationSeconds / 3600);
    const fare = hours * LUXURY_HOURLY_RATE;

    return {
      fare,
      tariff: null,
      vehicleType: "luxury",
      isLuxury: true,
      breakdown: {
        base: 0,
        units: 0,
        unitsCost: 0,
        passengerSurcharge: 0,
        cardFee: 0,
        hours,
        hourlyRate: LUXURY_HOURLY_RATE,
      },
    };
  }

  // Standard taxi: Use tariff-based calculation
  const tariff = getActiveTariff(date);
  const rates = isFlag ? tariff.rates.flag : tariff.rates.prebook;

  // Convert distance to 1/10 mile units
  // 1 mile = 1609.34 meters
  const distanceMiles = distanceMeters / 1609.34;
  const unitsDistance = distanceMiles * 10;

  // Calculate time units based on tariff seconds per unit
  const unitsTime = durationSeconds / rates.seconds;

  // Bill using the larger of distance vs time units
  const units = Math.max(unitsDistance, unitsTime);

  // Base fare + (units * per unit rate)
  const base = rates.initial;
  const unitsCost = units * rates.perUnit;

  // Extra passengers cost £2.50 each above 4 people
  let passengerSurcharge = 0;
  if (passengers > 4) {
    passengerSurcharge = (passengers - 4) * EXTRA_PASSENGER_FEE;
  }

  // Card fee
  const cardFee = CARD_FEE;

  // Total fare
  const totalFare = base + unitsCost + passengerSurcharge + cardFee;

  // Round to nearest penny (0.01)
  const fare = Math.round(totalFare * 100) / 100;

  return {
    fare,
    tariff,
    vehicleType: "standard",
    isLuxury: false,
    breakdown: {
      base,
      units: Math.round(units * 10) / 10, // Round units for display
      unitsCost: Math.round(unitsCost * 100) / 100,
      passengerSurcharge,
      cardFee,
    },
  };
}

/**
 * Format tariff info for display
 */
export function formatTariffInfo(tariff: Tariff, isPrebooked: boolean = true): string {
  const rates = isPrebooked ? tariff.rates.prebook : tariff.rates.flag;
  return `${tariff.name} - £${rates.initial.toFixed(2)} initial + £${rates.perUnit.toFixed(2)} per ${rates.seconds}s`;
}
