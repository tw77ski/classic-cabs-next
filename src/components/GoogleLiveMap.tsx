"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";

const MAP_UPDATE_INTERVAL = 5000; // 5 seconds

interface Driver {
    id: string | number;
    lat: number;
    lng: number;
    heading?: number;
}

// Marker icons - using type assertion for Google Maps icon format
const taxiIcon = {
    url: "/map/taxi.png",
    scaledSize: { width: 48, height: 48 },
} as google.maps.Icon;

const pickupIcon = {
    url: "/map/pickup.png",
    scaledSize: { width: 48, height: 48 },
} as google.maps.Icon;

const dropoffIcon = {
    url: "/map/dropoff.png",
    scaledSize: { width: 48, height: 48 },
} as google.maps.Icon;

export default function GoogleLiveMap({
    pickup,
    dropoff,
}: {
    pickup?: { lat: number; lng: number };
    dropoff?: { lat: number; lng: number };
}) {
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const center = { lat: 49.213, lng: -2.131 }; // Jersey default
    const hasFetchedRef = useRef(false);

    // Load Google Maps
    const { isLoaded } = useJsApiLoader({
        id: "taxi-map-script",
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
        libraries: ["maps"],
    });

    // Fetch TaxiCaller vehicles
    const loadDrivers = useCallback(async () => {
        try {
            const res = await fetch("/api/tc-vehicles");
            const json = await res.json();

            if (json.success && Array.isArray(json.drivers)) {
                setDrivers(json.drivers);
            }
        } catch (e) {
            console.error("Vehicle fetch error:", e);
        }
    }, []);

    // Initial fetch on mount (deferred to avoid synchronous setState in effect)
    useEffect(() => {
        if (!hasFetchedRef.current) {
            hasFetchedRef.current = true;
            // Use queueMicrotask to defer the setState call
            queueMicrotask(() => {
                loadDrivers();
            });
        }
    }, [loadDrivers]);

    // Set up polling interval
    useEffect(() => {
        const timer = setInterval(loadDrivers, MAP_UPDATE_INTERVAL);
        return () => clearInterval(timer);
    }, [loadDrivers]);

    if (!isLoaded) return <p className="text-slate-300">Loading map…</p>;

    return (
        <div className="w-full h-[420px] rounded-2xl overflow-hidden border border-slate-700 shadow-lg">
        <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={center}
        zoom={13}
        options={{
            streetViewControl: false,
            fullscreenControl: false,
            mapTypeControl: false,
            clickableIcons: false,
            styles: [
                {
                    elementType: "geometry",
                    stylers: [{ color: "#1d1b2c" }],
                },
                {
                    elementType: "labels.text.fill",
                    stylers: [{ color: "#bfbfbf" }],
                },
                {
                    featureType: "poi",
                    stylers: [{ visibility: "off" }],
                },
                {
                    featureType: "transit",
                    stylers: [{ visibility: "off" }],
                },
            ],
        }}
        >
        {/* Pickup marker */}
        {pickup && (
            <Marker
            position={pickup}
            icon={pickupIcon}
            />
        )}

        {/* Dropoff marker */}
        {dropoff && (
            <Marker
            position={dropoff}
            icon={dropoffIcon}
            />
        )}

        {/* LIVE TAXI MARKERS */}
        {drivers.map((d) => (
            <Marker
            key={d.id}
            position={{ lat: d.lat, lng: d.lng }}
            icon={{
                ...taxiIcon,
                rotation: d.heading || 0,
            }}
            />
        ))}
        </GoogleMap>
        </div>
    );
}
