import React, { useState } from 'react';
import { useMyReservations, useCancelReservation } from '../../hooks/useReservations.js';
import { useRoomTypes } from '../../hooks/useRoomTypes.js';
import { useToast } from '../../context/ToastContext.js';
import { Loader } from '../../components/common/Loader.js';
import { ErrorState } from '../../components/common/ErrorState.js';
import { EmptyState } from '../../components/common/EmptyState.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { Pagination } from '../../components/common/Pagination.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';
import { Calendar, History, XCircle, Ban, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ReservationDto, ApiError } from '../../types/api.js';

export const MyReservationsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const limit = 5;
  const { success, error: toastError } = useToast();

  const { data, isLoading, error, refetch } = useMyReservations(page, limit);
  const { data: roomTypesData } = useRoomTypes(1, 100);

  // Modal states
  const [selectedForHistory, setSelectedForHistory] = useState<ReservationDto | null>(null);
  const [selectedForCancel, setSelectedForCancel] = useState<ReservationDto | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');

  const cancelMutation = useCancelReservation();

  const roomTypeMap = React.useMemo(() => {
    const map = new Map<string, string>();
    if (roomTypesData?.data) {
      for (const rt of roomTypesData.data) {
        map.set(rt.id, rt.name);
      }
    }
    return map;
  }, [roomTypesData]);

  if (isLoading) {
    return (
      <div className="py-24 flex justify-center items-center">
        <Loader size="lg" text="Loading your reservations..." />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Could not load your reservations"
        message={error instanceof Error ? error.message : 'Please try again later.'}
        onRetry={() => void refetch()}
      />
    );
  }

  const reservations = data?.data ?? [];
  const meta = data?.meta ?? { page: 1, limit, total: 0, totalPages: 1 };
  const today = new Date().toISOString().slice(0, 10);

  const isEligibleForCancel = (res: ReservationDto): boolean => {
    const isStatusEligible = res.status === 'PENDING' || res.status === 'CONFIRMED';
    const isBeforeCheckIn = res.checkIn > today;
    return isStatusEligible && isBeforeCheckIn;
  };

  const handleConfirmCancel = async () => {
    if (!selectedForCancel) return;

    try {
      await cancelMutation.mutateAsync({
        id: selectedForCancel.id,
        reason: cancelReason || 'Guest cancellation from web portal',
      });
      success(
        `Reservation ${selectedForCancel.reference} was cancelled and inventory freed`,
        'Cancelled',
      );
      setSelectedForCancel(null);
      setCancelReason('');
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toastError(apiErr.message || 'Cancellation rejected by server', 'Error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Reservations</h1>
          <p className="text-xs text-slate-500 mt-1">
            Review your upcoming and past bookings, track status changes, and manage cancellations
          </p>
        </div>
        <Link to="/search">
          <Button variant="primary" size="sm" icon={Calendar}>
            Book New Stay
          </Button>
        </Link>
      </div>

      {reservations.length === 0 ? (
        <EmptyState
          title="No reservations yet"
          description="You haven't booked any stays with Grand Horizon Hotel yet."
          action={
            <Link to="/search">
              <Button variant="primary" size="sm" icon={ArrowRight} iconPosition="right">
                Explore Rooms & Dates
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {reservations.map((res) => {
            const canCancel = isEligibleForCancel(res);
            const roomName = roomTypeMap.get(res.roomTypeId) || 'Hotel Room';

            return (
              <div
                key={res.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-5 transition-shadow hover:shadow-md"
              >
                {/* Left Info */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                      {res.reference}
                    </span>
                    <StatusBadge status={res.status} />
                  </div>

                  <h3 className="text-base font-bold text-slate-900">{roomName}</h3>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1 font-medium text-slate-700">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      {res.checkIn} → {res.checkOut}
                    </span>
                    <span>•</span>
                    <span>
                      {res.guestCount} {res.guestCount === 1 ? 'Guest' : 'Guests'}, {res.roomCount}{' '}
                      {res.roomCount === 1 ? 'Room' : 'Rooms'}
                    </span>
                    <span>•</span>
                    <span className="font-bold text-slate-900">${res.totalAmount} Total</span>
                  </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={History}
                    onClick={() => setSelectedForHistory(res)}
                  >
                    History
                  </Button>

                  {canCancel ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-rose-200 text-rose-600 hover:bg-rose-50"
                      icon={XCircle}
                      onClick={() => setSelectedForCancel(res)}
                    >
                      Cancel Booking
                    </Button>
                  ) : res.status === 'CANCELLED' ? (
                    <span className="text-xs text-slate-400 italic">Cancelled</span>
                  ) : res.status === 'CHECKED_OUT' ? (
                    <span className="text-xs text-slate-400 italic">Completed</span>
                  ) : res.status === 'CHECKED_IN' ? (
                    <span className="text-xs text-indigo-600 font-medium">Currently In-House</span>
                  ) : null}
                </div>
              </div>
            );
          })}

          <Pagination meta={meta} onPageChange={setPage} className="rounded-xl border shadow-sm" />
        </div>
      )}

      {/* Status History Modal */}
      <Modal
        isOpen={!!selectedForHistory}
        onClose={() => setSelectedForHistory(null)}
        title="Reservation Lifecycle & Status History"
        description={`Reference: ${selectedForHistory?.reference}`}
      >
        <div className="space-y-4">
          <div className="divide-y divide-slate-100">
            {selectedForHistory?.statusHistory.map((entry, idx) => (
              <div key={idx} className="py-3 flex items-start gap-3 text-xs">
                <div className="h-2 w-2 rounded-full bg-indigo-600 mt-1.5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">
                      {entry.fromStatus ? `${entry.fromStatus} → ` : ''}
                      {entry.toStatus}
                    </span>
                    <span className="text-slate-400">
                      {new Date(entry.changedAt).toLocaleString()}
                    </span>
                  </div>
                  {entry.reason && (
                    <p className="mt-1 text-slate-500 italic">&ldquo;{entry.reason}&rdquo;</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="w-full mt-4"
            onClick={() => setSelectedForHistory(null)}
          >
            Close
          </Button>
        </div>
      </Modal>

      {/* Cancellation Confirmation Modal */}
      <Modal
        isOpen={!!selectedForCancel}
        onClose={() => setSelectedForCancel(null)}
        title="Confirm Reservation Cancellation"
        description={`Are you sure you want to cancel ${selectedForCancel?.reference}?`}
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <Ban className="h-4 w-4" />
              This will immediately release your room back to hotel inventory.
            </p>
            <p className="text-rose-600">
              Cancellations are enforced with exactly-once server semantics and cannot be undone.
            </p>
          </div>

          <Input
            label="Cancellation Reason (Optional)"
            placeholder="e.g. Flight rescheduled, change of plans"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedForCancel(null)}>
              Keep Reservation
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={cancelMutation.isPending}
              onClick={handleConfirmCancel}
            >
              Confirm Cancellation
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
