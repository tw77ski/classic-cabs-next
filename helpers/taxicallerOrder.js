// helpers/taxicallerOrder.js

// TaxiCaller uses integer coords: [lng * 1e6, lat * 1e6]
function toCoords(lat, lng) {
    if (lat == null || lng == null) return null;
    return [Math.round(lng * 1e6), Math.round(lat * 1e6)];
}

/**
 * Build TaxiCaller Booker "order" payload with multi-stop route.
 *
 * Expected body shape from frontend:
 * {
 *   client: { first_name, last_name, phone, email },
 *   notes,
 *   time,
 *   pickupAddress,
 *   pickupLat,
 *   pickupLng,
 *   dropoffAddress,
 *   dropoffLat,
 *   dropoffLng,
 *   stopsWithCoords: [{ address, lat, lng }, ...],
 *   returnTrip,
 *   returnTime
 * }
 */
export function buildTaxiCallerOrder(body, { companyId }) {
    const {
        client,
        notes,
        time,
        pickupAddress,
        pickupLat,
        pickupLng,
        dropoffAddress,
        dropoffLat,
        dropoffLng,
        stopsWithCoords = [],
    } = body;

    const nodes = [];
    let seq = 0;

    // --- Pickup node (seq 0) ---
    const pickupCoords = toCoords(pickupLat, pickupLng);
    const pickupTimestamp = time ? Math.floor(new Date(time).getTime() / 1000) : 0;

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
                target: pickupTimestamp,
                latest: pickupTimestamp,
            },
        },
        info: {},
        seq: seq++,
    });

    // --- Intermediate stops (seq 1..n-2) ---
    stopsWithCoords.forEach((stop) => {
        const coords = toCoords(stop.lat, stop.lng);
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
    });

    // --- Final drop-off node ---
    const dropoffCoords = toCoords(dropoffLat, dropoffLng);
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

    // --- Legs (0→1, 1→2, ..., n-2→n-1) ---
    const legs = [];
    for (let i = 0; i < nodes.length - 1; i++) {
        const from = nodes[i];
        const to = nodes[i + 1];
        const fromCoords = from.location.coords || [0, 0];
        const toCoords2 = to.location.coords || [0, 0];

        legs.push({
            from_seq: from.seq,
            to_seq: to.seq,
            meta: {
                dist: 0,      // let TaxiCaller recalc these
                est_dur: 0,
            },
            pts: [...fromCoords, ...toCoords2],
        });
    }

    // --- Passenger item ---
    const passengerName =
    (client?.first_name || "") + " " + (client?.last_name || "");
    const trimmedName = passengerName.trim() || "Passenger";

    const order = {
        order_id: 0,
        company_id: companyId,
        provider_id: 0,
        created: 0,
        external_id: "classiccabco-web",
        items: [
            {
                "@type": "passengers",
                seq: 0,
                passenger: {
                    name: trimmedName,
                    phone: client?.phone || "",
                    email: client?.email || "",
                },
                client_id: 0,
                require: { seats: 1, wc: 0, bags: 0 },
                pay_info: [],
            },
        ],
        route: {
            nodes,
            legs,
            meta: { dist: 0, est_dur: 0 },
        },
    };

    return {
        order,
        dispatch_options: {
            auto_assign: false,
        },
    };
}
