import { getRA } from '@/lib/session';
import { privateJson } from '@/lib/server/http';

export async function GET() {
  try {
    const ra = await getRA();
    return privateJson({ ra });
  } catch {
    return privateJson({ ra: null }, { status: 200 });
  }
}
