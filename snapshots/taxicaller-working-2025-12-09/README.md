# TaxiCaller Integration Snapshot — 2025-12-09

This folder contains the **last fully working version** of the TaxiCaller integration.

## ✅ Status

| Feature | Status |
|---------|--------|
| RC Booker Endpoint | ✔ Working |
| Booker Payload Structure | ✔ Correct (items[], route.nodes[]) |
| Coordinates Format | ✔ Integers (× 1e6) |
| Timestamps Format | ✔ Unix seconds |
| Geocoding (Multi-source) | ✔ Working |
| Route Path (Mapbox) | ✔ Working |
| Frontend Error Rendering | ✔ Safe (no object crashes) |
| NullPointerException | ✔ RESOLVED |

---

## 📁 Files Included

### API Routes
- `api-book.ts` — TaxiCaller Booker API (`POST /api/book`)
- `api-geocode.ts` — Multi-source geocoding (Nominatim + Mapbox + Foursquare)
- `api-route-path.ts` — Mapbox Directions API

### Shared Utilities
- `api-utils.ts` — Response builders, logging, validation helpers
- `safeRender.tsx` — Safe React rendering for error/message objects
- `bookingRequest.ts` — Frontend validation middleware

### Frontend Components
- `page.tsx` — Main booking page (uses safeRender)
- `BookingTimeline.tsx` — Visual booking status timeline
- `DriverTracker.tsx` — Real-time driver location widget

---

## 🔧 Key Configuration

### Environment Variables Required
```bash
TAXICALLER_API_DOMAIN=api-rc.taxicaller.net
TAXICALLER_API_KEY=your-api-key
TAXICALLER_DEV_JWT=your-jwt-token
TAXICALLER_COMPANY_ID=8284
TAXICALLER_PROVIDER_ID=8284
MAPBOX_ACCESS_TOKEN=your-mapbox-token
NEXT_PUBLIC_MAPBOX_TOKEN=your-mapbox-token
```

---

## 🎯 Working Payload Structure

The TaxiCaller Booker API requires this specific structure:

```json
{
  "order": {
    "company_id": 8284,
    "provider_id": 8284,
    "items": [
      {
        "@type": "passengers",
        "seq": 0,
        "passenger": { "name": "...", "phone": "...", "email": "..." },
        "client_id": null,
        "account": null,
        "require": { "seats": 1, "wc": 0, "bags": 0 },
        "pay_info": [{ "@t": 0, "data": null }]
      }
    ],
    "route": {
      "nodes": [
        {
          "actions": [{ "@type": "client_action", "item_seq": 0, "action": "in" }],
          "location": { "name": "Pickup Address", "coords": [-2194695, 49205161] },
          "times": { "arrive": { "target": 1765540800, "latest": 0 } },
          "info": { "all": "notes here" },
          "seq": 0
        },
        {
          "actions": [{ "@type": "client_action", "item_seq": 0, "action": "out" }],
          "location": { "name": "Dropoff Address", "coords": [-2113000, 49185800] },
          "times": null,
          "info": {},
          "seq": 1
        }
      ],
      "legs": [{ "meta": { "dist": 0, "est_dur": 0 }, "pts": [], "from_seq": 0, "to_seq": 1 }],
      "meta": { "dist": 0, "est_dur": 0 }
    }
  }
}
```

### Key Points:
- **Coordinates**: `[lng × 1e6, lat × 1e6]` as integers (not decimals!)
- **Times**: Unix timestamp in seconds
- **Actions**: `"in"` for pickup, `"out"` for dropoff
- **Payment**: `{ "@t": 0, "data": null }` (0 = cash)

---

## 🔄 How to Restore

If future changes break the booking flow:

1. Copy files from this snapshot back to their original locations:
   ```
   cp api-book.ts ../src/app/api/book/route.ts
   cp api-geocode.ts ../src/app/api/geocode/route.ts
   cp api-route-path.ts ../src/app/api/route-path/route.ts
   cp api-utils.ts ../src/lib/api-utils.ts
   cp safeRender.tsx ../src/lib/safeRender.tsx
   cp bookingRequest.ts ../src/lib/validators/bookingRequest.ts
   cp page.tsx ../src/app/page.tsx
   cp BookingTimeline.tsx ../src/app/components/BookingTimeline.tsx
   cp DriverTracker.tsx ../src/app/components/DriverTracker.tsx
   ```

2. Run `npm run build` to verify

---

## 📝 Confirmed Working Response

```json
{
  "dispatch_options": { "auto_assign": true },
  "order_token": "eyJhbGciOiJIUzI1NiJ9...",
  "meta": {
    "job_id": 5325231,
    "provider_idx": 8284,
    "state": 0
  },
  "state": { "state": "not_started" }
}
```

**Status: 200 OK** ✅

---

## 📅 Snapshot Date

**December 9, 2025**

Created after successful booking test (Job ID: 5325231)


















