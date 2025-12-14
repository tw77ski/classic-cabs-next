"use client";

interface PassengerFormProps {
  passenger: { name: string; phone: string; email: string };
  setPassenger: (val: { name: string; phone: string; email: string }) => void;
  seats: number;
  setSeats: (val: number) => void;
  bags: number;
  setBags: (val: number) => void;
}

export default function PassengerForm({ 
  passenger, 
  setPassenger, 
  seats, 
  setSeats, 
  bags, 
  setBags 
}: PassengerFormProps) {
  return (
    <div className="form-card">
      <h2 className="section-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="8" r="4" />
          <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
        </svg>
        Passenger Details
      </h2>

      {/* Name Input */}
      <div className="mb-3">
        <label 
          className="block text-[#c9a962]/90 text-xs font-medium mb-1.5 tracking-wide"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          Full Name
        </label>
        <div className="input-with-icon">
          <span className="input-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="8" r="4" />
              <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
            </svg>
          </span>
      <input
            className="form-input"
            placeholder="Enter your name"
        value={passenger.name}
        onChange={(e) => setPassenger({ ...passenger, name: e.target.value })}
      />
        </div>
      </div>

      {/* Phone Input */}
      <div className="mb-3">
        <label 
          className="block text-[#c9a962]/90 text-xs font-medium mb-1.5 tracking-wide"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          Phone Number
        </label>
        <div className="input-with-icon">
          <span className="input-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </span>
      <input
            className="form-input"
            placeholder="Enter your phone number"
            type="tel"
        value={passenger.phone}
        onChange={(e) => setPassenger({ ...passenger, phone: e.target.value })}
      />
        </div>
      </div>

      {/* Email Input */}
      <div className="mb-3">
        <label 
          className="block text-[#c9a962]/90 text-xs font-medium mb-1.5 tracking-wide"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          Email Address
        </label>
        <div className="input-with-icon">
          <span className="input-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M22 6l-10 7L2 6" />
            </svg>
          </span>
      <input
            className="form-input"
            placeholder="Enter your email"
            type="email"
        value={passenger.email}
        onChange={(e) => setPassenger({ ...passenger, email: e.target.value })}
      />
        </div>
      </div>

      <div className="gold-divider" />

      {/* Seats and Bags */}
      <div className="grid grid-cols-2 gap-4">
        {/* Seats Counter */}
        <div>
          <label 
            className="block text-[#c9a962]/90 text-xs font-medium mb-2 tracking-wide"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            Passengers
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSeats(Math.max(1, seats - 1))}
              className="counter-btn"
            >
              −
            </button>
            <span className="counter-value">{seats}</span>
            <button
              type="button"
              onClick={() => setSeats(seats + 1)}
              className="counter-btn"
            >
              +
            </button>
          </div>
        </div>

        {/* Bags Counter */}
        <div>
          <label 
            className="block text-[#c9a962]/90 text-xs font-medium mb-2 tracking-wide"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            Luggage
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBags(Math.max(0, bags - 1))}
              className="counter-btn"
            >
              −
            </button>
            <span className="counter-value">{bags}</span>
            <button
              type="button"
              onClick={() => setBags(bags + 1)}
              className="counter-btn"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
