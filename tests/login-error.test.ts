import { describe, expect, it } from 'vitest';
import { getLoginFailureView } from '@/lib/login-error';

describe('login error presentation', () => {
  it('distinguishes credentials, TOTVS and server configuration failures', () => {
    expect(getLoginFailureView('INVALID_CREDENTIALS')).toMatchObject({
      title: 'RA ou senha incorretos',
      showPortalLink: false,
    });
    expect(getLoginFailureView('TOTVS_OFFLINE')).toMatchObject({
      title: 'TOTVS indisponível',
      showPortalLink: true,
    });
    expect(getLoginFailureView('SERVER_CONFIGURATION_ERROR')).toMatchObject({
      title: 'Aplicativo temporariamente indisponível',
      showPortalLink: false,
    });
  });

  it('keeps an explicit safe server message for unclassified failures', () => {
    expect(getLoginFailureView('UNKNOWN', 'Tente novamente mais tarde.').message).toBe(
      'Tente novamente mais tarde.'
    );
  });
});
