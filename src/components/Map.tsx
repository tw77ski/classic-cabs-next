
// =============================================================
// File: src/app/components/Map.tsx
// =============================================================

"use client";
import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";

export default function Map() {
    const mapRef = useRef<mapboxgl.Map | null>(null);

    useEffect(() => {
        fetch("http://localhost:4000/config")
        .then((r) => r.json())
        .then((cfg) => {
            mapboxgl.accessToken = cfg.mapboxToken;

            const m = new mapboxgl.Map({
                container: "cab-map",
                style: "mapbox://styles/mapbox/navigation-night-v1",
                center: [-2.11, 49.19],
                zoom: 11,
            });

            mapRef.current = m;
        });

        return () => {
            mapRef.current?.remove();
        };
    }, []);

    return <div id="cab-map" className="map" />;
}
