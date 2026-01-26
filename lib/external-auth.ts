import setCookieParser from 'set-cookie-parser';

const EXTERNAL_LOGIN_URL =
  'https://fundacaoeducacional132827.rm.cloudtotvs.com.br/EducaMobile/Account/LoginExternoApp';

const COD_INSTITUICAO = '72BB435F-69CC-48BF-9E3D-7F7190394DDF';

export interface ExternalLoginParams {
  codUsuario: string;
  senha: string;
  codDependente?: string;
}

export interface ExternalCookies {
  aspNetSessionId: string;
  aspxAuth: string;
  eduTipoUser?: string;
  redirectUrlContexto?: string;
  [key: string]: string | undefined;
}

export async function performExternalLogin(
  params: ExternalLoginParams
): Promise<ExternalCookies> {
  const { codUsuario, senha, codDependente } = params;

  const formData = new URLSearchParams({
    CodUsuario: codUsuario,
    Senha: senha,
    TitleApp: 'CMMG',
    TitleTextColorEducaMobile: '#B2DFDB',
    TitleBackgroundColorEducaMobile: '#00A291',
    CodDependente: codDependente || codUsuario,
    UrlReturn_toggleEducaMobile: '',
    VersionAPP: '08.2510:11',
    OAuthAccessToken: '',
    OAuthAppId: '',
    OAuthAppIdRM: '',
    OAuthExpiresIn: '0.0',
    OAuthRefreshToken: '',
    OAuthTokenType: '',
    OAuthType: '0',
    OAuthUserId: '',
    CodInstituicao: COD_INSTITUICAO,
  });

  const response = await fetch(EXTERNAL_LOGIN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    body: formData.toString(),
    redirect: 'manual',
  });

  if (!response.ok && response.status !== 302) {
    const responseText = await response.text().catch(() => 'Unable to read response');
    throw new Error(`External login failed with status ${response.status}: ${responseText.substring(0, 200)}`);
  }

  const cookies = extractCookiesFromResponse(response);

  if (!cookies.aspNetSessionId || !cookies.aspxAuth) {
    throw new Error('Failed to extract session cookies from external login');
  }

  return cookies;
}

function extractCookiesFromResponse(response: Response): ExternalCookies {
  const setCookieHeaders = response.headers.getSetCookie?.() || [];

  if (setCookieHeaders.length === 0) {
    const singleHeader = response.headers.get('set-cookie');
    if (singleHeader) {
      setCookieHeaders.push(singleHeader);
    }
  }

  const parsedCookies = setCookieParser.parse(setCookieHeaders, {
    decodeValues: false,
  });

  const cookies: ExternalCookies = {
    aspNetSessionId: '',
    aspxAuth: '',
  };

  for (const cookie of parsedCookies) {
    if (cookie.name === 'ASP.NET_SessionId') {
      cookies.aspNetSessionId = cookie.value;
    } else if (cookie.name === '.ASPXAUTH') {
      cookies.aspxAuth = cookie.value;
    } else if (cookie.name === 'EduTipoUser') {
      cookies.eduTipoUser = cookie.value;
    } else if (cookie.name === 'RedirectUrlContexto') {
      cookies.redirectUrlContexto = cookie.value;
    } else {
      cookies[cookie.name] = cookie.value;
    }
  }

  return cookies;
}

export function formatCookiesForRequest(cookies: ExternalCookies): string {
  const parts: string[] = [];

  if (cookies.aspNetSessionId) {
    parts.push(`ASP.NET_SessionId=${cookies.aspNetSessionId}`);
  }
  if (cookies.aspxAuth) {
    parts.push(`.ASPXAUTH=${cookies.aspxAuth}`);
  }
  if (cookies.eduTipoUser !== undefined) {
    parts.push(`EduTipoUser=${cookies.eduTipoUser}`);
  }
  if (cookies.redirectUrlContexto !== undefined) {
    parts.push(`RedirectUrlContexto=${cookies.redirectUrlContexto}`);
  }

  for (const [key, value] of Object.entries(cookies)) {
    if (key === 'aspNetSessionId' || key === 'aspxAuth' || key === 'eduTipoUser' || key === 'redirectUrlContexto') {
      continue;
    }
    if (value !== undefined && key !== 'aspNetSessionId' && key !== 'aspxAuth') {
      parts.push(`${key}=${value}`);
    }
  }

  return parts.join('; ');
}
