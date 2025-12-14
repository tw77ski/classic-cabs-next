#!/bin/bash
echo "🚕 Updating Classic Cabs FULL LUXURY UI (with multi-stop support)…"
ROOT="src/app"

mkdir -p $ROOT/components
mkdir -p $ROOT/lib

# ===================================================================
# FILE 1 — page.tsx
# ===================================================================
cat > $ROOT/page.tsx << 'EOF'
"use client";

import { useState } from "react";
import JourneyForm from "./components/JourneyForm";
import PassengerForm from "./components/PassengerForm";
import TimingForm from "./components/TimingForm";
import { checkFareRequest, bookRideRequest } from "./lib/api";

export default function Page() {
  const [pickup, setPickup] = useState({ address: "", lat: null, lng: null });
  const [dropoff, setDropoff] = useState({ address: "", lat: null, lng: null });

  const [stops, setStops] = useState([{ address: "", lat: null, lng: null }]);

  const [passenger, setPassenger] = useState({
    name: "",
    phone: "",
    email: "",
  });
  const [seats, setSeats] = useState(1);
  const [bags, setBags] = useState(0);

  const [asap, setAsap] = useState(true);
  const [pickupTimeUnix, setPickupTimeUnix] = useState(null);
  const [returnTrip, setReturnTrip] = useState(false);
  const [returnTimeUnix, setReturnTimeUnix] = useState(null);

  const [fareResult, setFareResult] = useState(null);
  const [bookingResult, setBookingResult] = useState(null);

  async function handleFare() {
    const result = await checkFareRequest({
      pickupAddress: pickup.address,
      pickupLat: pickup.lat,
      pickupLng: pickup.lng,
      dropoffAddress: dropoff.address,
      dropoffLat: dropoff.lat,
      dropoffLng: dropoff.lng,
      stops,
      asap,
      pickupTimeUnix,
    });
    setFareResult(result);
  }

  async function handleBooking() {
    const result = await bookRideRequest({
      passengerName: passenger.name,
      passengerPhone: passenger.phone,
      passengerEmail: passenger.email,
      seats,
      bags,
      pickupAddress: pickup.address,
      pickupLat: pickup.lat,
      pickupLng: pickup.lng,
      dropoffAddress: dropoff.address,
      dropoffLat: dropoff.lat,
      dropoffLng: dropoff.lng,
      stops,
      asap,
      pickupTimeUnix,
      notes: "",
      returnTrip,
      returnTimeUnix,
    });
    setBookingResult(result);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-neutral-900 to-black text-white px-6 py-10 flex flex-col items-center animate-fade-in">
      <h1 className="text-4xl font-bold tracking-wide text-yellow-500 drop-shadow-[0_0_12px_rgba(255,215,0,0.35)] mb-10 animate-gold-glow">
        Classic Cabs Booking
      </h1>

      <div className="w-full max-w-3xl space-y-8">
        <JourneyForm
          pickup={pickup}
          dropoff={dropoff}
          setPickup={setPickup}
          setDropoff={setDropoff}
          stops={stops}
          setStops={setStops}
        />

        <PassengerForm
          passenger={passenger}
          setPassenger={setPassenger}
          seats={seats}
          setSeats={setSeats}
          bags={bags}
          setBags={setBags}
        />

        <TimingForm
          asap={asap}
          setAsap={setAsap}
          pickupTimeUnix={pickupTimeUnix}
          setPickupTimeUnix={setPickupTimeUnix}
          returnTrip={returnTrip}
          setReturnTrip={setReturnTrip}
          returnTimeUnix={returnTimeUnix}
          setReturnTimeUnix={setReturnTimeUnix}
        />

        <button
          onClick={handleFare}
          className="w-full py-4 rounded-xl text-lg font-semibold bg-gradient-to-r from-yellow-600 to-yellow-400 text-black shadow-[0_0_15px_rgba(255,215,0,0.45)] transition-transform duration-300 hover:scale-[1.03] hover:shadow-[0_0_25px_rgba(255,215,0,0.7)]"
        >
          Check Fare
        </button>

        <button
          onClick={handleBooking}
          className="w-full py-4 rounded-xl text-lg font-semibold bg-gradient-to-r from-yellow-500 to-yellow-300 text-black shadow-[0_0_15px_rgba(255,215,0,0.45)] transition-transform duration-300 hover:scale-[1.03] hover:shadow-[0_0_25px_rgba(255,215,0,0.7)]"
        >
          Book Ride
        </button>

        {fareResult && (
          <pre className="bg-white/5 border border-yellow-500/20 p-4 rounded-xl mt-6 text-yellow-200 whitespace-pre-wrap backdrop-blur-md shadow-xl animate-fade-in">
            {JSON.stringify(fareResult, null, 2)}
          </pre>
        )}

        {bookingResult && (
          <pre className="bg-white/5 border border-yellow-500/20 p-4 rounded-xl mt-6 text-yellow-200 whitespace-pre-wrap backdrop-blur-md shadow-xl animate-fade-in">
            {JSON.stringify(bookingResult, null, 2)}
          </pre>
        )}
      </div>

      <style jsx global>{`
        @keyframes goldGlow {
          0%, 100% {
            text-shadow: 0 0 12px rgba(255, 215, 0, 0.3);
          }
          50% {
            text-shadow: 0 0 22px rgba(255, 215, 0, 0.55);
          }
        }
        .animate-gold-glow {
          animation: goldGlow 3s ease-in-out infinite;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .animate-fade-in {
          animation: fadeIn 0.8s ease-out;
        }
      `}</style>
    </div>
  );
}
EOF

# ===================================================================
# FILE 2 — JourneyForm.tsx
# ===================================================================
cat > $ROOT/components/JourneyForm.tsx << 'EOF'
"use client";

import AutocompleteInput from "./AutocompleteInput";
import { searchAddress } from "../lib/api";

export default function JourneyForm({ pickup, dropoff, setPickup, setDropoff, stops, setStops }) {
  function updateStop(i, value) {
    const updated = [...stops];
    updated[i] = value;
    setStops(updated);
  }

  function addStop() {
    setStops([...stops, { address: "", lat: null, lng: null }]);
  }

  function removeStop(i) {
    setStops(stops.filter((_, idx) => idx !== i));
  }

  return (
    <div className="bg-black/40 backdrop-blur-xl border border-yellow-600/20 rounded-xl p-6 shadow-xl mb-6">
      <h2 className="text-yellow-500 text-xl font-semibold mb-4 tracking-wide">
        Journey Details
      </h2>

      <AutocompleteInput label="Pickup" value={pickup} setValue={setPickup} onSearch={searchAddress} />

      {stops.map((stop, i) => (
        <div key={i} className="flex gap-2 items-center">
          <AutocompleteInput
            label={`Stop ${i + 1}`}
            value={stop}
            setValue={(val) => updateStop(i, val)}
            onSearch={searchAddress}
          />
          <button
            onClick={() => removeStop(i)}
            className="px-3 py-2 bg-red-600 text-white rounded-lg"
          >
            ✕
          </button>
        </div>
      ))}

      <button
        onClick={addStop}
        className="mt-3 px-4 py-2 bg-yellow-600 text-black font-semibold rounded-lg shadow hover:bg-yellow-500"
      >
        + Add Stop
      </button>

      <AutocompleteInput
        label="Drop-off"
        value={dropoff}
        setValue={setDropoff}
        onSearch={searchAddress}
      />
    </div>
  );
}
EOF

# ===================================================================
# FILE 3 — PassengerForm.tsx
# ===================================================================
cat > $ROOT/components/PassengerForm.tsx << 'EOF'
"use client";

export default function PassengerForm({ passenger, setPassenger, seats, setSeats, bags, setBags }) {
  return (
    <div className="bg-black/40 backdrop-blur-xl border border-yellow-600/20 rounded-xl p-6 shadow-xl mb-6">
      <h2 className="text-yellow-500 text-xl font-semibold mb-4 tracking-wide">
        Passenger
      </h2>

      <input
        className="w-full p-3 rounded-lg bg-white/10 border border-yellow-600/20 text-white mb-3"
        placeholder="Name"
        value={passenger.name}
        onChange={(e) => setPassenger({ ...passenger, name: e.target.value })}
      />

      <input
        className="w-full p-3 rounded-lg bg-white/10 border border-yellow-600/20 text-white mb-3"
        placeholder="Phone"
        value={passenger.phone}
        onChange={(e) => setPassenger({ ...passenger, phone: e.target.value })}
      />

      <input
        className="w-full p-3 rounded-lg bg-white/10 border border-yellow-600/20 text-white mb-3"
        placeholder="Email"
        value={passenger.email}
        onChange={(e) => setPassenger({ ...passenger, email: e.target.value })}
      />

      <div className="flex gap-4 mt-4">
        <input
          type="number"
          className="flex-1 p-3 rounded-lg bg-white/10 border border-yellow-600/20 text-white"
          placeholder="Seats"
          min={1}
          value={seats}
          onChange={(e) => setSeats(Number(e.target.value))}
        />

        <input
          type="number"
          className="flex-1 p-3 rounded-lg bg-white/10 border border-yellow-600/20 text-white"
          placeholder="Bags"
          min={0}
          value={bags}
          onChange={(e) => setBags(Number(e.target.value))}
        />
      </div>
    </div>
  );
}
EOF

# ===================================================================
# FILE 4 — TimingForm.tsx
# ===================================================================
cat > $ROOT/components/TimingForm.tsx << 'EOF'
"use client";

export default function TimingForm({
  asap,
  setAsap,
  pickupTimeUnix,
  setPickupTimeUnix,
  returnTrip,
  setReturnTrip,
  returnTimeUnix,
  setReturnTimeUnix,
}) {
  return (
    <div className="bg-black/40 backdrop-blur-xl border border-yellow-600/20 rounded-xl p-6 shadow-xl mb-6">
      <h2 className="text-yellow-500 text-xl font-semibold mb-4 tracking-wide">Timing</h2>

      <label className="flex items-center gap-3 mb-3">
        <input type="checkbox" checked={asap} onChange={() => setAsap(!asap)} />
        <span>ASAP</span>
      </label>

      {!asap && (
        <input
          type="datetime-local"
          className="w-full p-3 rounded-lg bg-white/10 border border-yellow-600/20 text-white mb-3"
          onChange={(e) =>
            setPickupTimeUnix(Math.floor(new Date(e.target.value).getTime() / 1000))
          }
        />
      )}

      <label className="flex items-center gap-3 mt-4 mb-3">
        <input
          type="checkbox"
          checked={returnTrip}
          onChange={() => setReturnTrip(!returnTrip)}
        />
        <span>Return Trip</span>
      </label>

      {returnTrip && (
        <input
          type="datetime-local"
          className="w-full p-3 rounded-lg bg-white/10 border border-yellow-600/20 text-white mb-3"
          onChange={(e) =>
            setReturnTimeUnix(Math.floor(new Date(e.target.value).getTime() / 1000))
          }
        />
      )}
    </div>
  );
}
EOF

# ===================================================================
# FILE 5 — AutocompleteInput.tsx
# ===================================================================
cat > $ROOT/components/AutocompleteInput.tsx << 'EOF'
"use client";

import { useState } from "react";

export default function AutocompleteInput({ label, value, setValue, onSearch }) {
  const [suggestions, setSuggestions] = useState([]);

  async function handleChange(e) {
    const text = e.target.value;
    setValue({ ...value, address: text });

    if (text.length < 2) return;

    const results = await onSearch(text);
    setSuggestions(results);
  }

  function applySuggestion(s) {
    setValue({ address: s.label, lat: s.lat, lng: s.lng });
    setSuggestions([]);
  }

  return (
    <div className="mb-4 relative">
      <label className="text-yellow-400 mb-2 block">{label}</label>
      <input
        value={value.address}
        onChange={handleChange}
        className="w-full p-3 rounded-lg bg-white/10 border border-yellow-600/20 text-white"
      />

      {suggestions.length > 0 && (
        <div className="absolute left-0 right-0 bg-black/80 backdrop-blur-xl border border-yellow-500/30 rounded-lg mt-1 z-20 max-h-40 overflow-auto">
          {suggestions.map((s, i) => (
            <div
              key={i}
              onClick={() => applySuggestion(s)}
              className="px-3 py-2 hover:bg-white/10 cursor-pointer border-b border-yellow-500/10"
            >
              {s.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
EOF

# ===================================================================
# FILE 6 — api.ts
# ===================================================================
cat > $ROOT/lib/api.ts << 'EOF'
export async function searchAddress(query) {
  if (!query) return [];

  const cfg = await fetch("http://localhost:4000/config").then((r) => r.json());
  const token = cfg.mapboxToken;

  const url =
    "https://api.mapbox.com/geocoding/v5/mapbox.places/" +
    encodeURIComponent(query) +
    ".json?autocomplete=true&country=gb&limit=5&access_token=" +
    token;

  const r = await fetch(url);
  const data = await r.json();

  return data.features.map((f) => ({
    label: f.place_name,
    lat: f.center[1],
    lng: f.center[0],
  }));
}

export async function checkFareRequest(body) {
  const res = await fetch("/api/fare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function bookRideRequest(body) {
  const res = await fetch("/api/booking", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}
EOF

echo ""
echo "🎉 All luxury UI files installed successfully!"
echo "➡ Run: npm run dev"
