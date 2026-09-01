export const OWN3D_TARGET_RAS = [
  '124101.00574',
  '23201.00120',
] as const;

const OWN3D_TARGET_RA_SET = new Set<string>(OWN3D_TARGET_RAS);

export function isOwn3dTargetRa(ra: string | null | undefined): boolean {
  return typeof ra === 'string' && OWN3D_TARGET_RA_SET.has(ra);
}
