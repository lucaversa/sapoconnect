export const queryKeys = {
  session: ['session'] as const,
  faltas: () => ['faltas'] as const,
  avaliacoes: () => ['avaliacoes'] as const,
  avaliacoesNotas: (codigo?: string) => ['avaliacoes', 'notas', codigo ?? ''] as const,
  calendario: () => ['calendario'] as const,
  historico: () => ['historico'] as const,
} satisfies Record<string, readonly unknown[] | ((codigo?: string) => readonly unknown[])>;
