export const QUERY_STALE_TIME = {
  avaliacoes: 10 * 60 * 1_000,
  calendario: 15 * 60 * 1_000,
  detalheAula: 30 * 60 * 1_000,
  faltas: 5 * 60 * 1_000,
  historico: 12 * 60 * 60 * 1_000,
} as const;

// Academic snapshots are small and are explicitly removed on logout. Keeping
// them in memory prevents an open PWA from garbage-collecting an offline
// module merely because it has not been visited recently.
export const QUERY_GC_TIME = Infinity;
