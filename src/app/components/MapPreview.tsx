// NOTE: Responsive desktop layout applied here — ask to revert if needed.
// LAYOUT_VERSION: 3.0 — Live Driver Tracking + Responsive map height

"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";

// Set access token
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface Coordinate {
  lat: number;
  lng: number;
}

interface Driver {
  id: string;
  lat: number;
  lng: number;
  heading?: number;
  status?: string;
  name?: string;
  vehicle?: string;
  etaMinutes?: number;
}

interface AssignedDriver {
  id?: string;
  name: string;
  phone?: string;
  vehicle?: string;
  lat: number;
  lng: number;
  heading?: number;
  etaMinutes?: number;
}

interface MapPreviewProps {
  pickup?: Coordinate | null;
  stops?: (Coordinate | null)[];
  dropoff?: Coordinate | null;
  route?: GeoJSON.LineString | null;
  distance?: number; // meters
  duration?: number; // seconds
  // Live driver tracking props
  showNearbyDrivers?: boolean;
  assignedDriver?: AssignedDriver | null;
  onDriversLoaded?: (count: number) => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DRIVER_POLL_INTERVAL = 10000; // 10 seconds
// const ASSIGNED_DRIVER_POLL_INTERVAL = 5000; // 5 seconds for assigned driver (reserved for future use)

// =============================================================================
// COMPONENT
// =============================================================================

export default function MapPreview({
  pickup,
  stops,
  dropoff,
  route,
  distance,
  duration,
  showNearbyDrivers = false,
  assignedDriver,
  onDriversLoaded,
}: MapPreviewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const driverMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const assignedDriverMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const driverPopupRef = useRef<mapboxgl.Popup | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [mapLoaded, setMapLoaded] = useState(false);
  const [nearbyDrivers, setNearbyDrivers] = useState<Driver[]>([]);
  const [isLoadingDrivers, setIsLoadingDrivers] = useState(false);

  // Jersey center coordinates (stable reference to avoid re-renders)
  const jerseyCenter = useRef<[number, number]>([-2.1075, 49.1880]);

  // =============================================================================
  // MARKER CREATION FUNCTIONS
  // =============================================================================

  // Create custom marker element for route points
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

  // Create driver marker element (car icon with rotation)
  function createDriverMarkerElement(
    driver: Driver,
    isAssigned: boolean = false
  ): HTMLDivElement {
    const el = document.createElement("div");
    el.className = isAssigned ? "assigned-driver-marker" : "driver-marker";
    
    const rotation = driver.heading || 0;
    const size = isAssigned ? 40 : 32;
    const pulseSize = isAssigned ? 48 : 40;
    
    el.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      position: relative;
      cursor: pointer;
      transition: transform 0.3s ease;
    `;

    // Car icon SVG with rotation
    const carColor = isAssigned ? "#22c55e" : "#d4af37"; // Green for assigned, gold for nearby
    const pulseColor = isAssigned ? "rgba(34, 197, 94, 0.4)" : "rgba(212, 175, 55, 0.3)";

    el.innerHTML = `
      <div class="driver-pulse" style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: ${pulseSize}px;
        height: ${pulseSize}px;
        background: ${pulseColor};
        border-radius: 50%;
        animation: driverPulse 2s ease-out infinite;
      "></div>
      <div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(${rotation}deg);
        width: ${size}px;
        height: ${size}px;
        background: ${carColor};
        border-radius: 8px;
        border: 2px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.5s ease;
      ">
        <svg width="${size * 0.6}" height="${size * 0.6}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.9 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8c-.3.5-.1 1.1.4 1.3l.5.2" />
          <circle cx="7" cy="17" r="2" fill="white" />
          <circle cx="17" cy="17" r="2" fill="white" />
        </svg>
      </div>
      ${isAssigned && driver.etaMinutes !== undefined ? `
        <div style="
          position: absolute;
          top: -8px;
          right: -8px;
          background: #22c55e;
          color: white;
          font-size: 10px;
          font-weight: bold;
          padding: 2px 5px;
          border-radius: 8px;
          border: 1px solid white;
          font-family: 'DM Sans', sans-serif;
          white-space: nowrap;
        ">${driver.etaMinutes}m</div>
      ` : ''}
    `;

    return el;
  }

  // Create popup content for driver info
  function createDriverPopupContent(driver: Driver | AssignedDriver, isAssigned: boolean): string {
    return `
      <div style="
        padding: 8px 12px;
        font-family: 'DM Sans', sans-serif;
        min-width: 140px;
      ">
        <div style="
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        ">
          <div style="
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: ${isAssigned ? 'rgba(34, 197, 94, 0.2)' : 'rgba(212, 175, 55, 0.2)'};
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${isAssigned ? '#22c55e' : '#d4af37'}" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div>
            <div style="font-weight: 600; color: #f5f5f5; font-size: 13px;">
              ${driver.name || 'Driver'}
            </div>
            <div style="font-size: 11px; color: #888;">
              ${driver.vehicle || 'Taxi'}
            </div>
          </div>
        </div>
        ${isAssigned && 'etaMinutes' in driver && driver.etaMinutes !== undefined ? `
          <div style="
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 8px;
            background: rgba(34, 197, 94, 0.1);
            border-radius: 6px;
            margin-top: 6px;
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            <span style="font-size: 12px; color: #22c55e; font-weight: 500;">
              ${driver.etaMinutes} min away
            </span>
          </div>
        ` : ''}
        ${!isAssigned ? `
          <div style="
            font-size: 11px;
            color: #666;
            margin-top: 4px;
            display: flex;
            align-items: center;
            gap: 4px;
          ">
            <div style="width: 6px; height: 6px; background: #22c55e; border-radius: 50%;"></div>
            Available
          </div>
        ` : ''}
      </div>
    `;
  }

  // =============================================================================
  // FETCH NEARBY DRIVERS
  // =============================================================================

  const fetchNearbyDrivers = useCallback(async () => {
    if (!showNearbyDrivers) return;
    
    setIsLoadingDrivers(true);
    try {
      const res = await fetch("/api/tc-vehicles");
      const data = await res.json();
      
      if (data.success && data.drivers) {
        // Filter drivers that are available and have valid coordinates
        const availableDrivers = data.drivers.filter((d: Driver) => 
          d.lat && d.lng && (d.status === "available" || d.status === "free" || !d.status || d.status === "unknown")
        );
        setNearbyDrivers(availableDrivers);
        onDriversLoaded?.(availableDrivers.length);
      }
    } catch (error) {
      console.error("Failed to fetch nearby drivers:", error);
    } finally {
      setIsLoadingDrivers(false);
    }
  }, [showNearbyDrivers, onDriversLoaded]);

  // =============================================================================
  // UPDATE DRIVER MARKERS
  // =============================================================================

  const updateDriverMarkers = useCallback(() => {
    if (!map.current || !mapLoaded) return;

    // Update nearby driver markers
    if (showNearbyDrivers && nearbyDrivers.length > 0) {
      const currentIds = new Set(nearbyDrivers.map(d => d.id));
      
      // Remove markers for drivers that are no longer present
      driverMarkersRef.current.forEach((marker, id) => {
        if (!currentIds.has(id)) {
          marker.remove();
          driverMarkersRef.current.delete(id);
        }
      });

      // Add or update markers for current drivers
      nearbyDrivers.forEach(driver => {
        const existingMarker = driverMarkersRef.current.get(driver.id);
        
        if (existingMarker) {
          // Smoothly update position
          existingMarker.setLngLat([driver.lng, driver.lat]);
          
          // Update rotation via element style
          const el = existingMarker.getElement();
          const innerDiv = el.querySelector('div > div:last-child') as HTMLElement;
          if (innerDiv) {
            innerDiv.style.transform = `translate(-50%, -50%) rotate(${driver.heading || 0}deg)`;
          }
        } else {
          // Create new marker
          const el = createDriverMarkerElement(driver, false);
          const popup = new mapboxgl.Popup({
            offset: 25,
            closeButton: false,
            className: 'driver-popup',
          }).setHTML(createDriverPopupContent(driver, false));

          const marker = new mapboxgl.Marker({ element: el })
            .setLngLat([driver.lng, driver.lat])
            .setPopup(popup)
            .addTo(map.current!);
          
          // Show popup on hover
          el.addEventListener('mouseenter', () => marker.togglePopup());
          el.addEventListener('mouseleave', () => marker.togglePopup());
          
          driverMarkersRef.current.set(driver.id, marker);
        }
      });
    } else {
      // Clear all driver markers if not showing
      driverMarkersRef.current.forEach(marker => marker.remove());
      driverMarkersRef.current.clear();
    }

    // Update assigned driver marker
    if (assignedDriver && assignedDriver.lat && assignedDriver.lng) {
      if (assignedDriverMarkerRef.current) {
        // Smoothly update position
        assignedDriverMarkerRef.current.setLngLat([assignedDriver.lng, assignedDriver.lat]);
        
        // Update the marker element
        const el = assignedDriverMarkerRef.current.getElement();
        const innerDiv = el.querySelector('div > div:last-child') as HTMLElement;
        if (innerDiv) {
          innerDiv.style.transform = `translate(-50%, -50%) rotate(${assignedDriver.heading || 0}deg)`;
        }
        
        // Update popup content
        if (driverPopupRef.current) {
          driverPopupRef.current.setHTML(createDriverPopupContent(assignedDriver, true));
        }
      } else {
        // Create new assigned driver marker
        const el = createDriverMarkerElement({
          id: assignedDriver.id || 'assigned',
          lat: assignedDriver.lat,
          lng: assignedDriver.lng,
          heading: assignedDriver.heading,
          name: assignedDriver.name,
          vehicle: assignedDriver.vehicle,
          etaMinutes: assignedDriver.etaMinutes,
        }, true);

        const popup = new mapboxgl.Popup({
          offset: 30,
          closeButton: false,
          className: 'driver-popup assigned',
        }).setHTML(createDriverPopupContent(assignedDriver, true));
        
        driverPopupRef.current = popup;

        assignedDriverMarkerRef.current = new mapboxgl.Marker({ element: el })
          .setLngLat([assignedDriver.lng, assignedDriver.lat])
          .setPopup(popup)
          .addTo(map.current!);
        
        // Show popup on click for assigned driver
        el.addEventListener('click', () => {
          assignedDriverMarkerRef.current?.togglePopup();
        });
      }

      // If we have pickup, fit bounds to show both
      if (pickup?.lat && pickup?.lng) {
        const bounds = new mapboxgl.LngLatBounds()
          .extend([assignedDriver.lng, assignedDriver.lat])
          .extend([pickup.lng, pickup.lat]);
        
        map.current.fitBounds(bounds, {
          padding: { top: 60, bottom: 80, left: 60, right: 60 },
          maxZoom: 15,
          duration: 1000,
        });
      }
    } else if (assignedDriverMarkerRef.current) {
      // Remove assigned driver marker if no longer assigned
      assignedDriverMarkerRef.current.remove();
      assignedDriverMarkerRef.current = null;
      driverPopupRef.current = null;
    }
  }, [mapLoaded, showNearbyDrivers, nearbyDrivers, assignedDriver, pickup]);

  // =============================================================================
  // EFFECTS
  // =============================================================================

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: jerseyCenter.current,
      zoom: 10.5, // Zoomed out to show full Jersey island
      attributionControl: false,
    });

    map.current.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
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
          geometry: { type: "LineString", coordinates: [] },
        },
      });

      map.current!.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#c9a962", "line-width": 4, "line-opacity": 0.8 },
      });

      map.current!.addLayer({
        id: "route-glow",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#c9a962", "line-width": 8, "line-opacity": 0.3, "line-blur": 3 },
      }, "route-line");
    });

    map.current.scrollZoom.disable();
    map.current.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      "top-right"
    );

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update route markers when coordinates change
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const bounds = new mapboxgl.LngLatBounds();
    let hasPoints = false;

    if (pickup?.lat && pickup?.lng) {
      const el = createMarkerElement("pickup");
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([pickup.lng, pickup.lat])
        .addTo(map.current);
      markersRef.current.push(marker);
      bounds.extend([pickup.lng, pickup.lat]);
      hasPoints = true;
    }

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

    if (dropoff?.lat && dropoff?.lng) {
      const el = createMarkerElement("dropoff");
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([dropoff.lng, dropoff.lat])
        .addTo(map.current);
      markersRef.current.push(marker);
      bounds.extend([dropoff.lng, dropoff.lat]);
      hasPoints = true;
    }

    if (hasPoints && !assignedDriver) {
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      const isSinglePoint = ne.lng === sw.lng && ne.lat === sw.lat;

      if (isSinglePoint) {
        map.current.flyTo({ center: [ne.lng, ne.lat], zoom: 14, duration: 500 });
      } else {
        map.current.fitBounds(bounds, {
          padding: { top: 60, bottom: 60, left: 60, right: 60 },
          maxZoom: 15,
          duration: 800,
          essential: true,
        });
      }
    }
  }, [pickup, stops, dropoff, mapLoaded, assignedDriver]);

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

      if (!assignedDriver) {
        const routeBounds = new mapboxgl.LngLatBounds();
        route.coordinates.forEach((coord) => {
          routeBounds.extend(coord as [number, number]);
        });
        
        map.current.fitBounds(routeBounds, {
          padding: { top: 60, bottom: 60, left: 60, right: 60 },
          maxZoom: 15,
          duration: 800,
          essential: true,
        });
      }
    } else {
      source.setData({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: [] },
      });
    }
  }, [route, mapLoaded, assignedDriver]);

  // Fetch nearby drivers on mount and set up polling
  useEffect(() => {
    if (showNearbyDrivers && mapLoaded) {
      fetchNearbyDrivers();
      pollIntervalRef.current = setInterval(fetchNearbyDrivers, DRIVER_POLL_INTERVAL);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [showNearbyDrivers, mapLoaded, fetchNearbyDrivers]);

  // Update driver markers when data changes
  useEffect(() => {
    updateDriverMarkers();
  }, [updateDriverMarkers]);

  // =============================================================================
  // HELPER FUNCTIONS
  // =============================================================================

  function formatDistance(meters: number): string {
    const miles = meters / 1609.34;
    return `${miles.toFixed(1)} mi`;
  }

  function formatDuration(seconds: number): string {
    const mins = Math.round(seconds / 60);
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hours}h ${remainingMins}m`;
    }
    return `${mins} min`;
  }

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="relative rounded-xl overflow-hidden shadow-lg border border-[#c9a962]/20 h-full">
      {/* Map container */}
      <div
        ref={mapContainer}
        className="w-full h-60 sm:h-72 md:h-80 lg:h-full"
        style={{ minHeight: "240px" }}
      />

      {/* Driver count badge */}
      {showNearbyDrivers && mapLoaded && (
        <div className="absolute top-3 left-3 bg-[#1a1f1e]/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-[#c9a962]/30">
          <div className="flex items-center gap-2">
            {isLoadingDrivers ? (
              <div className="w-4 h-4 border-2 border-[#c9a962]/30 border-t-[#c9a962] rounded-full animate-spin" />
            ) : (
              <div className="relative">
                <div className="w-3 h-3 bg-[#d4af37] rounded-full"></div>
                <div className="absolute inset-0 w-3 h-3 bg-[#d4af37] rounded-full animate-ping opacity-50"></div>
              </div>
            )}
            <span className="text-xs text-[#f7f1e4] font-medium">
              {nearbyDrivers.length} {nearbyDrivers.length === 1 ? 'driver' : 'drivers'} nearby
            </span>
          </div>
        </div>
      )}

      {/* Assigned driver ETA badge */}
      {assignedDriver && assignedDriver.etaMinutes !== undefined && mapLoaded && (
        <div className="absolute top-3 left-3 bg-[#1a1f1e]/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-emerald-500/30">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
              <div className="absolute inset-0 w-3 h-3 bg-emerald-500 rounded-full animate-ping opacity-50"></div>
            </div>
            <div>
              <span className="text-xs text-emerald-400 font-medium">
                Driver arriving in {assignedDriver.etaMinutes} min
              </span>
              {assignedDriver.name && (
                <p className="text-[10px] text-[#888]">{assignedDriver.name}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Travel info overlay */}
      {distance && duration && !assignedDriver && (
        <div className="absolute bottom-3 left-3 bg-[#1a1f1e]/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-[#c9a962]/30">
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1.5 text-[#f7f1e4]">
              <svg className="w-4 h-4 text-[#c9a962]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M3 12l4-4m-4 4l4 4" />
              </svg>
              <span className="font-medium">{formatDistance(distance)}</span>
            </div>
            <div className="w-px h-4 bg-[#c9a962]/30" />
            <div className="flex items-center gap-1.5 text-[#f7f1e4]">
              <svg className="w-4 h-4 text-[#c9a962]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <span className="font-medium">{formatDuration(duration)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Map loading skeleton */}
      {!mapLoaded && (
        <div className="absolute inset-0 bg-[#1a1f1e]">
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: `
              linear-gradient(#c9a962 1px, transparent 1px),
              linear-gradient(90deg, #c9a962 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-[#c9a962]/30 border-t-[#c9a962] rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-[#666]">Loading map...</p>
            </div>
          </div>
        </div>
      )}

      {/* Empty state hint */}
      {mapLoaded && !pickup?.lat && !dropoff?.lat && !showNearbyDrivers && (
        <div className="absolute bottom-3 left-3 right-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1f1e]/90 backdrop-blur-sm border border-[#c9a962]/20 text-[#9ba39b]">
            <svg className="w-4 h-4 text-[#c9a962]/70 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <p className="text-xs">Enter pickup & destination to see your route</p>
          </div>
        </div>
      )}
    </div>
  );
}
