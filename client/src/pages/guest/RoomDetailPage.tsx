import React, { useState, useRef, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useRoomType, useAvailabilitySearch } from '../../hooks/useRoomTypes.js';
import { useCreateReservation } from '../../hooks/useReservations.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { Loader } from '../../components/common/Loader.js';
import { ErrorState } from '../../components/common/ErrorState.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';
import { Users, CheckCircle, Bed, Check, ShieldAlert } from 'lucide-react';
import { ApiError, ReservationDto } from '../../types/api.js';

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

export const RoomDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { error: toastError } = useToast();

  // Selected parameters (strings strictly YYYY-MM-DD)
  const [checkIn, setCheckIn] = useState<string>(searchParams.get('checkIn') || getTomorrow());
  const [checkOut, setCheckOut] = useState<string>(
    searchParams.get('checkOut') || getThreeDaysLater(),
  );
  const [guests, setGuests] = useState<number>(parseInt(searchParams.get('guests') || '1', 10));
  const [roomCount, setRoomCount] = useState<number>(1);

  // Stable Idempotency-Key per booking attempt (reused on retry)
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  // Result state
  const [bookedReservation, setBookedReservation] = useState<ReservationDto | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);

  const { data: room, isLoading: isLoadingRoom, error: roomError } = useRoomType(id);

  // Server-computed availability and price preview query
  const { data: searchResults, isFetching: isCheckingPrice } = useAvailabilitySearch(
    room ? { checkIn, checkOut, guests } : null,
  );

  const createReservationMutation = useCreateReservation();

  // Find server-calculated item for this room
  const availabilityItem = searchResults?.find((item) => item.roomType.id === id);

  // Reset idempotency key if user changes dates
  useEffect(() => {
    idempotencyKeyRef.current = crypto.randomUUID();
    setConflictError(null);
  }, [checkIn, checkOut, guests, roomCount]);

  if (isLoadingRoom) {
    return (
      <div className="py-24 flex justify-center items-center">
        <Loader size="lg" text="Loading room details..." />
      </div>
    );
  }

  if (roomError || !room) {
    return (
      <ErrorState
        title="Room not found"
        message={
          roomError instanceof Error
            ? roomError.message
            : 'The requested room type could not be loaded.'
        }
        onRetry={() => navigate('/')}
      />
    );
  }

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setConflictError(null);

    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: `/rooms/${id}` } } });
      return;
    }

    try {
      const res = await createReservationMutation.mutateAsync({
        input: {
          roomTypeId: room.id,
          checkIn,
          checkOut,
          guestCount: guests,
          roomCount,
        },
        idempotencyKey: idempotencyKeyRef.current,
      });

      setBookedReservation(res);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      if (apiErr.status === 409) {
        setConflictError(
          apiErr.message ||
            'Insufficient room inventory for the chosen dates. Another guest may have just reserved this room.',
        );
      } else {
        toastError(apiErr.message || 'Booking failed', 'Error');
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Success View */}
      {bookedReservation ? (
        <div className="bg-white rounded-3xl border border-emerald-200 p-8 sm:p-12 text-center shadow-lg animate-in zoom-in-95 duration-200">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-4">
            <CheckCircle className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Reservation Confirmed!</h2>
          <p className="mt-1 text-sm text-slate-600">
            Your booking is safely recorded with guaranteed inventory.
          </p>

          <div className="mt-6 inline-block bg-slate-50 border border-slate-200 rounded-2xl p-6 text-left max-w-md w-full">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase">
                Booking Reference
              </span>
              <span className="font-mono font-bold text-indigo-700 text-sm">
                {bookedReservation.reference}
              </span>
            </div>
            <div className="mt-3 space-y-2 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Room Type:</span>
                <span className="font-semibold text-slate-800">{room.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Check-in:</span>
                <span className="font-semibold text-slate-800">{bookedReservation.checkIn}</span>
              </div>
              <div className="flex justify-between">
                <span>Check-out:</span>
                <span className="font-semibold text-slate-800">{bookedReservation.checkOut}</span>
              </div>
              <div className="flex justify-between">
                <span>Guests & Rooms:</span>
                <span className="font-semibold text-slate-800">
                  {bookedReservation.guestCount} guests, {bookedReservation.roomCount} room
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 text-sm">
                <span className="font-bold text-slate-800">Total Paid:</span>
                <span className="font-bold text-indigo-700">${bookedReservation.totalAmount}</span>
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-center gap-3">
            <Button variant="primary" onClick={() => navigate('/my-reservations')}>
              View My Reservations
            </Button>
            <Button variant="outline" onClick={() => navigate('/')}>
              Browse More Rooms
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Room Details Left Column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="relative h-72 sm:h-96 w-full bg-slate-100">
                {room.imageUrl ? (
                  <img src={room.imageUrl} alt={room.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-400">
                    <Bed className="h-16 w-16" />
                  </div>
                )}
                <div className="absolute top-4 right-4 rounded-full bg-white/95 backdrop-blur px-3 py-1.5 text-sm font-bold text-slate-900 shadow">
                  ${room.pricePerNight}{' '}
                  <span className="text-xs font-normal text-slate-500">/ night</span>
                </div>
              </div>

              <div className="p-6 sm:p-8 space-y-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-2xl font-bold text-slate-900">{room.name}</h1>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                      <Users className="h-3.5 w-3.5" /> Up to {room.capacity} Guests
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">{room.description}</p>
                </div>

                {room.facilities.length > 0 && (
                  <div className="border-t border-slate-100 pt-6">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                      Included Amenities & Facilities
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {room.facilities.map((facility, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-xs font-medium text-slate-700"
                        >
                          <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>{facility}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Booking Card Right Column */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm sticky top-24 space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-900">Book Your Stay</h3>
                <p className="text-xs text-slate-500 mt-0.5">Real-time atomic reservation engine</p>
              </div>

              {/* Conflict Alert (409 Insufficient Inventory) */}
              {conflictError && (
                <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-800 text-xs space-y-2 animate-in fade-in">
                  <div className="flex items-center gap-1.5 font-bold">
                    <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
                    <span>Unavailable: Sold Out</span>
                  </div>
                  <p className="leading-relaxed">{conflictError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2 border-rose-300 text-rose-700 hover:bg-rose-100"
                    onClick={() => navigate('/search')}
                  >
                    Search Other Dates
                  </Button>
                </div>
              )}

              <form onSubmit={handleBooking} className="space-y-4">
                <Input
                  label="Check-in"
                  type="date"
                  value={checkIn}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setCheckIn(e.target.value)}
                  required
                />

                <Input
                  label="Check-out"
                  type="date"
                  value={checkOut}
                  min={checkIn}
                  onChange={(e) => setCheckOut(e.target.value)}
                  required
                />

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Guests"
                    type="number"
                    min={1}
                    max={room.capacity * roomCount}
                    value={guests}
                    onChange={(e) => setGuests(parseInt(e.target.value, 10) || 1)}
                    required
                  />

                  <Input
                    label="Rooms"
                    type="number"
                    min={1}
                    max={room.totalInventory}
                    value={roomCount}
                    onChange={(e) => setRoomCount(parseInt(e.target.value, 10) || 1)}
                    required
                  />
                </div>

                {/* Server-Calculated Price Preview Box */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Rate:</span>
                    <span>${room.pricePerNight} / night</span>
                  </div>

                  {availabilityItem && (
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Stay Duration:</span>
                      <span>{availabilityItem.nightsCount} nights</span>
                    </div>
                  )}

                  {isCheckingPrice ? (
                    <div className="py-2 flex justify-center text-xs text-slate-400">
                      <Loader size="sm" text="Calculating stay total..." />
                    </div>
                  ) : availabilityItem ? (
                    <div className="pt-2 border-t border-slate-200 flex items-baseline justify-between">
                      <span className="text-xs font-bold text-slate-700">Server Total:</span>
                      <span className="text-xl font-bold text-indigo-700">
                        ${availabilityItem.totalPrice * roomCount}
                      </span>
                    </div>
                  ) : null}
                </div>

                {/* Submit button */}
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full shadow-md"
                  isLoading={createReservationMutation.isPending}
                >
                  {isAuthenticated ? 'Confirm & Reserve Room' : 'Sign in to Reserve'}
                </Button>

                <p className="text-[11px] text-center text-slate-400">
                  Protected by Idempotency-Key: safe from double-charges or multiple reservations.
                </p>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
