'use client';

import { AppSidebar, MobileNav } from '@/components/layout/AppSidebar';
import { AppHeader } from '@/components/layout/AppHeader';
import { CommunityLaunchDialog } from '@/components/modals/CommunityLaunchDialog';
import { FirstLoginGuideDialog } from '@/components/modals/FirstLoginGuideDialog';
import { SessionProvider } from '@/lib/session-provider';
import { Providers } from './providers';

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppSidebar />
      <AppHeader />
      <main className="app-shell min-h-[100dvh] pb-[calc(5.25rem+env(safe-area-inset-bottom))] pt-[calc(4rem+env(safe-area-inset-top))] lg:ml-72 lg:pb-0">
        {children}
      </main>
      <MobileNav />
      <FirstLoginGuideDialog />
      <CommunityLaunchDialog />
    </>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Providers>
        <AppLayoutContent>{children}</AppLayoutContent>
      </Providers>
    </SessionProvider>
  );
}
