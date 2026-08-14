import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { AuthInputError, readAuthCredentials } from '@/lib/server/auth-input';

function request(body: string, contentLength?: number) {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    body,
    headers: contentLength ? { 'content-length': String(contentLength) } : undefined,
  });
}

describe('authentication input limits', () => {
  it('accepts valid credentials and preserves password whitespace', async () => {
    await expect(
      readAuthCredentials(request(JSON.stringify({ codUsuario: ' 123 ', senha: ' pass ' })))
    ).resolves.toEqual({ codUsuario: '123', senha: ' pass ' });
  });

  it('allows an empty refresh body', async () => {
    await expect(readAuthCredentials(request(''), { optional: true })).resolves.toBeNull();
  });

  it.each(['{', '{}', '{"codUsuario":"123"}'])('rejects malformed or partial JSON: %s', async (body) => {
    await expect(readAuthCredentials(request(body), { optional: true })).rejects.toBeInstanceOf(AuthInputError);
  });

  it('rejects oversized bodies before parsing', async () => {
    await expect(readAuthCredentials(request('{}', 4_096))).rejects.toMatchObject({
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
    });
  });
});
