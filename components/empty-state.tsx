'use client';

import { FileSearch, CalendarDays, ClipboardList, BookOpen, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
      <div className="liquid-float w-full max-w-md rounded-[1.75rem] p-6 text-center sm:p-8">
        <div className="icon-orb mx-auto mb-4 size-16">
          <Icon className="size-7" />
        </div>
        <h3 className="mb-2 text-lg font-extrabold tracking-[-0.03em] text-gray-900 dark:text-white">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {description}
          </p>
        )}
        {retry && (
          <Button onClick={retry} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Tentar novamente
          </Button>
        )}
      </div>
    </div>
  );
}
