// src/lib/taxiccallerOrder.ts

interface OrderRequestBody {
  client: {
    first_name: string;
    last_name: string;
    phone: string;
    email?: string;
  };
  pickupAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffAddress: string;
  dropoffLat: number | null;
  dropoffLng: number | null;
  stops?: string[];
  stopPoints?: Array<{ lat: number; lng: number }>;
  time?: string;
  notes?: string;
  returnTrip?: boolean;
  returnTime?: string;
}

export function buildTaxiCallerOrder(body: OrderRequestBody, ctx: { companyId: number }) {
    const {
        client,
        pickupAddress,
        pickupLat,
        pickupLng,
        dropoffAddress,
        dropoffLat,
        dropoffLng,
        stops = [],
        stopPoints = [],
        time,
        notes,
        // returnTrip and returnTime are reserved for future use
        returnTrip: _returnTrip,
        returnTime: _returnTime,
    } = body;
    void _returnTrip;
    void _returnTime;

    // Convert to TaxiCaller integer coordinates
    const toTC = (x: number | null) =>
    x == null ? null : Math.round(x * 1_000_000);

    interface NodeAction {
        '@type': string;
        item_seq: number;
        action: string;
        info?: { all: string };
    }
    
    type Node = {
        actions: NodeAction[];
        location: {
            name: string;
            coords: [number, number];
        };
        times: {
            arrive: {
                target: number;
                latest: number;
            };
        };
        info: Record<string, unknown>;
        seq: number;
    };

    const nodes: Node[] = [];

    // ---- Node 0: Pickup -------------------------------------------------------
    nodes.push({
        actions: [
            {
                '@type': 'client_action',
                item_seq: 0,
                action: 'in',
                info: { all: notes || '' },
            },
        ],
        location: {
            name: pickupAddress,
            coords: [toTC(pickupLng)!, toTC(pickupLat)!],
        },
        times: {
            arrive: {
                target: time ? Date.parse(time) / 1000 : 0,
               latest: 0,
            },
        },
        info: {},
        seq: 0,
    });

    // ---- Intermediate stops ---------------------------------------------------
    stops.forEach((stop: string, i: number) => {
        const pt = stopPoints?.[i];
        if (!pt) return;

        nodes.push({
            actions: [],
            location: {
                name: stop,
                coords: [toTC(pt.lng)!, toTC(pt.lat)!],
            },
            times: {
                arrive: {
                    target: 0,
                    latest: 0,
                },
            },
            info: {},
            seq: nodes.length,
        });
    });

    // ---- Final dropoff --------------------------------------------------------
    nodes.push({
        actions: [
            {
                '@type': 'client_action',
                item_seq: 0,
                action: 'out',
                info: { all: '' },
            },
        ],
        location: {
            name: dropoffAddress,
            coords: [toTC(dropoffLng)!, toTC(dropoffLat)!],
        },
        times: {
            arrive: {
                target: 0,
               latest: 0,
            },
        },
        info: {},
        seq: nodes.length,
    });

    // ---- Legs between each node ----------------------------------------------
    const legs = [];
    for (let i = 0; i < nodes.length - 1; i++) {
        const a = nodes[i].location.coords;
        const b = nodes[i + 1].location.coords;

        legs.push({
            from_seq: i,
            to_seq: i + 1,
            meta: {
                dist: 0, // let TaxiCaller recalc later
                est_dur: 0,
            },
            pts: [...a, ...b],
        });
    }

    // ---- Build final TaxiCaller payload --------------------------------------
    return {
        order: {
            order_id: 0,
            company_id: ctx.companyId,
            provider_id: 0,
            created: 0,
            external_id: 'classic-cabs-web',
            items: [
                {
                    '@type': 'passengers',
                    seq: 0,
                    passenger: {
                        name: `${client.first_name} ${client.last_name}`,
                        phone: client.phone,
                        email: client.email || '',
                    },
                    client_id: 0,
                    require: {
                        seats: 1,
                        wc: 0,
                        bags: 0,
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
