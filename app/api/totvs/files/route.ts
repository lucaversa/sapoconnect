import { getTotvsMaterialFile, totvsMaterialsRouteError } from '@/lib/server/totvs-materials';

export async function GET(request: Request) {
  try {
    return await getTotvsMaterialFile(new URL(request.url).searchParams.get('id') ?? '');
  } catch (error) {
    return totvsMaterialsRouteError(error);
  }
}
