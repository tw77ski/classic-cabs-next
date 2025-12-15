// Corporate Portal Types
// Used across all corporate features

// =============================================================================
// User & Auth Types
// =============================================================================

export interface CorporateUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'booker' | 'viewer';
  companyId: string;
  department?: string;
  phone?: string;
  createdAt: string;
}

export interface CorporateCompany {
  id: string;
  name: string;
  taxiCallerAccountId: number;
  address?: string;
  billingEmail?: string;
  logoUrl?: string;
  costCentres: CostCentre[];
  departments: string[];
}

export interface CorporateSession {
  user: CorporateUser;
  company: CorporateCompany;
  expiresAt: number;
}

// =============================================================================
// Booking Types
// =============================================================================

export interface CorporatePassenger {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  defaultPickup?: string;
  notes?: string;
}

export interface CostCentre {
  id: string;
  name: string;
  code: string;
  active: boolean;
}

export interface CorporateBooking {
  id: string;
  companyId: string;
  taxiCallerJobId?: string;
  bookedBy: string;
  bookedByName: string;
  passenger: {
    name: string;
    phone: string;
    email?: string;
  };
  costCentre?: string;
  department?: string;
  referenceNumber?: string;
  pickup: {
    address: string;
    lat: number;
    lng: number;
  };
  dropoff: {
    address: string;
    lat: number;
    lng: number;
  };
  stops?: Array<{
    address: string;
    lat: number;
    lng: number;
  }>;
  pickupTime: string;
  fare?: number;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  flightNumber?: string;
  vehicleType: 'standard' | 'multiseater' | 'luxury';
  createdAt: string;
}

// =============================================================================
// Dashboard Types
// =============================================================================

export interface DashboardStats {
  thisMonth: {
    totalJobs: number;
    totalSpend: number;
    totalPassengers: number;
  };
  lastMonth: {
    totalJobs: number;
    totalSpend: number;
  };
  percentageChange: {
    jobs: number;
    spend: number;
  };
}

export interface BookingSummary {
  id: string;
  passenger: string;
  pickup: string;
  dropoff: string;
  pickupTime: string;
  status: string;
  fare?: number;
}

// =============================================================================
// History & Filter Types
// =============================================================================

export interface HistoryFilters {
  dateFrom?: string;
  dateTo?: string;
  passenger?: string;
  costCentre?: string;
  bookedBy?: string;
  status?: 'all' | 'completed' | 'upcoming' | 'cancelled';
  search?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

// =============================================================================
// Flight Types
// =============================================================================

export interface FlightInfo {
  flightNumber: string;
  airline: string;
  departure: {
    airport: string;
    iata: string;
    scheduled: string;
    estimated?: string;
    terminal?: string;
  };
  arrival: {
    airport: string;
    iata: string;
    scheduled: string;
    estimated?: string;
    terminal?: string;
    gate?: string;
  };
  status: 'scheduled' | 'active' | 'landed' | 'cancelled' | 'unknown';
}




