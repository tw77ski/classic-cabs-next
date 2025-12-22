# Individual Booking Form - Checkpoint
**Date:** December 10, 2025  
**Version:** 1.0 (Production Ready)

## Overview
This is a complete snapshot of the Classic Cabs individual booking form application. This version includes all features developed up to this checkpoint.

## Features Included

### Core Booking
- ✅ Pickup/Drop-off location search (Mapbox + Nominatim geocoding)
- ✅ Multi-stop journey support
- ✅ ASAP and scheduled bookings
- ✅ Return trip booking
- ✅ Vehicle type selection (Standard/Executive)
- ✅ Passenger details with validation
- ✅ Flight number & airport pickup options
- ✅ Driver notes

### Map & Route
- ✅ Interactive Mapbox map preview
- ✅ Route visualization with distance/duration
- ✅ Custom markers (pickup, stops, dropoff)

### UX Enhancements
- ✅ Recent addresses (localStorage)
- ✅ Popular Jersey locations (POI search)
- ✅ "Use My Location" geolocation
- ✅ Pre-filled rider info from previous bookings
- ✅ Return trip suggestion prompt
- ✅ Booking timeline status display
- ✅ Success chime audio feedback
- ✅ Gold focus glow (luxury styling)

### Date/Time
- ✅ UK date format (dd/mm/yyyy)
- ✅ 24-hour clock
- ✅ Custom DateTimeInput component

### Monitoring & Analytics
- ✅ Sentry error monitoring (client/server/edge)
- ✅ Session Replay for debugging
- ✅ Global error boundary
- ✅ Plausible analytics (privacy-friendly)

### Technical
- ✅ Next.js 16.0.8 (App Router)
- ✅ TypeScript (strict mode)
- ✅ Tailwind CSS
- ✅ TaxiCaller Booker API integration
- ✅ Responsive design (mobile + desktop)

## File Structure

```
├── page.tsx                    # Main booking page
├── layout.tsx                  # Root layout with analytics
├── globals.css                 # Tailwind + custom styles
├── next.config.ts              # Next.js + Sentry config
├── package.json                # Dependencies
├── tsconfig.json               # TypeScript config
├── instrumentation.ts          # Sentry instrumentation
├── sentry.*.config.ts          # Sentry configs
│
├── components/
│   ├── AutocompleteInput.tsx   # Address search with suggestions
│   ├── BookingTimeline.tsx     # Status progress indicator
│   ├── DateTimeInput.tsx       # UK format date/time picker
│   ├── DriverTracker.tsx       # Driver location (future)
│   ├── JourneyForm.tsx         # Pickup/stops/dropoff form
│   ├── Map.tsx                 # Basic map component
│   ├── MapPreview.tsx          # Route preview map
│   ├── PassengerForm.tsx       # Passenger details
│   └── TimingForm.tsx          # Schedule/ASAP selector
│
├── lib/
│   ├── api.ts                  # Frontend API client
│   ├── api-utils.ts            # Backend utilities
│   ├── poiSearch.ts            # POI fuzzy search
│   ├── popular-locations.ts    # Jersey popular places
│   ├── recentAddresses.ts      # Recent address storage
│   ├── safeRender.tsx          # Safe JSX rendering
│   ├── tariffs.ts              # Fare calculation
│   ├── taxicaller.ts           # TaxiCaller API wrapper
│   ├── taxicaller-types.ts     # TypeScript types
│   └── taxiccallerOrder.ts     # Order building
│
├── api/
│   ├── api-book.ts             # POST /api/book
│   ├── api-geocode.ts          # POST /api/geocode
│   ├── api-route-path.ts       # POST /api/route-path
│   ├── api-cancel.ts           # DELETE /api/cancel
│   ├── api-estimate.ts         # POST /api/estimate
│   └── api-status.ts           # GET /api/status
│
└── validators/
    └── bookingRequest.ts       # Request validation
```

## Environment Variables Required

```bash
# TaxiCaller API
TAXICALLER_API_DOMAIN=api-rc.taxicaller.net
TAXICALLER_API_KEY=your_api_key
TAXICALLER_COMPANY_ID=your_company_id
TAXICALLER_DEV_JWT=your_jwt_token

# Mapbox
MAPBOX_ACCESS_TOKEN=sk.xxx
NEXT_PUBLIC_MAPBOX_TOKEN=pk.xxx

# Sentry (optional)
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project

# Plausible Analytics (optional)
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=yourdomain.com
```

## Restore Instructions

To restore this checkpoint:

```bash
# 1. Copy files back to src/
cp page.tsx ../../src/app/
cp layout.tsx ../../src/app/
cp globals.css ../../src/app/
cp -r components/* ../../src/app/components/
cp -r lib/* ../../src/lib/

# 2. Copy API routes
cp api/api-book.ts ../../src/app/api/book/route.ts
cp api/api-geocode.ts ../../src/app/api/geocode/route.ts
# ... etc

# 3. Copy configs
cp next.config.ts ../../
cp sentry.*.config.ts ../../
cp instrumentation.ts ../../src/

# 4. Install dependencies
npm install
```

## Notes

- This version is production-ready for individual taxi bookings
- Corporate booking feature exists separately in `/corporate`
- All TypeScript errors resolved
- All security vulnerabilities patched (Next.js 16.0.8)












