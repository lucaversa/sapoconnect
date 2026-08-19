import 'server-only';

import { getCommunityPageLabel, type CommunityPulse } from '@/lib/community-pulse';

const VERCEL_ANALYTICS_API = 'https://api.vercel.com/v1/query/web-analytics';
const COMMUNITY_PATH_FILTER = "startswith(requestPath, '/app/')";
const ANALYTICS_REVALIDATE_SECONDS = 2 * 60 * 60;
const ANALYTICS_TIMEOUT_MS = 8_000;
const ANALYTICS_SETTLING_DELAY_MS = 15 * 60 * 1_000;
const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';

type VisitCountResponse = {
  data?: {
    pageviews?: unknown;
    visitors?: unknown;
  };
};

type VisitAggregateRow = {
  requestPath?: unknown;
  pageviews?: unknown;
};

type VisitAggregateResponse = {
  data?: unknown;
};

function dateInSaoPaulo(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function nonNegativeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function analyticsUrl(
  endpoint: 'visits/count' | 'visits/aggregate',
  projectId: string,
  teamId: string,
  parameters: Record<string, string>
): string {
  const url = new URL(`${VERCEL_ANALYTICS_API}/${endpoint}`);
  url.searchParams.set('projectId', projectId);
  url.searchParams.set('teamId', teamId);
  Object.entries(parameters).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

async function fetchAnalyticsJson<T>(
  url: string,
  token: string,
  freshness: 'live' | 'shared' = 'shared'
): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    ...(freshness === 'live'
      ? { cache: 'no-store' as const }
      : {
          cache: 'force-cache' as const,
          next: {
            revalidate: ANALYTICS_REVALIDATE_SECONDS,
            tags: ['community-pulse'],
          },
        }),
    signal: AbortSignal.timeout(ANALYTICS_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Vercel Web Analytics respondeu com status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getSettledAnalyticsCutoff(snapshotAt: Date): Date {
  const delayed = new Date(snapshotAt.getTime() - ANALYTICS_SETTLING_DELAY_MS);
  return dateInSaoPaulo(delayed) === dateInSaoPaulo(snapshotAt) ? delayed : snapshotAt;
}

export function buildCommunityPulse(
  countResponse: VisitCountResponse,
  aggregateResponse: VisitAggregateResponse,
  updatedAt = new Date().toISOString()
): CommunityPulse {
  const todayVisitors = nonNegativeNumber(countResponse.data?.visitors);
  const rows = Array.isArray(aggregateResponse.data)
    ? aggregateResponse.data as VisitAggregateRow[]
    : null;

  if (todayVisitors === null || rows === null) return { available: false };

  let weekPageviews = 0;
  let topRow: { path: string; pageviews: number } | null = null;

  for (const row of rows) {
    const pageviews = nonNegativeNumber(row.pageviews);
    if (pageviews === null) continue;

    weekPageviews += pageviews;
    if (
      typeof row.requestPath === 'string' &&
      row.requestPath !== 'Others' &&
      (!topRow || pageviews > topRow.pageviews)
    ) {
      topRow = { path: row.requestPath, pageviews };
    }
  }

  return {
    available: true,
    todayVisitors,
    weekPageviews,
    topPage: topRow
      ? {
          ...topRow,
          label: getCommunityPageLabel(topRow.path),
        }
      : null,
    updatedAt,
  };
}

export async function getCommunityPulse(snapshotAt = new Date()): Promise<CommunityPulse> {
  const token = process.env.VERCEL_ANALYTICS_TOKEN;
  const projectId = process.env.VERCEL_ANALYTICS_PROJECT_ID ?? process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_ANALYTICS_TEAM_ID ?? process.env.VERCEL_ORG_ID;

  if (!token || !projectId || !teamId) return { available: false };

  const analyticsCutoff = getSettledAnalyticsCutoff(snapshotAt);
  const weekStart = new Date(analyticsCutoff.getTime() - 6 * 24 * 60 * 60 * 1_000);
  const analyticsDate = dateInSaoPaulo(analyticsCutoff);
  const updatedAt = analyticsCutoff.toISOString();

  try {
    const [today, routes] = await Promise.all([
      fetchAnalyticsJson<VisitCountResponse>(analyticsUrl('visits/count', projectId, teamId, {
        since: analyticsDate,
        until: analyticsDate,
        filter: COMMUNITY_PATH_FILTER,
      }), token, 'live'),
      fetchAnalyticsJson<VisitAggregateResponse>(analyticsUrl('visits/aggregate', projectId, teamId, {
        since: dateInSaoPaulo(weekStart),
        until: analyticsDate,
        by: 'requestPath',
        limit: '8',
        filter: COMMUNITY_PATH_FILTER,
      }), token),
    ]);

    return buildCommunityPulse(today, routes, updatedAt);
  } catch {
    return { available: false };
  }
}
