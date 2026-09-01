import { getSession } from '@/lib/session';
import {
  fetchTOTVSResult,
  HTTPError,
  type TotvsFetchOptions,
} from '@/lib/totvs-api';
import {
  buildFrequencyReviewParameter,
  parseFrequencyReviewDates,
  parseFrequencyReviewForm,
  parseFrequencyReviewPath,
} from '@/lib/frequency-review-parser';
import { getOrLoad } from '@/lib/server/cache';
import { privateJson } from '@/lib/server/http';
import { isTransientUpstreamError } from '@/lib/server/upstream';

const REQUESTS_PATH =
  '/EducaMobile/Educacional/EduAluno/EduAcompanhaSolicitacoes?tp=A';
const AVAILABLE_REQUESTS_OPTIONS_PATH =
  '/EducaMobile/Educacional/EduAluno/EduAcompanhaSolicitacoesDisponiveis?codGrupoAtd=';
const DEPENDENT_OPTIONS_PATH =
  '/EducaMobile/Educacional/EduAluno/GetListaOpcaoCampoParametrizadoComDependencia';
const FALLBACK_REVIEW_DEPENDENCY = {
  codColigada: '1',
  codAplicacao: 'S',
  codSentencaDependencia: 'CRM.EDU.36.008',
  codParametroDependencia: '54',
  nomeParametroDependencia: 'PARAMETRO_53',
};

class FrequencyReviewSourceError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'FrequencyReviewSourceError';
  }
}

class DisciplineUnavailableError extends Error {
  constructor() {
    super('Disciplina não disponível no requerimento de revisão de frequência.');
    this.name = 'DisciplineUnavailableError';
  }
}

function isKnownEmptyReviewFormShell(html: string): boolean {
  return (
    /<!doctype\s+html|<html\b/i.test(html) &&
    /id=["']content-main["']/i.test(html) &&
    /id=["']hdUrlValidSession["']/i.test(html) &&
    /urlSessionReload/i.test(html) &&
    !/<form\b/i.test(html) &&
    !/name=["']NOMETIPO["']/i.test(html) &&
    !/field_param_53/i.test(html)
  );
}

async function loadFrequencyReviewDates(codigo: string) {
  let upstreamStale = false;
  const fetchSource = async (path: string, options?: TotvsFetchOptions) => {
    const result = await fetchTOTVSResult(path, '[Faltas datas]', options);
    if (result.cache === 'stale') upstreamStale = true;
    return result.html;
  };

  const requestsHtml = await fetchSource(REQUESTS_PATH);
  let reviewPath = parseFrequencyReviewPath(requestsHtml);
  let reviewRefererPath = REQUESTS_PATH;

  if (!reviewPath) {
    const availableOptionsHtml = await fetchSource(AVAILABLE_REQUESTS_OPTIONS_PATH, {
      requestProfile: 'ajax-html',
      refererPath: REQUESTS_PATH,
    });
    reviewPath = parseFrequencyReviewPath(availableOptionsHtml);
    reviewRefererPath = AVAILABLE_REQUESTS_OPTIONS_PATH;
  }

  if (!reviewPath) {
    throw new FrequencyReviewSourceError(
      'A revisão de frequência não está disponível na TOTVS.',
      'FREQUENCY_REVIEW_UNAVAILABLE'
    );
  }

  const reviewFormHtml = await fetchSource(reviewPath, {
    refererPath: reviewRefererPath,
  });
  const reviewForm = parseFrequencyReviewForm(reviewFormHtml);
  if (!reviewForm && !isKnownEmptyReviewFormShell(reviewFormHtml)) {
    throw new FrequencyReviewSourceError(
      'Não foi possível interpretar o requerimento de revisão de frequência.',
      'FREQUENCY_REVIEW_FORM_INVALID'
    );
  }

  const disciplina = reviewForm?.disciplinas.find((item) => item.codigo === codigo);
  if (reviewForm && !disciplina) throw new DisciplineUnavailableError();

  const searchParams = new URLSearchParams();
  searchParams.set(
    'parametro',
    buildFrequencyReviewParameter(
      reviewForm?.dependencia ?? FALLBACK_REVIEW_DEPENDENCY,
      codigo
    )
  );
  const responseText = await fetchSource(
    `${DEPENDENT_OPTIONS_PATH}?${searchParams.toString()}`,
    {
      requestProfile: 'ajax-json',
      refererPath: reviewPath,
    }
  );

  let responsePayload: unknown;
  try {
    responsePayload = JSON.parse(responseText);
  } catch {
    throw new FrequencyReviewSourceError(
      'A TOTVS não retornou a lista de datas esperada.',
      'FREQUENCY_REVIEW_DATES_INVALID'
    );
  }

  const datasFalta = parseFrequencyReviewDates(responsePayload);
  if (!datasFalta) {
    throw new FrequencyReviewSourceError(
      'A TOTVS não retornou a lista de datas esperada.',
      'FREQUENCY_REVIEW_DATES_INVALID'
    );
  }

  return {
    response: {
      codigo,
      datasFalta,
      datasFaltaStatus: datasFalta.length > 0 ? 'ok' as const : 'sem_dados' as const,
      fonte: 'revisao_frequencia' as const,
      escopo: 'disponiveis_para_revisao' as const,
    },
    upstreamStale,
  };
}

export async function GET(request: Request) {
  const codigo = new URL(request.url).searchParams.get('codigo')?.trim() ?? '';
  if (codigo.length > 64 || !/^\d+-\d+-\d+$/.test(codigo)) {
    return privateJson(
      { error: 'Código de disciplina inválido.', code: 'BAD_REQUEST' },
      { status: 400 }
    );
  }

  try {
    const session = await getSession();
    if (!session) {
      return privateJson(
        { error: 'Sessão não encontrada. Faça login novamente.', code: 'SESSION_MISSING' },
        { status: 401 }
      );
    }

    const result = await getOrLoad(
      session.cacheScope,
      `source:faltas-datas:v2:${codigo}`,
      () => loadFrequencyReviewDates(codigo),
      {
        ttlMs: 45_000,
        staleMs: 120_000,
        canServeStale: isTransientUpstreamError,
      }
    );

    return privateJson(
      result.value.response,
      result.cache === 'stale' || result.value.upstreamStale
        ? { headers: { 'X-SapoConnect-Cache': 'stale' } }
        : undefined
    );
  } catch (error) {
    if (error instanceof HTTPError) {
      if (error.statusCode >= 500) {
        console.error('[faltas/datas]', {
          code: error.debugCode,
          causeName: error.name,
        });
      }
      return privateJson(
        { error: error.message, code: error.debugCode },
        { status: error.statusCode }
      );
    }

    if (error instanceof DisciplineUnavailableError) {
      return privateJson(
        { error: error.message, code: 'DISCIPLINE_NOT_AVAILABLE' },
        { status: 404 }
      );
    }

    if (error instanceof FrequencyReviewSourceError) {
      console.error('[faltas/datas]', {
        code: error.code,
        causeName: error.name,
      });
      return privateJson(
        { error: error.message, code: error.code },
        { status: 502 }
      );
    }

    console.error('[faltas/datas]', {
      code: 'INTERNAL_ERROR',
      causeName: error instanceof Error ? error.name : typeof error,
    });
    return privateJson(
      { error: 'Erro ao consultar as datas de falta.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
