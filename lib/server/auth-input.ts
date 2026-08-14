import 'server-only';

export interface AuthCredentials {
  codUsuario: string;
  senha: string;
}

export class AuthInputError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 413,
    public readonly code: 'BAD_REQUEST' | 'PAYLOAD_TOO_LARGE'
  ) {
    super(message);
    this.name = 'AuthInputError';
  }
}

const MAX_AUTH_BODY_BYTES = 2_048;
const MAX_USER_LENGTH = 128;
const MAX_PASSWORD_LENGTH = 512;

export async function readAuthCredentials(
  request: Request,
  options: { optional?: boolean } = {}
): Promise<AuthCredentials | null> {
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_AUTH_BODY_BYTES) {
    throw new AuthInputError('Requisição muito grande.', 413, 'PAYLOAD_TOO_LARGE');
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > MAX_AUTH_BODY_BYTES) {
    throw new AuthInputError('Requisição muito grande.', 413, 'PAYLOAD_TOO_LARGE');
  }
  if (!raw.trim()) {
    if (options.optional) return null;
    throw new AuthInputError('Usuário e senha são obrigatórios.', 400, 'BAD_REQUEST');
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new AuthInputError('JSON inválido.', 400, 'BAD_REQUEST');
  }

  const candidate = body as Partial<AuthCredentials> | null;
  if (
    !candidate ||
    typeof candidate.codUsuario !== 'string' ||
    typeof candidate.senha !== 'string'
  ) {
    throw new AuthInputError('Usuário e senha são obrigatórios.', 400, 'BAD_REQUEST');
  }

  const codUsuario = candidate.codUsuario.trim();
  const senha = candidate.senha;
  if (
    !codUsuario ||
    !senha ||
    codUsuario.length > MAX_USER_LENGTH ||
    senha.length > MAX_PASSWORD_LENGTH
  ) {
    throw new AuthInputError('Credenciais fora do formato permitido.', 400, 'BAD_REQUEST');
  }

  return { codUsuario, senha };
}
