'use client';

import { useSidebar } from '@/context/SidebarContext';

export function Backdrop() {
  const { isMobileOpen, toggleMobileSidebar } = useSidebar();

  if (!isMobileOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300"
      onClick={toggleMobileSidebar}
    />
  );
}
