import { NextResponse } from "next/server";

// Dedicated Mapbox search endpoint for Jersey
// Restricted to: POIs, addresses, postcodes, places
// Country: Jersey (je) only

export async function POST(request: Request) {
    try {
    const { query, types } = await request.json();

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;

    if (!mapboxToken) {
      console.error("MAPBOX_ACCESS_TOKEN not configured");
            return NextResponse.json(
        { error: "Search service not configured" },
        { status: 500 }
            );
        }

    const results = await searchMapbox(query, mapboxToken, types);
    return NextResponse.json({ results });
  } catch (error: unknown) {
    console.error("Mapbox search error:", error);
    const errorMessage = error instanceof Error ? error.message : "Server error";
        return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || searchParams.get("query");
    const types = searchParams.get("types");

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;

    if (!mapboxToken) {
      console.error("MAPBOX_ACCESS_TOKEN not configured");
      return NextResponse.json(
        { error: "Search service not configured" },
        { status: 500 }
        );
    }

    const results = await searchMapbox(query, mapboxToken, types);
    return NextResponse.json({ results });
  } catch (error: unknown) {
    console.error("Mapbox search GET error:", error);
    const errorMessage = error instanceof Error ? error.message : "Server error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

async function searchMapbox(
  query: string,
  token: string,
  customTypes?: string | null
) {
  const encodedQuery = encodeURIComponent(query);

  // Jersey center coordinates for proximity bias
  const jerseyLng = -2.1313;
  const jerseyLat = 49.2144;

  // Default types: POIs, addresses, postcodes, places
  const searchTypes = customTypes || "poi,address,postcode,place";

  // Mapbox Geocoding API
  // - country=je: Restrict to Jersey only
  // - types: Filter result types
  // - proximity: Bias results toward Jersey center
  // - autocomplete=true: Enable partial matching
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?autocomplete=true&country=je&types=${searchTypes}&proximity=${jerseyLng},${jerseyLat}&limit=8&access_token=${token}`;

  const res = await fetch(url);
  
  // Safely parse response - handle non-JSON responses
  const text = await res.text();
  let data;
  
  try {
    data = JSON.parse(text);
  } catch {
    console.error("Mapbox search: Non-JSON response:", text.substring(0, 500));
    throw new Error("Invalid response from Mapbox");
  }

  if (!res.ok) {
    console.error("Mapbox search error:", res.status, data);
    throw new Error(data.message || "Mapbox request failed");
  }

  if (data.message) {
    console.error("Mapbox API error:", data.message);
    throw new Error(data.message);
  }

  if (!data.features) {
    return [];
  }

  console.log(`Mapbox search: ${data.features.length} results for "${query}"`);

  interface MapboxFeature {
    id: string;
    place_name: string;
    text: string;
    center: [number, number];
    place_type?: string[];
    properties?: {
      address?: string;
      category?: string;
    };
  }

  return (data.features as MapboxFeature[]).map((feature) => ({
    id: feature.id,
    label: feature.place_name,
    name: feature.text,
    lat: feature.center[1],
    lng: feature.center[0],
    type: feature.place_type?.[0] || "unknown",
    address: feature.properties?.address || "",
    category: feature.properties?.category || "",
  }));
}
