import React, { useState, useEffect } from 'react';
import { useStaffReservations, useUpdateReservationStatus } from '../../hooks/useStaff.js';
import { useToast } from '../../context/ToastContext.js';
import { DataTable, Column } from '../../components/common/DataTable.js';
import { Pagination } from '../../components/common/Pagination.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';
import { Select } from '../../components/common/Select.js';
import { Search, Eye, Filter, ArrowUpDown } from 'lucide-react';
import { ReservationStatus, StaffReservationItemDto, ApiError } from '../../types/api.js';

const ALLOWED_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['CHECKED_IN', 'CANCELLED'],
  CHECKED_IN: ['CHECKED_OUT'],
  CHECKED_OUT: [],
  CANCELLED: [],
};

export const ReservationManagementPage: React.FC = () => {
  const { success, error: toastError } = useToast();

  // Search & Filter state
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);
  const [status, setStatus] = useState<string>('');
  const [checkInFrom, setCheckInFrom] = useState<string>('');
  const [checkInTo, setCheckInTo] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'checkIn' | 'checkOut' | 'totalAmount'>(
    'createdAt',
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Selected reservation for drawer/modal
  const [selectedItem, setSelectedItem] = useState<StaffReservationItemDto | null>(null);
  const [targetStatus, setTargetStatus] = useState<string>('');
  const [transitionReason, setTransitionReason] = useState<string>('');

  const updateStatusMutation = useUpdateReservationStatus();

  // Debounce search input (350ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1); // Reset to page 1 on search change
    }, 350);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Reset page to 1 when filters change
  const handleStatusFilterChange = (val: string) => {
    setStatus(val);
    setPage(1);
  };

  const handleDateFilterChange = (from: string, to: string) => {
    setCheckInFrom(from);
    setCheckInTo(to);
    setPage(1);
  };

  const { data, isLoading } = useStaffReservations({
    page,
    limit,
    status: (status as ReservationStatus) || undefined,
    checkInFrom: checkInFrom || undefined,
    checkInTo: checkInTo || undefined,
    search: debouncedSearch.trim() || undefined,
    sortBy,
    sortOrder,
  });

  const reservations = data?.data ?? [];
  const meta = data?.meta ?? { page, limit, total: 0, totalPages: 1 };

  const handleOpenDetail = (item: StaffReservationItemDto) => {
    setSelectedItem(item);
    setTargetStatus('');
    setTransitionReason('');
  };

  const handleUpdateStatus = async () => {
    if (!selectedItem || !targetStatus) return;

    try {
      await updateStatusMutation.mutateAsync({
        id: selectedItem.id,
        status: targetStatus as ReservationStatus,
        reason: transitionReason || 'Staff updated reservation status',
      });
      success(`Status changed to ${targetStatus} successfully`, 'Updated');
      setSelectedItem(null);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toastError(apiErr.message || 'Status transition rejected by server', 'Error');
    }
  };

  const validTransitions = selectedItem ? ALLOWED_TRANSITIONS[selectedItem.status] || [] : [];

  const columns: Column<StaffReservationItemDto>[] = [
    {
      key: 'reference',
      header: 'Reference',
      render: (item) => (
        <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
          {item.reference}
        </span>
      ),
    },
    {
      key: 'guest',
      header: 'Guest Name & Email',
      render: (item) => (
        <div>
          <div className="font-bold text-slate-800">{item.guestDetails.name}</div>
          <div className="text-xs text-slate-400 font-mono">{item.guestDetails.email}</div>
        </div>
      ),
    },
    {
      key: 'roomType',
      header: 'Room Type',
      render: (item) => (
        <div>
          <div className="font-medium text-slate-800">{item.roomTypeName}</div>
          <div className="text-xs text-slate-400">
            {item.roomCount} room(s) • {item.guestCount} guests
          </div>
        </div>
      ),
    },
    {
      key: 'dates',
      header: 'Stay Interval',
      render: (item) => (
        <div className="text-xs text-slate-600 font-medium">
          {item.checkIn} → {item.checkOut}
        </div>
      ),
    },
    {
      key: 'totalAmount',
      header: 'Amount',
      render: (item) => <span className="font-bold text-slate-900">${item.totalAmount}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: 'actions',
      header: 'Action',
      render: (item) => (
        <Button variant="outline" size="sm" icon={Eye} onClick={() => handleOpenDetail(item)}>
          View / Edit
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Reservation Management</h1>
        <p className="text-xs text-slate-500 mt-1">
          Server-paginated reservation records with filter, regex-safe search, and state transition
          enforcement
        </p>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by reference, guest name or email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Filter className="h-3.5 w-3.5" />
              <span>Status:</span>
            </div>
            <select
              value={status}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
              className="text-xs font-medium rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">All Statuses</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="CHECKED_IN">CHECKED_IN</option>
              <option value="CHECKED_OUT">CHECKED_OUT</option>
              <option value="PENDING">PENDING</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>

            <div className="flex items-center gap-1.5 text-xs text-slate-500 ml-2">
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span>Sort:</span>
            </div>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split('-') as [typeof sortBy, typeof sortOrder];
                setSortBy(sb);
                setSortOrder(so);
              }}
              className="text-xs font-medium rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              <option value="createdAt-desc">Newest First</option>
              <option value="createdAt-asc">Oldest First</option>
              <option value="checkIn-asc">Check-In (Earliest)</option>
              <option value="checkIn-desc">Check-In (Latest)</option>
              <option value="totalAmount-desc">Highest Amount</option>
            </select>
          </div>
        </div>

        {/* Date Filter Range */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 text-xs">
          <span className="font-semibold text-slate-600">Check-In Date Range:</span>
          <input
            type="date"
            value={checkInFrom}
            onChange={(e) => handleDateFilterChange(e.target.value, checkInTo)}
            className="px-2 py-1 rounded border border-slate-300 bg-white"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={checkInTo}
            onChange={(e) => handleDateFilterChange(checkInFrom, e.target.value)}
            className="px-2 py-1 rounded border border-slate-300 bg-white"
          />
          {(checkInFrom || checkInTo || status || searchInput) && (
            <button
              onClick={() => {
                setStatus('');
                setCheckInFrom('');
                setCheckInTo('');
                setSearchInput('');
                setPage(1);
              }}
              className="text-indigo-600 hover:text-indigo-800 font-semibold underline ml-2"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={reservations}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        emptyTitle="No reservations found"
        emptyDescription="Try adjusting your search criteria or resetting filters."
      />

      {/* Pagination */}
      <Pagination meta={meta} onPageChange={setPage} className="rounded-xl border shadow-sm" />

      {/* Detail / Status Transition Modal */}
      <Modal
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        title="Reservation Details & State Machine"
        description={`Ref: ${selectedItem?.reference}`}
        maxWidth="lg"
      >
        {selectedItem && (
          <div className="space-y-5">
            {/* Summary Grid */}
            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400">Guest:</span>
                <p className="font-bold text-slate-800">{selectedItem.guestDetails.name}</p>
                <p className="text-slate-500">{selectedItem.guestDetails.email}</p>
              </div>
              <div>
                <span className="text-slate-400">Current Status:</span>
                <div className="mt-0.5">
                  <StatusBadge status={selectedItem.status} />
                </div>
              </div>
              <div>
                <span className="text-slate-400">Dates:</span>
                <p className="font-bold text-slate-800">
                  {selectedItem.checkIn} to {selectedItem.checkOut}
                </p>
              </div>
              <div>
                <span className="text-slate-400">Total Price:</span>
                <p className="font-bold text-indigo-700 text-sm">${selectedItem.totalAmount}</p>
              </div>
            </div>

            {/* Lifecycle History */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Status History Audit Trail
              </h4>
              <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl p-3 bg-white text-xs">
                {selectedItem.statusHistory.map((h, i) => (
                  <div key={i} className="py-1.5 flex justify-between items-center">
                    <div>
                      <span className="font-semibold text-slate-800">
                        {h.fromStatus ? `${h.fromStatus} → ` : ''}
                        {h.toStatus}
                      </span>
                      {h.reason && <p className="text-[11px] text-slate-500 italic">{h.reason}</p>}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {new Date(h.changedAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Transition Control (Server-Enforced State Machine) */}
            <div className="pt-3 border-t border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Authorized Next Transition
              </h4>

              {validTransitions.length === 0 ? (
                <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-lg border border-slate-200">
                  This reservation is in terminal state ({selectedItem.status}). No further state
                  changes are allowed.
                </p>
              ) : (
                <div className="space-y-3">
                  <Select
                    label="Choose Destination State"
                    value={targetStatus}
                    onChange={(e) => setTargetStatus(e.target.value)}
                    options={[
                      { value: '', label: 'Select allowed transition...' },
                      ...validTransitions.map((s) => ({ value: s, label: `Transition to ${s}` })),
                    ]}
                  />

                  <Input
                    label="Audit Reason"
                    placeholder="e.g. Front desk expedited check-in, guest request"
                    value={transitionReason}
                    onChange={(e) => setTransitionReason(e.target.value)}
                  />

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedItem(null)}>
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={!targetStatus}
                      isLoading={updateStatusMutation.isPending}
                      onClick={handleUpdateStatus}
                    >
                      Apply State Transition
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
