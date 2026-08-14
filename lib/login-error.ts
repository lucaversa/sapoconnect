export interface LoginFailureView {
  title: string;
  message: string;
  showPortalLink: boolean;
}

const LOGIN_FAILURES: Record<string, LoginFailureView> = {
  INVALID_CREDENTIALS: {
    title: 'RA ou senha incorretos',
    message: 'Confira os mesmos dados usados no EduConnect e tente novamente.',
    showPortalLink: false,
  },
  TOTVS_OFFLINE: {
    title: 'TOTVS indisponível',
    message: 'O sistema da faculdade não respondeu agora. Aguarde um instante e tente novamente.',
    showPortalLink: true,
  },
  UPSTREAM_TIMEOUT: {
    title: 'TOTVS demorou para responder',
    message: 'A conexão com o sistema da faculdade excedeu o tempo limite. Tente novamente.',
    showPortalLink: true,
  },
  SERVER_CONFIGURATION_ERROR: {
    title: 'Aplicativo temporariamente indisponível',
    message: 'O servidor do SapoConnect precisa ser reconfigurado. Seus dados de acesso não foram salvos.',
    showPortalLink: false,
  },
  RATE_LIMITED: {
    title: 'Muitas tentativas seguidas',
    message: 'Aguarde um minuto antes de tentar novamente.',
    showPortalLink: false,
  },
  ORIGIN_REJECTED: {
    title: 'Acesso não autorizado',
    message: 'Atualize a página e tente novamente pelo endereço oficial do SapoConnect.',
    showPortalLink: false,
  },
  NETWORK_ERROR: {
    title: 'Sem conexão com o servidor',
    message: 'Verifique sua internet e tente novamente.',
    showPortalLink: false,
  },
};

export function getLoginFailureView(code?: string, serverMessage?: string): LoginFailureView {
  if (code && LOGIN_FAILURES[code]) return LOGIN_FAILURES[code];
  return {
    title: 'Não foi possível fazer login',
    message: serverMessage || 'Tente novamente em instantes.',
    showPortalLink: false,
  };
}
