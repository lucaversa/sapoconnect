import { getCommunityPulse } from '@/lib/server/community-analytics';
import { getCommunityPulseSchedule } from '@/lib/community-pulse-schedule';

function publicCacheHeaders(secondsUntilNextRefresh: number) {
  const sharedMaxAge = Math.max(1, secondsUntilNextRefresh);
  const browserMaxAge = Math.min(300, sharedMaxAge);

  return {
    'Cache-Control': `public, max-age=${browserMaxAge}, s-maxage=${sharedMaxAge}, stale-while-revalidate=300`,
    'CDN-Cache-Control': `public, s-maxage=${sharedMaxAge}, stale-while-revalidate=300`,
    'Vercel-CDN-Cache-Control': `public, s-maxage=${sharedMaxAge}, stale-while-revalidate=300`,
  };
}

export async function GET() {
  const schedule = getCommunityPulseSchedule();
  const pulse = await getCommunityPulse(schedule.snapshotAt);
  return Response.json(pulse, {
    headers: publicCacheHeaders(schedule.secondsUntilNextRefresh),
  });
}
