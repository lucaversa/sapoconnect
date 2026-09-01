import 'server-only';

import { isOwn3dTargetRa } from '@/lib/own3d-target';
import { getSession } from '@/lib/session';

export async function isOwn3dSession(): Promise<boolean> {
  const session = await getSession();
  return isOwn3dTargetRa(session?.ra);
}
