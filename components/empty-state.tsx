'use client';

import { FileSearch, CalendarDays, ClipboardList, BookOpen, RefreshCw } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: 'calendar' | 'clipboard' | 'book' | 'search';
  retry?: () => void;
}

const ICONS = {
  calendar: CalendarDays,
  clipboard: ClipboardList,
  book: BookOpen,
  search: FileSearch,
};

export function EmptyState({ title, description, icon = 'search', retry }: EmptyStateProps) {
  const Icon = ICONS[icon];

  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <Icon className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {description}
          </p>
        )}
        {retry && (
          <button
            onClick={retry}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar novamente
          </button>
        )}
      </div>
    </div>
  );
}
