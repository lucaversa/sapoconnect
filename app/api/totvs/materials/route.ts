import { getTotvsMaterialsOverview, totvsMaterialsRouteError } from '@/lib/server/totvs-materials';
import { privateJson } from '@/lib/server/http';

export async function GET() {
  try {
    const overview = await getTotvsMaterialsOverview();
    return privateJson(overview, overview.__cacheStale ? { headers: { 'X-SapoConnect-Cache': 'stale' } } : undefined);
  } catch (error) {
    return totvsMaterialsRouteError(error);
  }
}
