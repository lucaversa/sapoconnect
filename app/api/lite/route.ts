import { getSession } from '@/lib/session';
import {
  getLiteAccessSnapshotForRa,
  updateLiteAccessForRa,
  type LiteUsageAction,
} from '@/lib/server/lite-usage';
import { privateJson } from '@/lib/server/http';
import { guardSameOriginRequest, RequestGuardError } from '@/lib/server/request-guard';
import {
  ServerConfigurationError,
  SERVER_CONFIGURATION_ERROR_CODE,
  SERVER_CONFIGURATION_PUBLIC_MESSAGE,
} from '@/lib/server/configuration-error';

export const dynamic = 'force-dynamic';

const LITE_USAGE_ACTIONS = new Set<LiteUsageAction>([
  'start',
  'resume',
  'heartbeat',
  'pause',
]);

function sessionMissingResponse() {
  return privateJson(
    { error: 'Sessão não encontrada.', code: 'SESSION_MISSING' },
    { status: 401 }
  );
}

function failureResponse(error: unknown) {
  if (error instanceof RequestGuardError) {
    return privateJson(
      { error: error.message, code: error.code },
      { status: error.status }
    );
  }

  if (error instanceof ServerConfigurationError) {
    console.error('[lite] Server configuration is incomplete:', error.message);
    return privateJson(
      {
        error: SERVER_CONFIGURATION_PUBLIC_MESSAGE,
        code: SERVER_CONFIGURATION_ERROR_CODE,
      },
      { status: 503 }
    );
  }

  console.error('[lite] Unable to evaluate daily access:', error);
  return privateJson(
    { error: 'Erro ao verificar o acesso Lite.', code: 'INTERNAL_ERROR' },
    { status: 500 }
  );
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return sessionMissingResponse();

    const snapshot = await getLiteAccessSnapshotForRa(session.ra, Date.now(), {
      repairInvalid: true,
    });
    return privateJson(snapshot);
  } catch (error) {
    return failureResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    guardSameOriginRequest(request);
    const body = await request.json().catch(() => null) as { action?: unknown } | null;
    const action = body?.action;
    if (typeof action !== 'string' || !LITE_USAGE_ACTIONS.has(action as LiteUsageAction)) {
      return privateJson(
        { error: 'Ação Lite inválida.', code: 'INVALID_LITE_ACTION' },
        { status: 400 }
      );
    }

    const session = await getSession();
    if (!session) return sessionMissingResponse();

    const snapshot = await updateLiteAccessForRa(
      session.ra,
      action as LiteUsageAction
    );
    return privateJson(snapshot);
  } catch (error) {
    return failureResponse(error);
  }
}
