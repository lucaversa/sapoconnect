export const SERVER_CONFIGURATION_ERROR_CODE = 'SERVER_CONFIGURATION_ERROR';
export const SERVER_CONFIGURATION_PUBLIC_MESSAGE =
  'O aplicativo está temporariamente indisponível. Tente novamente em instantes.';

export class ServerConfigurationError extends Error {
  readonly code = SERVER_CONFIGURATION_ERROR_CODE;

  constructor(message = 'Required server secret is missing or invalid') {
    super(message);
    this.name = 'ServerConfigurationError';
  }
}
