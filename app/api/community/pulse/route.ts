import { getCommunityPulse } from '@/lib/server/community-analytics';
import { COMMUNITY_PULSE_PROVISIONAL_STALE_TIME_MS } from '@/lib/community-pulse';
import { getCommunityPulseSchedule } from '@/lib/community-pulse-schedule';

function publicCacheHeaders(secondsUntilNextRefresh: number, provisional: boolean) {
  const provisionalMaxAge = Math.floor(COMMUNITY_PULSE_PROVISIONAL_STALE_TIME_MS / 1_000);
  const sharedMaxAge = Math.max(
    1,
    Math.min(secondsUntilNextRefresh, provisional ? provisionalMaxAge : secondsUntilNextRefresh)
  );
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
  const provisional = pulse.available && pulse.todayVisitors === 0;
  return Response.json(pulse, {
    headers: publicCacheHeaders(schedule.secondsUntilNextRefresh, provisional),
  });
}
