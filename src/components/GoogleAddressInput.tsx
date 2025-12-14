"use client";

import { Autocomplete, useJsApiLoader } from "@react-google-maps/api";
import { useRef } from "react";

interface GoogleAddressInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export default function GoogleAddressInput({ value, onChange, placeholder }: GoogleAddressInputProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    const { isLoaded } = useJsApiLoader({
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
        libraries: ["places"],
    });

    if (!isLoaded) return <input value={value} onChange={e => onChange(e.target.value)} />;

    return (
        <Autocomplete
        onPlaceChanged={() => {
            const place = inputRef.current as HTMLInputElement | null;
            if (place && place.value) onChange(place.value);
        }}
        >
        <input
        ref={inputRef}
        placeholder={placeholder}
        defaultValue={value}
        className="w-full rounded-full border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm"
        />
        </Autocomplete>
    );
}
