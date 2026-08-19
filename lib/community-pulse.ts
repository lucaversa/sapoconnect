export const COMMUNITY_PULSE_STALE_TIME_MS = 2 * 60 * 60 * 1_000;

export type CommunityPulse =
  | {
      available: true;
      todayVisitors: number;
      weekPageviews: number;
      topPage: {
        label: string;
        path: string;
        pageviews: number;
      } | null;
      updatedAt: string;
    }
  | {
      available: false;
    };

const APP_PAGE_LABELS: Record<string, string> = {
  '/app/avaliacoes': 'Avaliações',
  '/app/calendario': 'Horários',
  '/app/faltas': 'Faltas',
  '/app/historico': 'Histórico',
};

export function getCommunityPageLabel(path: string): string {
  return APP_PAGE_LABELS[path] ?? 'Outras páginas';
}
