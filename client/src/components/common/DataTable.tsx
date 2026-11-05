import React from 'react';
import { Loader } from './Loader.js';
import { EmptyState } from './EmptyState.js';
import { cn } from '../../utils/cn.js';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no items to display matching your criteria.',
  className,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="py-16 bg-white rounded-xl border border-slate-200 flex justify-center items-center">
        <Loader size="md" text="Loading data..." />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState title={emptyTitle} description={emptyDescription} className="my-4 bg-white" />
    );
  }

  return (
    <div
      className={cn(
        'overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm',
        className,
      )}
    >
      <table className="w-full text-left text-sm text-slate-700">
        <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <tr>
            {columns.map((col) => (
              <th key={col.key} scope="col" className={cn('px-4 py-3.5', col.className)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((item) => (
            <tr key={keyExtractor(item)} className="hover:bg-slate-50/75 transition-colors">
              {columns.map((col) => (
                <td key={col.key} className={cn('px-4 py-3.5 whitespace-nowrap', col.className)}>
                  {col.render
                    ? col.render(item)
                    : ((item as Record<string, unknown>)[col.key] as React.ReactNode)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
