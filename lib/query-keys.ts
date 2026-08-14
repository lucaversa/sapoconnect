export const queryKeys = {
  session: ['session'] as const,
  faltas: () => ['faltas'] as const,
  avaliacoesCompleto: () => ['avaliacoes', 'completo'] as const,
  calendario: () => ['calendario'] as const,
  historico: () => ['historico'] as const,
} satisfies Record<string, readonly unknown[] | (() => readonly unknown[])>;
