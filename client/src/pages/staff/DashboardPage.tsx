import React from 'react';
import { useDashboardSummary } from '../../hooks/useStaff.js';
import { Loader } from '../../components/common/Loader.js';
import { ErrorState } from '../../components/common/ErrorState.js';
import { Button } from '../../components/common/Button.js';
import {
  LogIn,
  LogOut,
  BedDouble,
  Percent,
  Clock,
  ArrowRight,
  Sparkles,
  Building2,
  CalendarDays,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: stats, isLoading, error, refetch } = useDashboardSummary();

  if (isLoading) {
    return (
      <div className="py-24 flex justify-center items-center">
        <Loader size="lg" text="Calculating live front-desk KPIs and occupancy..." />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <ErrorState
        title="Could not load staff dashboard"
        message={error instanceof Error ? error.message : 'Please check your network.'}
        onRetry={() => void refetch()}
      />
    );
  }

  const kpis = [
    {
      label: 'Arrivals Today',
      value: stats.arrivalsToday,
      sub: 'Eligible for check-in',
      icon: LogIn,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
    },
    {
      label: 'Departures Today',
      value: stats.departuresToday,
      sub: 'Scheduled for check-out',
      icon: LogOut,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
    },
    {
      label: 'Occupied Rooms',
      value: `${stats.occupiedRooms} / ${stats.totalRooms}`,
      sub: 'Rooms currently in-house',
      icon: BedDouble,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
    },
    {
      label: 'Occupancy Rate',
      value: `${stats.occupancyRate}%`,
      sub: 'Live hotel utilization',
      icon: Percent,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-200',
    },
    {
      label: 'Pending Requests',
      value: stats.pendingCount,
      sub: 'Awaiting confirmation',
      icon: Clock,
      color: 'text-violet-600',
      bgColor: 'bg-violet-50',
      borderColor: 'border-violet-200',
    },
    {
      label: 'Hotel Inventory',
      value: stats.totalRooms,
      sub: 'Total active room units',
      icon: Building2,
      color: 'text-slate-700',
      bgColor: 'bg-slate-100',
      borderColor: 'border-slate-200',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-100">
              <Sparkles className="h-3 w-3" /> Live Operations
            </span>
            <span className="text-xs text-slate-400 font-mono">Date: {stats.today}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Front Desk Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time room occupancy and arrival dispatch
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            icon={CalendarDays}
            onClick={() => navigate('/staff/reservations')}
          >
            All Reservations
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={LogIn}
            onClick={() => navigate('/staff/front-desk')}
          >
            Front Desk Desk Ops
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className={`p-6 rounded-2xl border bg-white shadow-sm flex items-start justify-between transition-shadow hover:shadow-md`}
            >
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {kpi.label}
                </span>
                <div className="text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">
                  {kpi.value}
                </div>
                <p className="text-xs text-slate-500 mt-1">{kpi.sub}</p>
              </div>

              <div className={`p-3 rounded-xl ${kpi.bgColor} ${kpi.color}`}>
                <Icon className="h-6 w-6" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Launch Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-md">
          <div>
            <h3 className="text-lg font-bold">Front Desk Expeditor</h3>
            <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
              Expedite arrivals and departures for today. Front-desk check-in requires scheduled
              date arrival; check-out atomically releases room inventory.
            </p>
          </div>
          <div className="mt-6">
            <Button
              variant="primary"
              size="md"
              icon={ArrowRight}
              iconPosition="right"
              onClick={() => navigate('/staff/front-desk')}
            >
              Open Front Desk Ops
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 flex flex-col justify-between shadow-sm">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Manage Room Inventory</h3>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
              Create and edit room types, view inventory allocations, and update pricing. System
              guards prevent reducing room inventory below committed future bookings.
            </p>
          </div>
          <div className="mt-6">
            <Button
              variant="outline"
              size="md"
              icon={Building2}
              onClick={() => navigate('/staff/rooms')}
            >
              Room Management
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
