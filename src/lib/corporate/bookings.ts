// Corporate Bookings Types and Utilities
import { query, isDatabaseAvailable } from './db';

export type BookingStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';

export interface CorporateBooking {
  id: number;
  reference: string;
  companyId: number;
  companyName?: string;
  userId: number;
  userName?: string;
  
  // Status
  status: BookingStatus;
  statusUpdatedAt: string;
  approvedBy?: number;
  approvedByName?: string;
  rejectionReason?: string;
  
  // Passenger
  passengerName: string;
  passengerPhone: string;
  passengerEmail?: string;
  passengerCount: number;
  luggageCount: number;
  
  // Journey
  pickupAddress: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoffAddress: string;
  dropoffLat?: number;
  dropoffLng?: number;
  stops: { address: string; lat?: number; lng?: number }[];
  
  // Booking details
  pickupTime: string;
  isAsap: boolean;
  vehicleType: string;
  notes?: string;
  costCentre?: string;
  poNumber?: string;
  contactPerson?: string;
  flightNumber?: string;
  
  // TaxiCaller reference
  taxicallerOrderId?: string;
  taxicallerJobId?: number;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookingInput {
  companyId: number;
  userId: number;
  passengerName: string;
  passengerPhone: string;
  passengerEmail?: string;
  passengerCount?: number;
  luggageCount?: number;
  pickupAddress: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoffAddress: string;
  dropoffLat?: number;
  dropoffLng?: number;
  stops?: { address: string; lat?: number; lng?: number }[];
  pickupTime: string;
  isAsap?: boolean;
  vehicleType?: string;
  notes?: string;
  costCentre?: string;
  poNumber?: string;
  contactPerson?: string;
  flightNumber?: string;
}

// Generate a unique booking reference
export function generateBookingReference(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CB-${datePart}-${randomPart}`;
}

// In-memory storage for demo mode
const demoBookings: CorporateBooking[] = [];
let demoIdCounter = 1;

// Create a new pending booking
export async function createPendingBooking(input: CreateBookingInput): Promise<CorporateBooking> {
  const reference = generateBookingReference();
  const now = new Date().toISOString();
  
  const dbReady = await isDatabaseAvailable();
  
  if (dbReady) {
    try {
      const result = await query(
        `INSERT INTO corporate_bookings 
         (reference, company_id, user_id, status, passenger_name, passenger_phone, passenger_email,
          passenger_count, luggage_count, pickup_address, pickup_lat, pickup_lng, dropoff_address,
          dropoff_lat, dropoff_lng, stops, pickup_time, is_asap, vehicle_type, notes,
          cost_centre, po_number, contact_person, flight_number)
         VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
         RETURNING *`,
        [
          reference,
          input.companyId,
          input.userId,
          input.passengerName,
          input.passengerPhone,
          input.passengerEmail || null,
          input.passengerCount || 1,
          input.luggageCount || 0,
          input.pickupAddress,
          input.pickupLat || null,
          input.pickupLng || null,
          input.dropoffAddress,
          input.dropoffLat || null,
          input.dropoffLng || null,
          JSON.stringify(input.stops || []),
          input.pickupTime,
          input.isAsap || false,
          input.vehicleType || 'standard',
          input.notes || null,
          input.costCentre || null,
          input.poNumber || null,
          input.contactPerson || null,
          input.flightNumber || null,
        ]
      );
      
      return mapDbRowToBooking(result.rows[0]);
    } catch (error) {
      console.error('Error creating booking in database:', error);
      // Fall through to demo mode
    }
  }
  
  // Demo mode
  const booking: CorporateBooking = {
    id: demoIdCounter++,
    reference,
    companyId: input.companyId,
    userId: input.userId,
    status: 'pending',
    statusUpdatedAt: now,
    passengerName: input.passengerName,
    passengerPhone: input.passengerPhone,
    passengerEmail: input.passengerEmail,
    passengerCount: input.passengerCount || 1,
    luggageCount: input.luggageCount || 0,
    pickupAddress: input.pickupAddress,
    pickupLat: input.pickupLat,
    pickupLng: input.pickupLng,
    dropoffAddress: input.dropoffAddress,
    dropoffLat: input.dropoffLat,
    dropoffLng: input.dropoffLng,
    stops: input.stops || [],
    pickupTime: input.pickupTime,
    isAsap: input.isAsap || false,
    vehicleType: input.vehicleType || 'standard',
    notes: input.notes,
    costCentre: input.costCentre,
    poNumber: input.poNumber,
    contactPerson: input.contactPerson,
    flightNumber: input.flightNumber,
    createdAt: now,
    updatedAt: now,
  };
  
  demoBookings.push(booking);
  return booking;
}

// Get bookings for a company
export async function getCompanyBookings(
  companyId: number,
  options?: { status?: BookingStatus; limit?: number }
): Promise<CorporateBooking[]> {
  const dbReady = await isDatabaseAvailable();
  
  if (dbReady) {
    try {
      let sqlQuery = `
        SELECT cb.*, cc.name as company_name, cu.name as user_name
        FROM corporate_bookings cb
        LEFT JOIN corporate_companies cc ON cb.company_id = cc.id
        LEFT JOIN corporate_users cu ON cb.user_id = cu.id
        WHERE cb.company_id = $1
      `;
      const params: (number | string)[] = [companyId];
      
      if (options?.status) {
        sqlQuery += ` AND cb.status = $${params.length + 1}`;
        params.push(options.status);
      }
      
      sqlQuery += ` ORDER BY cb.created_at DESC`;
      
      if (options?.limit) {
        sqlQuery += ` LIMIT $${params.length + 1}`;
        params.push(options.limit);
      }
      
      const result = await query(sqlQuery, params);
      return result.rows.map(mapDbRowToBooking);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    }
  }
  
  // Demo mode
  let bookings = demoBookings.filter(b => b.companyId === companyId);
  if (options?.status) {
    bookings = bookings.filter(b => b.status === options.status);
  }
  bookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  if (options?.limit) {
    bookings = bookings.slice(0, options.limit);
  }
  return bookings;
}

// Get a single booking by ID or reference
export async function getBookingByRef(reference: string): Promise<CorporateBooking | null> {
  const dbReady = await isDatabaseAvailable();
  
  if (dbReady) {
    try {
      const result = await query(
        `SELECT cb.*, cc.name as company_name, cu.name as user_name
         FROM corporate_bookings cb
         LEFT JOIN corporate_companies cc ON cb.company_id = cc.id
         LEFT JOIN corporate_users cu ON cb.user_id = cu.id
         WHERE cb.reference = $1`,
        [reference]
      );
      
      if (result.rows.length === 0) return null;
      return mapDbRowToBooking(result.rows[0]);
    } catch (error) {
      console.error('Error fetching booking:', error);
    }
  }
  
  // Demo mode
  return demoBookings.find(b => b.reference === reference) || null;
}

// Update booking status
export async function updateBookingStatus(
  reference: string,
  status: BookingStatus,
  options?: { approvedBy?: number; rejectionReason?: string; taxicallerOrderId?: string; taxicallerJobId?: number }
): Promise<CorporateBooking | null> {
  const dbReady = await isDatabaseAvailable();
  
  if (dbReady) {
    try {
      const result = await query(
        `UPDATE corporate_bookings SET
         status = $1,
         status_updated_at = NOW(),
         approved_by = $2,
         rejection_reason = $3,
         taxicaller_order_id = $4,
         taxicaller_job_id = $5,
         updated_at = NOW()
         WHERE reference = $6
         RETURNING *`,
        [
          status,
          options?.approvedBy || null,
          options?.rejectionReason || null,
          options?.taxicallerOrderId || null,
          options?.taxicallerJobId || null,
          reference,
        ]
      );
      
      if (result.rows.length === 0) return null;
      return mapDbRowToBooking(result.rows[0]);
    } catch (error) {
      console.error('Error updating booking status:', error);
    }
  }
  
  // Demo mode
  const booking = demoBookings.find(b => b.reference === reference);
  if (!booking) return null;
  
  booking.status = status;
  booking.statusUpdatedAt = new Date().toISOString();
  booking.updatedAt = new Date().toISOString();
  if (options?.approvedBy) booking.approvedBy = options.approvedBy;
  if (options?.rejectionReason) booking.rejectionReason = options.rejectionReason;
  if (options?.taxicallerOrderId) booking.taxicallerOrderId = options.taxicallerOrderId;
  if (options?.taxicallerJobId) booking.taxicallerJobId = options.taxicallerJobId;
  
  return booking;
}

// Helper to map database row to CorporateBooking
function mapDbRowToBooking(row: Record<string, unknown>): CorporateBooking {
  return {
    id: row.id as number,
    reference: row.reference as string,
    companyId: row.company_id as number,
    companyName: row.company_name as string | undefined,
    userId: row.user_id as number,
    userName: row.user_name as string | undefined,
    status: row.status as BookingStatus,
    statusUpdatedAt: (row.status_updated_at as Date)?.toISOString() || '',
    approvedBy: row.approved_by as number | undefined,
    rejectionReason: row.rejection_reason as string | undefined,
    passengerName: row.passenger_name as string,
    passengerPhone: row.passenger_phone as string,
    passengerEmail: row.passenger_email as string | undefined,
    passengerCount: row.passenger_count as number,
    luggageCount: row.luggage_count as number,
    pickupAddress: row.pickup_address as string,
    pickupLat: row.pickup_lat ? Number(row.pickup_lat) : undefined,
    pickupLng: row.pickup_lng ? Number(row.pickup_lng) : undefined,
    dropoffAddress: row.dropoff_address as string,
    dropoffLat: row.dropoff_lat ? Number(row.dropoff_lat) : undefined,
    dropoffLng: row.dropoff_lng ? Number(row.dropoff_lng) : undefined,
    stops: (row.stops as { address: string; lat?: number; lng?: number }[]) || [],
    pickupTime: (row.pickup_time as Date)?.toISOString() || '',
    isAsap: row.is_asap as boolean,
    vehicleType: row.vehicle_type as string,
    notes: row.notes as string | undefined,
    costCentre: row.cost_centre as string | undefined,
    poNumber: row.po_number as string | undefined,
    contactPerson: row.contact_person as string | undefined,
    flightNumber: row.flight_number as string | undefined,
    taxicallerOrderId: row.taxicaller_order_id as string | undefined,
    taxicallerJobId: row.taxicaller_job_id as number | undefined,
    createdAt: (row.created_at as Date)?.toISOString() || '',
    updatedAt: (row.updated_at as Date)?.toISOString() || '',
  };
}

// Get status display info
export function getStatusDisplay(status: BookingStatus): { label: string; color: string; bgColor: string } {
  switch (status) {
    case 'pending':
      return { label: 'Pending Approval', color: 'text-amber-400', bgColor: 'bg-amber-400/10 border-amber-400/30' };
    case 'approved':
      return { label: 'Confirmed', color: 'text-emerald-400', bgColor: 'bg-emerald-400/10 border-emerald-400/30' };
    case 'rejected':
      return { label: 'Rejected', color: 'text-red-400', bgColor: 'bg-red-400/10 border-red-400/30' };
    case 'completed':
      return { label: 'Completed', color: 'text-blue-400', bgColor: 'bg-blue-400/10 border-blue-400/30' };
    case 'cancelled':
      return { label: 'Cancelled', color: 'text-gray-400', bgColor: 'bg-gray-400/10 border-gray-400/30' };
    default:
      return { label: status, color: 'text-gray-400', bgColor: 'bg-gray-400/10 border-gray-400/30' };
  }
}

