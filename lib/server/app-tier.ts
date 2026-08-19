import 'server-only';

export type AppTier = 'standard' | 'lite';

let cachedSource: string | undefined;
let cachedLiteRas = new Set<string>();

function normalizeRa(value: string | null | undefined): string {
  return value?.replace(/\D/g, '') ?? '';
}

function getConfiguredLiteRas(source = process.env.SAPOCONNECT_LITE_RAS): Set<string> {
  if (source === cachedSource) return cachedLiteRas;

  cachedSource = source;
  cachedLiteRas = new Set(
    (source ?? '')
      .split(/[\s,;]+/)
      .map(normalizeRa)
      .filter(Boolean)
  );
  return cachedLiteRas;
}

export function resolveAppTier(ra: string | null | undefined): AppTier {
  const normalizedRa = normalizeRa(ra);
  if (!normalizedRa) return 'standard';
  return getConfiguredLiteRas().has(normalizedRa) ? 'lite' : 'standard';
}
