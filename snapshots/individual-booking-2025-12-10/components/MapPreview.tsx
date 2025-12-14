// NOTE: Responsive desktop layout applied here — ask to revert if needed.
// LAYOUT_VERSION: 2.0 — Responsive map height

"use client";

import { useRef, useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";

// Set access token
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

interface Coordinate {
  lat: number;
  lng: number;
}

interface MapPreviewProps {
  pickup?: Coordinate | null;
  stops?: (Coordinate | null)[];
  dropoff?: Coordinate | null;
  route?: GeoJSON.LineString | null;
  distance?: number; // meters
  duration?: number; // seconds
}

export default function MapPreview({
  pickup,
  stops,
  dropoff,
  route,
  distance,
  duration,
}: MapPreviewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Jersey center coordinates (stable reference to avoid re-renders)
  const jerseyCenter = useRef<[number, number]>([-2.13, 49.21]);

  // Create custom marker element (defined before useEffect to avoid "accessed before declared" error)
  function createMarkerElement(
    type: "pickup" | "stop" | "dropoff",
    number?: number
  ): HTMLDivElement {
    const el = document.createElement("div");
    el.className = "custom-marker";

    const colors = {
      pickup: { bg: "#22c55e", border: "#16a34a" }, // Green
      stop: { bg: "#eab308", border: "#ca8a04" }, // Yellow
      dropoff: { bg: "#ef4444", border: "#dc2626" }, // Red
    };

    const { bg, border } = colors[type];

    el.style.cssText = `
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: ${bg};
      border: 3px solid ${border};
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
      color: white;
      font-family: 'DM Sans', sans-serif;
    `;

    if (type === "stop" && number) {
      el.textContent = String(number);
    } else if (type === "pickup") {
      el.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><circle cx="12" cy="12" r="4"/></svg>`;
    } else if (type === "dropoff") {
      el.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><path d="M12 2v20M5 12h14"/></svg>`;
    }

    return el;
  }

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: jerseyCenter.current,
      zoom: 11,
      attributionControl: false, // We will re-add manually to top-left
    });

    // Add attribution control to top-left
    map.current.addControl(
      new mapboxgl.AttributionControl({
        compact: true,
      }),
      "top-left"
    );

    map.current.on("load", () => {
      setMapLoaded(true);

      // Add route source and layer
      map.current!.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [],
          },
        },
      });

      map.current!.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#c9a962",
          "line-width": 4,
          "line-opacity": 0.8,
        },
      });

      // Add glow effect layer
      map.current!.addLayer({
        id: "route-glow",
        type: "line",
        source: "route",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#c9a962",
          "line-width": 8,
          "line-opacity": 0.3,
          "line-blur": 3,
        },
      }, "route-line");
    });

    // Disable scroll zoom for better UX
    map.current.scrollZoom.disable();

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      "top-right"
    );

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update markers when coordinates change
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const bounds = new mapboxgl.LngLatBounds();
    let hasPoints = false;

    // Add pickup marker (green)
    if (pickup?.lat && pickup?.lng) {
      const el = createMarkerElement("pickup");
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([pickup.lng, pickup.lat])
        .addTo(map.current);
      markersRef.current.push(marker);
      bounds.extend([pickup.lng, pickup.lat]);
      hasPoints = true;
    }

    // Add stop markers (yellow, numbered)
    if (stops && stops.length > 0) {
      stops.forEach((stop, index) => {
        if (stop?.lat && stop?.lng) {
          const el = createMarkerElement("stop", index + 1);
          const marker = new mapboxgl.Marker({ element: el })
            .setLngLat([stop.lng, stop.lat])
            .addTo(map.current!);
          markersRef.current.push(marker);
          bounds.extend([stop.lng, stop.lat]);
          hasPoints = true;
        }
      });
    }

    // Add dropoff marker (red)
    if (dropoff?.lat && dropoff?.lng) {
      const el = createMarkerElement("dropoff");
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([dropoff.lng, dropoff.lat])
        .addTo(map.current);
      markersRef.current.push(marker);
      bounds.extend([dropoff.lng, dropoff.lat]);
      hasPoints = true;
    }

    // Fit bounds if we have points
    if (hasPoints) {
      map.current.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        maxZoom: 14,
        duration: 500,
      });
    }
  }, [pickup, stops, dropoff, mapLoaded]);

  // Update route when it changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const source = map.current.getSource("route") as mapboxgl.GeoJSONSource;
    if (!source) return;

    if (route && route.coordinates && route.coordinates.length > 0) {
      source.setData({
        type: "Feature",
        properties: {},
        geometry: route,
      });
    } else {
      // Clear route
      source.setData({
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: [],
        },
      });
    }
  }, [route, mapLoaded]);

  // Format distance (convert meters to miles)
  function formatDistance(meters: number): string {
    const miles = meters / 1609.34;
    return `${miles.toFixed(1)} mi`;
  }

  // Format duration
  function formatDuration(seconds: number): string {
    const mins = Math.round(seconds / 60);
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hours}h ${remainingMins}m`;
    }
    return `${mins} min`;
  }

  return (
    <div className="relative rounded-xl overflow-hidden shadow-lg border border-[#c9a962]/20">
      {/* Map container - responsive height: 240px mobile → 380px desktop */}
      <div
        ref={mapContainer}
        className="w-full h-60 sm:h-72 md:h-80 lg:h-96"
        style={{ minHeight: "240px" }}
      />

      {/* Travel info overlay */}
      {distance && duration && (
        <div className="absolute bottom-3 left-3 bg-[#1a1f1e]/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-[#c9a962]/30">
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1.5 text-[#f7f1e4]">
              <svg
                className="w-4 h-4 text-[#c9a962]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 12h18M3 12l4-4m-4 4l4 4" />
              </svg>
              <span className="font-medium">{formatDistance(distance)}</span>
            </div>
            <div className="w-px h-4 bg-[#c9a962]/30" />
            <div className="flex items-center gap-1.5 text-[#f7f1e4]">
              <svg
                className="w-4 h-4 text-[#c9a962]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <span className="font-medium">{formatDuration(duration)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!pickup?.lat && !dropoff?.lat && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1a1f1e]/60 backdrop-blur-sm">
          <div className="text-center text-[#9ba39b]">
            <svg
              className="w-8 h-8 mx-auto mb-2 text-[#c9a962]/50"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <p className="text-sm">Enter locations to see route preview</p>
          </div>
        </div>
      )}
    </div>
  );
}

