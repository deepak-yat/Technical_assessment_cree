import React from 'react';
import { ReservationStatus } from '../../types/api.js';
import { cn } from '../../utils/cn.js';

interface StatusBadgeProps {
  status: ReservationStatus | string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const statusStyles: Record<string, string> = {
    CONFIRMED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    CHECKED_IN: 'bg-blue-50 text-blue-700 border-blue-200',
    CHECKED_OUT: 'bg-slate-100 text-slate-600 border-slate-200',
    PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
    CANCELLED: 'bg-rose-50 text-rose-700 border-rose-200',
  };

  const style = statusStyles[status] ?? 'bg-slate-50 text-slate-600 border-slate-200';

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border',
        style,
        className,
      )}
    >
      {status.replace('_', ' ')}
    </span>
  );
};
