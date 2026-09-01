import { AppSidebar, MobileNav } from '@/components/layout/AppSidebar';
import { AppHeader } from '@/components/layout/AppHeader';
import { AvaLaunchDialog } from '@/components/modals/AvaLaunchDialog';
import { FirstLoginGuideDialog } from '@/components/modals/FirstLoginGuideDialog';
import { AvaConnectionDialog } from '@/components/modals/AvaConnectionDialog';
import { LiteExperienceGate } from '@/components/lite-experience-gate';
import { LiteLockedScreen } from '@/components/lite';
import { getCurrentLiteAccessSnapshot } from '@/lib/server/lite-usage';
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
      <AvaLaunchDialog />
      <AvaConnectionDialog />
    </>
  );
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const initialLiteAccess = await getCurrentLiteAccessSnapshot();
  if (initialLiteAccess.state === 'locked') {
    return <LiteLockedScreen snapshot={initialLiteAccess} />;
  }

  return (
    <SessionProvider>
      <LiteExperienceGate initialSnapshot={initialLiteAccess}>
        <Providers>
          <AppLayoutContent>{children}</AppLayoutContent>
        </Providers>
      </LiteExperienceGate>
    </SessionProvider>
  );
}
