import React, { useState } from 'react';
import { useStaffReservations, useCheckIn, useCheckOut } from '../../hooks/useStaff.js';
import { useToast } from '../../context/ToastContext.js';
import { DataTable, Column } from '../../components/common/DataTable.js';
import { Button } from '../../components/common/Button.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { LogIn, LogOut, Calendar, CheckCircle, DoorOpen } from 'lucide-react';
import { StaffReservationItemDto, ApiError } from '../../types/api.js';

export const FrontDeskPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'arrivals' | 'inhouse'>('arrivals');
  const { success, error: toastError } = useToast();

  const today = new Date().toISOString().slice(0, 10);

  // Arrivals query: CONFIRMED reservations with checkIn <= today
  const arrivalsQuery = useStaffReservations({
    status: 'CONFIRMED',
    checkInTo: today,
    limit: 50,
  });

  // In-house query: CHECKED_IN reservations
  const inHouseQuery = useStaffReservations({
    status: 'CHECKED_IN',
    limit: 50,
  });

  const checkInMutation = useCheckIn();
  const checkOutMutation = useCheckOut();

  const handleCheckIn = async (item: StaffReservationItemDto) => {
    try {
      await checkInMutation.mutateAsync(item.id);
      success(
        `Guest ${item.guestDetails.name} checked in successfully for ${item.roomTypeName}`,
        'Checked In',
      );
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toastError(apiErr.message || 'Check-in failed on server', 'Check-In Error');
    }
  };

  const handleCheckOut = async (item: StaffReservationItemDto) => {
    try {
      await checkOutMutation.mutateAsync(item.id);
      success(
        `Guest ${item.guestDetails.name} checked out. Inventory for ${item.roomTypeName} released.`,
        'Checked Out',
      );
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toastError(apiErr.message || 'Check-out failed on server', 'Check-Out Error');
    }
  };

  const arrivalsList = arrivalsQuery.data?.data ?? [];
  const inHouseList = inHouseQuery.data?.data ?? [];

  const arrivalColumns: Column<StaffReservationItemDto>[] = [
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
      header: 'Guest Name',
      render: (item) => (
        <div>
          <span className="font-bold text-slate-800">{item.guestDetails.name}</span>
          <p className="text-xs text-slate-400">{item.guestDetails.email}</p>
        </div>
      ),
    },
    {
      key: 'room',
      header: 'Assigned Room Type',
      render: (item) => (
        <div>
          <span className="font-medium text-slate-800">{item.roomTypeName}</span>
          <p className="text-xs text-slate-400">
            {item.roomCount} room(s) • {item.guestCount} guests
          </p>
        </div>
      ),
    },
    {
      key: 'stay',
      header: 'Stay Window',
      render: (item) => (
        <div className="text-xs text-slate-600 font-medium flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          {item.checkIn} → {item.checkOut}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: 'action',
      header: 'Action',
      render: (item) => (
        <Button
          variant="primary"
          size="sm"
          icon={LogIn}
          isLoading={checkInMutation.isPending}
          onClick={() => handleCheckIn(item)}
        >
          Check In
        </Button>
      ),
    },
  ];

  const inHouseColumns: Column<StaffReservationItemDto>[] = [
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
      header: 'In-House Guest',
      render: (item) => (
        <div>
          <span className="font-bold text-slate-800">{item.guestDetails.name}</span>
          <p className="text-xs text-slate-400">{item.guestDetails.email}</p>
        </div>
      ),
    },
    {
      key: 'room',
      header: 'Occupied Room Type',
      render: (item) => (
        <div>
          <span className="font-medium text-slate-800">{item.roomTypeName}</span>
          <p className="text-xs text-slate-400">{item.roomCount} room(s)</p>
        </div>
      ),
    },
    {
      key: 'checkoutDate',
      header: 'Scheduled Check-Out',
      render: (item) => (
        <div className="text-xs font-medium text-slate-700">
          {item.checkOut}
          {item.checkOut === today && (
            <span className="ml-2 inline-flex items-center px-1.5 py-0.2 rounded text-[10px] bg-amber-100 text-amber-800 font-bold">
              Due Today
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: 'action',
      header: 'Action',
      render: (item) => (
        <Button
          variant="outline"
          size="sm"
          className="border-slate-300 hover:bg-slate-100"
          icon={LogOut}
          isLoading={checkOutMutation.isPending}
          onClick={() => handleCheckOut(item)}
        >
          Check Out
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-100">
              <CheckCircle className="h-3 w-3" /> Live Dispatch Desk
            </span>
            <span className="text-xs text-slate-400 font-mono">Today: {today}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Front Desk Expeditor</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Check in arriving guests and check out departing guests with atomic inventory release
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('arrivals')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'arrivals'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <LogIn className="h-4 w-4" />
          <span>Eligible Arrivals Today ({arrivalsList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('inhouse')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'inhouse'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <DoorOpen className="h-4 w-4" />
          <span>In-House Guests ({inHouseList.length})</span>
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'arrivals' ? (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Reservations confirmed for today or past un-checked-in dates. System strictly rejects
            check-in before the reservation date.
          </p>
          <DataTable
            columns={arrivalColumns}
            data={arrivalsList}
            keyExtractor={(item) => item.id}
            isLoading={arrivalsQuery.isLoading}
            emptyTitle="No arrivals pending today"
            emptyDescription="All confirmed guests for today have been checked in or no arrivals are scheduled."
          />
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Currently checked-in guests occupying hotel rooms. Checking out completes the stay and
            atomically releases room inventory.
          </p>
          <DataTable
            columns={inHouseColumns}
            data={inHouseList}
            keyExtractor={(item) => item.id}
            isLoading={inHouseQuery.isLoading}
            emptyTitle="No in-house guests"
            emptyDescription="There are currently no guests checked into the hotel."
          />
        </div>
      )}
    </div>
  );
};
