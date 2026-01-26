'use client';

import { AppSidebar } from '@/components/layout/AppSidebar';
import { AppHeader } from '@/components/layout/AppHeader';
import { Backdrop } from '@/components/layout/Backdrop';
import { ThemeChoiceModal } from '@/components/modals/ThemeChoiceModal';
import { IOSHomescreenAutoModal } from '@/components/modals/IOSHomescreenModal';
import { useSidebar } from '@/context/SidebarContext';
import { Providers } from './providers';

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const { isExpanded, isHovered } = useSidebar();
  const marginLeft = isExpanded || isHovered ? 'lg:ml-64' : 'lg:ml-20';

  return (
    <>
      <Backdrop />
      <ThemeChoiceModal />
      <IOSHomescreenAutoModal />
      <AppSidebar />
      <AppHeader />
      <main className={`pt-20 transition-all duration-300 ease-in-out ${marginLeft}`}>
        <div className="p-4 lg:p-6">{children}</div>
      </main>
    </>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <AppLayoutContent>{children}</AppLayoutContent>
    </Providers>
  );
}
