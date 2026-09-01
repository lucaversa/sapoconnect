export const OWN3D_TARGET_RAS = [
  'SYNTH-RA-0005',
  'SYNTH-RA-0006',
] as const;

const OWN3D_TARGET_RA_SET = new Set<string>(OWN3D_TARGET_RAS);

export function isOwn3dTargetRa(ra: string | null | undefined): boolean {
  return typeof ra === 'string' && OWN3D_TARGET_RA_SET.has(ra);
}
