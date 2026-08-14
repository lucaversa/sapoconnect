'use client';

import { Activity, ChartNoAxesCombined, Eye, UsersRound } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import {
  COMMUNITY_PULSE_STALE_TIME_MS,
  type CommunityPulse as CommunityPulseData,
} from '@/lib/community-pulse';
import { queryKeys } from '@/lib/query-keys';

const numberFormatter = new Intl.NumberFormat('pt-BR');

async function fetchCommunityPulse(): Promise<CommunityPulseData> {
  try {
    const response = await fetch('/api/community/pulse', { credentials: 'omit' });
    if (!response.ok) return { available: false };
    return await response.json() as CommunityPulseData;
  } catch {
    return { available: false };
  }
}

function PulseSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2" aria-hidden="true">
      <div className="h-[5.75rem] animate-pulse rounded-2xl bg-gray-200/65 motion-reduce:animate-none dark:bg-white/[0.055]" />
      <div className="h-[5.75rem] animate-pulse rounded-2xl bg-gray-200/65 motion-reduce:animate-none dark:bg-white/[0.055]" />
      <div className="col-span-2 h-12 animate-pulse rounded-2xl bg-gray-200/65 motion-reduce:animate-none dark:bg-white/[0.055]" />
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof UsersRound; label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/70 bg-white/45 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] dark:border-white/[0.07] dark:bg-white/[0.035]">
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
        <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="truncate text-[11px] font-bold">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-extrabold tabular-nums tracking-[-0.04em] text-gray-950 dark:text-white">
        {numberFormatter.format(value)}
      </p>
    </div>
  );
}

export function CommunityPulse({ enabled }: { enabled: boolean }) {
  const { data, isPending } = useQuery({
    queryKey: queryKeys.communityPulse,
    queryFn: fetchCommunityPulse,
    enabled,
    staleTime: COMMUNITY_PULSE_STALE_TIME_MS,
    gcTime: 24 * 60 * 60 * 1_000,
    retry: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  return (
    <section className="border-t border-gray-200/70 py-5 dark:border-white/[0.065]">
      <div className="mb-3 flex items-start gap-3">
        <span className="icon-orb size-9"><Activity className="size-[18px]" aria-hidden="true" /></span>
        <div className="min-w-0">
          <h3 className="font-extrabold text-gray-950 dark:text-white">Pulso da comunidade</h3>
          <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">Dados anônimos do uso do aplicativo, atualizados a cada 6 horas.</p>
        </div>
      </div>

      {isPending ? (
        <PulseSkeleton />
      ) : data?.available ? (
        <div className="grid grid-cols-2 gap-2" aria-live="polite">
          <Metric icon={UsersRound} label="Alunos hoje" value={data.todayVisitors} />
          <Metric icon={Eye} label="Aberturas em 7 dias" value={data.weekPageviews} />
          <div className="col-span-2 flex min-w-0 items-center gap-3 rounded-2xl border border-white/70 bg-white/45 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] dark:border-white/[0.07] dark:bg-white/[0.035]">
            <ChartNoAxesCombined className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-xs font-bold text-gray-600 dark:text-gray-300">Mais acessado</span>
            <span className="truncate text-xs font-extrabold text-gray-950 dark:text-white">{data.topPage?.label ?? 'Sem dados'}</span>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/70 bg-white/40 px-3.5 py-3 text-xs leading-5 text-gray-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] dark:border-white/[0.07] dark:bg-white/[0.03] dark:text-gray-400">
          As métricas públicas estão sendo preparadas.
        </div>
      )}
    </section>
  );
}
