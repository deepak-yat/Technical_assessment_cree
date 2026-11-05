import React, { useState } from 'react';
import { useRoomTypes } from '../../hooks/useRoomTypes.js';
import { Loader } from '../../components/common/Loader.js';
import { ErrorState } from '../../components/common/ErrorState.js';
import { EmptyState } from '../../components/common/EmptyState.js';
import { Pagination } from '../../components/common/Pagination.js';
import { Button } from '../../components/common/Button.js';
import { Users, Sparkles, Bed, CalendarCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export const RoomsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const limit = 6;
  const navigate = useNavigate();

  const { data, isLoading, error, refetch } = useRoomTypes(page, limit);

  if (isLoading) {
    return (
      <div className="py-24 flex justify-center items-center">
        <Loader size="lg" text="Loading luxury room types..." />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Could not load room types"
        message={error instanceof Error ? error.message : 'Please check your connection.'}
        onRetry={() => void refetch()}
      />
    );
  }

  const roomTypes = data?.data ?? [];
  const meta = data?.meta ?? { page: 1, limit, total: 0, totalPages: 1 };

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white p-8 sm:p-12 shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-300 backdrop-blur mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Grand Horizon Hotel</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Exceptional comfort & elegance tailored for you
          </h1>
          <p className="mt-3 text-sm sm:text-base text-slate-300">
            Browse our hand-crafted rooms and luxury suites. All availability is guaranteed by
            real-time atomic inventory reservation.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              variant="primary"
              size="md"
              icon={CalendarCheck}
              onClick={() => navigate('/search')}
            >
              Check Availability
            </Button>
          </div>
        </div>
      </div>

      {/* Room Types Grid */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Featured Accommodations</h2>
            <p className="text-xs text-slate-500 mt-0.5">Showing available active room types</p>
          </div>
        </div>

        {roomTypes.length === 0 ? (
          <EmptyState
            title="No room types available"
            description="There are currently no active room types listed. Please check back later."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roomTypes.map((room) => (
              <div
                key={room.id}
                className="group flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200"
              >
                {/* Image */}
                <div className="relative h-48 w-full bg-slate-100 overflow-hidden">
                  {room.imageUrl ? (
                    <img
                      src={room.imageUrl}
                      alt={room.name}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
                      <Bed className="h-10 w-10" />
                    </div>
                  )}
                  <div className="absolute top-3 right-3 rounded-full bg-white/90 backdrop-blur px-2.5 py-1 text-xs font-bold text-slate-800 shadow-sm">
                    ${room.pricePerNight}{' '}
                    <span className="text-[10px] font-normal text-slate-500">/ night</span>
                  </div>
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <h3 className="font-bold text-base text-slate-900">{room.name}</h3>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      <span>Up to {room.capacity}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 mb-4 leading-relaxed">
                    {room.description}
                  </p>

                  {/* Facilities tags */}
                  {room.facilities.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-5">
                      {room.facilities.slice(0, 3).map((f, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-medium text-slate-600"
                        >
                          {f}
                        </span>
                      ))}
                      {room.facilities.length > 3 && (
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-[11px] text-slate-400">
                          +{room.facilities.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Bottom Action */}
                  <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">
                      {room.totalInventory} total {room.totalInventory === 1 ? 'room' : 'rooms'}
                    </span>
                    <Link to={`/rooms/${room.id}`}>
                      <Button variant="outline" size="sm">
                        View & Book
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Pagination meta={meta} onPageChange={setPage} className="mt-8 rounded-xl" />
      </div>
    </div>
  );
};
