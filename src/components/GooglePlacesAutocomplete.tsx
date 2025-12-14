'use client';

import React, { useEffect, useState } from 'react';

export type LatLng = { lat: number; lng: number };

type Props = {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    onPlaceDetails?: (details: { location: LatLng | null }) => void;
};

type Suggestion = {
    id: string;
    place_name: string;
    center: [number, number]; // [lng, lat]
};

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export function GooglePlacesAutocomplete({
    value,
    onChange,
    placeholder,
    className,
    onPlaceDetails,
}: Props) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<Suggestion[]>([]);
    const [typed, setTyped] = useState(value);

    useEffect(() => {
        setTyped(value);
    }, [value]);

    useEffect(() => {
        if (!MAPBOX_TOKEN) return;
        if (!typed || typed.length < 3) {
            setResults([]);
            return;
        }

        let cancelled = false;
        const timeout = setTimeout(async () => {
            try {
                setLoading(true);
                const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
                    typed
                )}.json?autocomplete=true&limit=5&language=en&access_token=${MAPBOX_TOKEN}`;

                const res = await fetch(url);
                if (!res.ok) throw new Error('Mapbox geocoding failed');
                const data = await res.json();

                if (cancelled) return;
                setResults(
                    (data.features || []).map((f: { id: string; place_name: string; center: [number, number] }) => ({
                        id: f.id,
                        place_name: f.place_name,
                        center: f.center,
                    }))
                );
                setOpen(true);
            } catch (e) {
                if (!cancelled) {
                    console.error('Mapbox autocomplete error', e);
                    setResults([]);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, 250); // small debounce

        return () => {
            cancelled = true;
            clearTimeout(timeout);
        };
    }, [typed]);

    const handleSelect = (s: Suggestion) => {
        onChange(s.place_name);
        setTyped(s.place_name);
        setOpen(false);

        const [lng, lat] = s.center;
        onPlaceDetails?.({
            location: { lat, lng },
        });
    };

    return (
        <div className="relative">
        <input
        value={typed}
        onChange={e => {
            const v = e.target.value;
            setTyped(v);
            onChange(v);
        }}
        placeholder={placeholder}
        className={className}
        onFocus={() => {
            if (results.length > 0) setOpen(true);
        }}
        onBlur={() => {
            // close with slight delay so click can register
            setTimeout(() => setOpen(false), 120);
        }}
        />

        {open && (results.length > 0 || loading) && (
            <div className="absolute z-20 mt-1 w-full rounded-2xl border border-[#2b3a36] bg-[#050b0c] text-sm text-[#f7f1e4] shadow-xl shadow-black/60">
            {loading && (
                <div className="px-3 py-2 text-[11px] text-[#b9aa8c]">
                Searching…
                </div>
            )}

            {results.map(s => (
                <button
                key={s.id}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => handleSelect(s)}
                className="block w-full px-3 py-2 text-left hover:bg-[#151f20]"
                >
                {s.place_name}
                </button>
            ))}

            {!loading && results.length === 0 && (
                <div className="px-3 py-2 text-[11px] text-[#b9aa8c]">
                No results
                </div>
            )}
            </div>
        )}
        </div>
    );
}
