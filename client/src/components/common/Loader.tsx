import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn.js';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

export const Loader: React.FC<LoaderProps> = ({ size = 'md', text, className }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-10 h-10',
  };

  return (
    <div className={cn('flex flex-col items-center justify-center p-4 text-slate-500', className)}>
      <Loader2 className={cn('animate-spin text-indigo-600', sizeClasses[size])} />
      {text && <p className="mt-2 text-sm font-medium text-slate-600">{text}</p>}
    </div>
  );
};
