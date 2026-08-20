export const queryKeys = {
  session: ['session'] as const,
  communityPulse: ['community', 'pulse'] as const,
  faltas: () => ['faltas'] as const,
  avaliacoesCompleto: () => ['avaliacoes', 'completo'] as const,
  calendario: () => ['calendario'] as const,
  historico: () => ['historico'] as const,
  avaConnection: () => ['ava-connection'] as const,
  avaOverview: () => ['ava', 'overview'] as const,
  avaContentSummary: (courseIds: number[]) => ['ava', 'content-summary', ...courseIds] as const,
  avaCourse: (courseId: number) => ['ava', 'course', courseId] as const,
};
