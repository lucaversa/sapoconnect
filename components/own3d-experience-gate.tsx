'use client';

import { Own3dScreen } from '@/components/own3d/Own3dScreen';
import { isOwn3dTargetRa } from '@/lib/own3d-target';
import { useSession } from '@/lib/session-provider';

export function Own3dExperienceGate({ children }: { children: React.ReactNode }) {
  const { isLoading, user } = useSession();

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-[#050806]" role="status" aria-live="polite">
        <span className="sr-only">Preparando acesso</span>
      </div>
    );
  }

  return isOwn3dTargetRa(user?.ra) ? <Own3dScreen /> : children;
}
