// src/lib/taxicaller.ts
// TaxiCaller API integration

const getConfig = () => ({
  apiDomain: process.env.TAXICALLER_API_DOMAIN || "api-rc.taxicaller.net",
  apiKey: process.env.TAXICALLER_API_KEY || "",
  companyId: parseInt(process.env.TAXICALLER_COMPANY_ID || "0", 10),
  jwt: process.env.TAXICALLER_DEV_JWT || "",
});

// Convert to TaxiCaller integer coordinates [lng * 1e6, lat * 1e6]
function toTCCoords(lat: number | null, lng: number | null): [number, number] | null {
  if (lat == null || lng == null) return null;
  return [Math.round(lng * 1_000_000), Math.round(lat * 1_000_000)];
}

// TaxiCaller API request helper
async function tcRequest(endpoint: string, options: RequestInit = {}) {
  const config = getConfig();
  const url = `https://${config.apiDomain}${endpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.jwt}`,
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`TaxiCaller API error: ${response.status} ${errorText}`);
    throw new Error(`TaxiCaller API error: ${response.status}`);
  }

  return response.json();
}

// Build order payload for TaxiCaller
interface BookingRequest {
  passengerName: string;
  passengerPhone: string;
  passengerEmail?: string;
  seats: number;
  bags: number;
  pickupAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffAddress: string;
  dropoffLat: number | null;
  dropoffLng: number | null;
  stops: Array<{ address: string; lat: number | null; lng: number | null }>;
  asap: boolean;
  pickupTimeUnix: number | null;
  notes?: string;
  returnTrip?: boolean;
  returnTimeUnix?: number | null;
}

export function buildOrderPayload(body: BookingRequest) {
  const config = getConfig();
  
  const {
    passengerName,
    passengerPhone,
    passengerEmail,
    seats,
    bags,
    pickupAddress,
    pickupLat,
    pickupLng,
    dropoffAddress,
    dropoffLat,
    dropoffLng,
    stops = [],
    asap,
    pickupTimeUnix,
    notes,
  } = body;

  interface RouteNode {
    actions: Array<{
      "@type": string;
      item_seq: number;
      action: string;
      info: { all: string };
    }>;
    location: {
      name: string;
      coords: [number, number] | null;
    };
    times: {
      arrive: {
        target: number;
        latest: number;
      };
    };
    info: Record<string, unknown>;
    seq: number;
  }

  const nodes: RouteNode[] = [];
  let seq = 0;

  // Pickup node
  const pickupCoords = toTCCoords(pickupLat, pickupLng);
  const pickupTime = asap ? 0 : (pickupTimeUnix || 0);

  nodes.push({
    actions: [
      {
        "@type": "client_action",
        item_seq: 0,
        action: "in",
        info: { all: notes || "" },
      },
    ],
    location: {
      name: pickupAddress,
      coords: pickupCoords,
    },
    times: {
      arrive: {
        target: pickupTime,
        latest: pickupTime,
      },
    },
    info: {},
    seq: seq++,
  });

  // Intermediate stops
  for (const stop of stops) {
    if (!stop.address) continue;
    const coords = toTCCoords(stop.lat, stop.lng);
    nodes.push({
      actions: [],
      location: {
        name: stop.address,
        coords,
      },
      times: {
        arrive: { target: 0, latest: 0 },
      },
      info: {},
      seq: seq++,
    });
  }

  // Dropoff node
  const dropoffCoords = toTCCoords(dropoffLat, dropoffLng);
  nodes.push({
    actions: [
      {
        "@type": "client_action",
        item_seq: 0,
        action: "out",
        info: { all: "" },
      },
    ],
    location: {
      name: dropoffAddress,
      coords: dropoffCoords,
    },
    times: {
      arrive: { target: 0, latest: 0 },
    },
    info: {},
    seq: seq++,
  });

  // Build legs between nodes
  const legs = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const fromCoords = nodes[i].location.coords || [0, 0];
    const toCoords = nodes[i + 1].location.coords || [0, 0];

    legs.push({
      from_seq: i,
      to_seq: i + 1,
      meta: {
        dist: 0,
        est_dur: 0,
      },
      pts: [...fromCoords, ...toCoords],
    });
  }

  return {
    order: {
      order_id: 0,
      company_id: config.companyId,
      provider_id: 0,
      created: 0,
      external_id: "classic-cabs-web",
      items: [
        {
          "@type": "passengers",
          seq: 0,
          passenger: {
            name: passengerName || "Passenger",
            phone: passengerPhone || "",
            email: passengerEmail || "",
          },
          client_id: 0,
          require: {
            seats: seats || 1,
            wc: 0,
            bags: bags || 0,
          },
          pay_info: [],
        },
      ],
      route: {
        nodes,
        legs,
        meta: {
          dist: 0,
          est_dur: 0,
        },
      },
    },
    dispatch_options: {
      auto_assign: false,
    },
  };
}

// Create a new booking
export async function createBooking(body: BookingRequest) {
  const payload = buildOrderPayload(body);
  console.log("Creating TaxiCaller booking:", JSON.stringify(payload, null, 2));
  
  const result = await tcRequest("/booker/order", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  
  return result;
}

// Get fare estimate
interface FareRequest {
  pickupAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffAddress: string;
  dropoffLat: number | null;
  dropoffLng: number | null;
  stops: Array<{ address: string; lat: number | null; lng: number | null }>;
  asap: boolean;
  pickupTimeUnix: number | null;
}

export async function getFareEstimate(body: FareRequest) {
  const config = getConfig();
  
  // Build route for fare calculation
  const pickupCoords = toTCCoords(body.pickupLat, body.pickupLng);
  const dropoffCoords = toTCCoords(body.dropoffLat, body.dropoffLng);
  
  if (!pickupCoords || !dropoffCoords) {
    throw new Error("Missing coordinates for fare calculation");
  }

  // Build waypoints array
  const waypoints = [pickupCoords];
  
  for (const stop of body.stops || []) {
    const coords = toTCCoords(stop.lat, stop.lng);
    if (coords) waypoints.push(coords);
  }
  
  waypoints.push(dropoffCoords);

  const farePayload = {
    company_id: config.companyId,
    waypoints,
    time: body.asap ? 0 : (body.pickupTimeUnix || 0),
  };

  console.log("Getting fare estimate:", JSON.stringify(farePayload, null, 2));

  try {
    const result = await tcRequest("/booker/fare", {
      method: "POST",
      body: JSON.stringify(farePayload),
    });
    return result;
  } catch (error) {
    console.error("Fare estimate error:", error);
    // Return a mock response if API fails
    return {
      error: "Unable to calculate fare",
      message: "Please try again or contact us for a quote",
    };
  }
}

// Get available vehicles
export async function getVehicles() {
  const config = getConfig();
  return tcRequest(`/booker/vehicles?company_id=${config.companyId}`);
}

// Get live jobs
export async function getLiveJobs() {
  const config = getConfig();
  return tcRequest(`/booker/jobs?company_id=${config.companyId}`);
}

export { getConfig };



