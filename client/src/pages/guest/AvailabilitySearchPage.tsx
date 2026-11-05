import React, { useState } from 'react';
import { useAvailabilitySearch } from '../../hooks/useRoomTypes.js';
import { AvailabilitySearchParams } from '../../api/room-types.api.js';
import { Input } from '../../components/common/Input.js';
import { Button } from '../../components/common/Button.js';
import { Loader } from '../../components/common/Loader.js';
import { ErrorState } from '../../components/common/ErrorState.js';
import { EmptyState } from '../../components/common/EmptyState.js';
import { Search, Users, Calendar, ArrowRight, Ban, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function getTomorrow(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function getThreeDaysLater(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 3);
  return d.toISOString().slice(0, 10);
}

export const AvailabilitySearchPage: React.FC = () => {
  const navigate = useNavigate();

  // Search parameters state (strings formatted strictly as YYYY-MM-DD)
  const [checkIn, setCheckIn] = useState<string>(getTomorrow());
  const [checkOut, setCheckOut] = useState<string>(getThreeDaysLater());
  const [guests, setGuests] = useState<number>(2);

  const [activeParams, setActiveParams] = useState<AvailabilitySearchParams | null>({
    checkIn: getTomorrow(),
    checkOut: getThreeDaysLater(),
    guests: 2,
  });

  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, isFetching, error, refetch } = useAvailabilitySearch(activeParams);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Client-side validation for UX
    const today = new Date().toISOString().slice(0, 10);
    if (checkIn < today) {
      setFormError('Check-in date cannot be in the past');
      return;
    }
    if (checkOut <= checkIn) {
      setFormError('Check-out date must be strictly after check-in date');
      return;
    }
    if (guests < 1) {
      setFormError('Guest count must be at least 1');
      return;
    }

    setActiveParams({ checkIn, checkOut, guests });
  };

  const results = data ?? [];

  return (
    <div className="space-y-8">
      {/* Search Header Form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4 text-slate-800">
          <Calendar className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-bold">Search Room Availability</h2>
        </div>

        <form
          onSubmit={handleSearch}
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end"
        >
          <Input
            label="Check-in Date"
            type="date"
            value={checkIn}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setCheckIn(e.target.value)}
            required
          />

          <Input
            label="Check-out Date"
            type="date"
            value={checkOut}
            min={checkIn}
            onChange={(e) => setCheckOut(e.target.value)}
            required
          />

          <Input
            label="Guests"
            type="number"
            min={1}
            max={10}
            value={guests}
            onChange={(e) => setGuests(parseInt(e.target.value, 10) || 1)}
            required
          />

          <Button
            type="submit"
            variant="primary"
            icon={Search}
            className="w-full"
            isLoading={isFetching}
          >
            Find Rooms
          </Button>
        </form>

        {formError && <p className="mt-3 text-xs font-semibold text-rose-500">{formError}</p>}
      </div>

      {/* Results Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-900">Available Stays ({results.length})</h3>
          {activeParams && (
            <span className="text-xs text-slate-500">
              {activeParams.checkIn} to {activeParams.checkOut} • {activeParams.guests}{' '}
              {activeParams.guests === 1 ? 'guest' : 'guests'}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="py-20 flex justify-center items-center bg-white rounded-2xl border border-slate-200">
            <Loader size="lg" text="Searching atomic inventory for available nights..." />
          </div>
        ) : error ? (
          <ErrorState
            title="Search failed"
            message={error instanceof Error ? error.message : 'Failed to query inventory'}
            onRetry={() => void refetch()}
          />
        ) : results.length === 0 ? (
          <EmptyState
            title="No matching rooms found"
            description="No room types accommodate this number of guests. Try reducing the guest count or choosing different dates."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.map((item) => {
              const { roomType, nightsCount, availableRooms, totalPrice, isAvailable } = item;

              return (
                <div
                  key={roomType.id}
                  className={`flex flex-col bg-white rounded-2xl border overflow-hidden shadow-sm transition-all ${
                    isAvailable
                      ? 'border-slate-200 hover:border-indigo-300 hover:shadow-md'
                      : 'border-slate-200 opacity-75 bg-slate-50/50'
                  }`}
                >
                  {/* Image */}
                  <div className="relative h-44 w-full bg-slate-100 overflow-hidden">
                    {roomType.imageUrl ? (
                      <img
                        src={roomType.imageUrl}
                        alt={roomType.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-400">
                        <Users className="h-8 w-8" />
                      </div>
                    )}

                    {/* Availability Badge */}
                    <div className="absolute top-3 right-3">
                      {isAvailable ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-sm">
                          <CheckCircle2 className="h-3 w-3" />
                          {availableRooms} {availableRooms === 1 ? 'room' : 'rooms'} left
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-600 text-white shadow-sm">
                          <Ban className="h-3 w-3" />
                          Sold Out
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-center justify-between mb-1.5">
                      <h4 className="font-bold text-base text-slate-900">{roomType.name}</h4>
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Users className="h-3.5 w-3.5 text-slate-400" />
                        <span>Cap: {roomType.capacity}</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2 mb-4 leading-relaxed">
                      {roomType.description}
                    </p>

                    {/* Price Breakdown from SERVER */}
                    <div className="mt-auto p-3 rounded-xl bg-slate-50 border border-slate-100 mb-4">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>
                          ${roomType.pricePerNight} × {nightsCount}{' '}
                          {nightsCount === 1 ? 'night' : 'nights'}
                        </span>
                        <span className="font-semibold text-slate-700">Per room</span>
                      </div>
                      <div className="flex items-baseline justify-between mt-1 pt-1 border-t border-slate-200/50">
                        <span className="text-xs font-semibold text-slate-700">Total Price:</span>
                        <span className="text-lg font-bold text-indigo-700">${totalPrice}</span>
                      </div>
                    </div>

                    {/* Reserve Action */}
                    <Button
                      variant={isAvailable ? 'primary' : 'outline'}
                      size="md"
                      disabled={!isAvailable}
                      className="w-full"
                      icon={isAvailable ? ArrowRight : undefined}
                      iconPosition="right"
                      onClick={() =>
                        navigate(
                          `/rooms/${roomType.id}?checkIn=${activeParams?.checkIn}&checkOut=${activeParams?.checkOut}&guests=${activeParams?.guests}`,
                        )
                      }
                    >
                      {isAvailable ? 'Book This Room' : 'Unavailable for Dates'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
