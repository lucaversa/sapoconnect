import { redirect } from 'next/navigation';

import { LiteLockedScreen } from '@/components/lite';
import { getCurrentLiteAccessSnapshot } from '@/lib/server/lite-usage';

export default async function LitePage() {
  const snapshot = await getCurrentLiteAccessSnapshot();

  if (snapshot.tier !== 'lite' || snapshot.state !== 'locked') {
    redirect('/app/calendario');
  }

  return <LiteLockedScreen snapshot={snapshot} />;
}
