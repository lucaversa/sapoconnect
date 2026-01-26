'use client';

import { ReactNode } from 'react';

interface StatsCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}

export function StatsCard({ title, description, children, action }: StatsCardProps) {
  return (
    <div className="group rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-theme-sm hover:shadow-theme-md hover:-translate-y-1 transition-all duration-300">
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
          {description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {description}
            </p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}
