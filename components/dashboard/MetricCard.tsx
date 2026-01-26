'use client';

import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  badge?: ReactNode;
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

export function MetricCard({ icon: Icon, label, value, badge, trend }: MetricCardProps) {
  return (
    <div className="group rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-theme-sm hover:shadow-theme-md hover:-translate-y-1 transition-all duration-300">
      <div className="flex items-center justify-center w-12 h-12 bg-primary-25 dark:bg-primary/[0.12] rounded-xl mb-4 group-hover:scale-110 transition-transform duration-300">
        <Icon className="h-6 w-6 text-primary" />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">{label}</span>
        <div className="flex items-end justify-between gap-2">
          <h4 className="text-2xl font-bold text-gray-900 dark:text-white">
            {value}
          </h4>
          {badge && <div>{badge}</div>}
        </div>
        {trend && (
          <div className="mt-2 flex items-center gap-1">
            <span
              className={`text-xs font-semibold flex items-center gap-0.5 ${
                trend.isPositive ? 'text-success' : 'text-error'
              }`}
            >
              {trend.isPositive ? '↑' : '↓'} {trend.value}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              vs mês anterior
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
