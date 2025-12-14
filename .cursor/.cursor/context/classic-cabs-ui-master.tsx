// ================================================
// Classic Cabs — FULL UI MASTER BACKUP
// ================================================
// This file contains ALL UI source code in one place.
// Copy sections back into your project any time.
// ================================================


// =============================================================
// FILE 1 — src/app/page.tsx
// =============================================================
"use client";

import { useState } from "react";
import JourneyForm from "./components/JourneyForm";
import PassengerForm from "./components/PassengerForm";
import TimingForm from "./components/TimingForm";
import { checkFareRequest, bookRideRequest } from "./lib/api";

export default function Page() {
    const [pickup, setPickup] = useState({ address: "", lat: null, lng: null });
    const [dropoff, setDropoff] = useState({ address: "", lat: null, lng: null });
    const [stops, setStops] = useState([]);

    const [passenger, setPassenger] = useState({ name: "", phone: "", email: "" });
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
        <JourneyForm pickup={pickup} dropoff={dropoff} setPickup={setPickup} setDropoff={setDropoff} />
        <PassengerForm passenger={passenger} setPassenger={setPassenger} seats={seats} setSeats={setSeats} bags={bags} setBags={setBags} />
        <TimingForm asap={asap} setAsap={setAsap} pickupTimeUnix={pickupTimeUnix} setPickupTimeUnix={setPickupTimeUnix} returnTrip={returnTrip} setReturnTrip={setReturnTrip} returnTimeUnix={returnTimeUnix} setReturnTimeUnix={setReturnTimeUnix} />

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
                0%, 100% { text-shadow: 0 0 12px rgba(255, 215, 0, 0.3); }
                50% { text-shadow: 0 0 22px rgba(255, 215, 0, 0.55); }
            }
            .animate-gold-glow { animation: goldGlow 3s ease-in-out infinite; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            .animate-fade-in { animation: fadeIn 0.8s ease-out; }
            `}</style>
            </div>
    );
}

// =============================================================
// FILE 2 — src/app/components/JourneyForm.tsx
// =============================================================
"use client";
import AutocompleteInput from "./AutocompleteInput";
import { searchAddress } from "../lib/api";

export default function JourneyForm({ pickup, dropoff, setPickup, setDropoff }) {
    return (
        <div className="bg-black/40 backdrop-blur-xl border border-yellow-600/20 rounded-xl p-6 shadow-xl mb-6">
        <h2 className="text-yellow-500 text-xl font-semibold mb-4 tracking-wide">Journey Details</h2>

        <AutocompleteInput label="Pickup" value={pickup} setValue={setPickup} onSearch={searchAddress} />
        <AutocompleteInput label="Drop-off" value={dropoff} setValue={setDropoff} onSearch={searchAddress} />
        </div>
    );
}

// =============================================================
// FILE 3 — src/app/components/PassengerForm.tsx
// =============================================================
"use client";

export default function PassengerForm({ passenger, setPassenger, seats, setSeats, bags, setBags }) {
    return (
        <div className="bg-black/40 backdrop-blur-xl border border-yellow-600/20 rounded-xl p-6 shadow-xl mb-6">
        <h2 className="text-yellow-500 text-xl font-semibold mb-4 tracking-wide">Passenger</h2>

        <input className="w-full p-3 rounded-lg bg-white/10 border border-yellow-600/20 text-white mb-3" placeholder="Name" value={passenger.name} onChange={(e) => setPassenger({ ...passenger, name: e.target.value })} />
        <input className="w-full p-3 rounded-lg bg-white/10 border border-yellow-600/20 text-white mb-3" placeholder="Phone" value={passenger.phone} onChange={(e) => setPassenger({ ...passenger, phone: e.target.value })} />
        <input className="w-full p-3 rounded-lg bg-white/10 border border-yellow-600/20 text-white mb-3" placeholder="Email" value={passenger.email} onChange={(e) => setPassenger({ ...passenger, email: e.target.value })} />

        <div className="flex gap-4">
        <input
        type="number"
        className="flex-1 p-3 rounded-lg bg-white/10 border border-yellow-600/20 text-white"
        placeholder="Seats"
        value={seats}
        min={1}
        onChange={(e) => setSeats(Number(e.target.value))}
        />

        <input
        type="number"
        className="flex-1 p-3 rounded-lg bg-white/10 border border-yellow-600/20 text-white"
        placeholder="Bags"
        value={bags}
        min={0}
        onChange={(e) => setBags(Number(e.target.value))}
        />
        </div>
        </div>
    );
}
