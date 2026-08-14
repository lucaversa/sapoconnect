import { getCommunityPulse } from '@/lib/server/community-analytics';

const PUBLIC_CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=300, s-maxage=21600, stale-while-revalidate=86400',
  'CDN-Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400',
  'Vercel-CDN-Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400',
};

export async function GET() {
  const pulse = await getCommunityPulse();
  return Response.json(pulse, { headers: PUBLIC_CACHE_HEADERS });
}
