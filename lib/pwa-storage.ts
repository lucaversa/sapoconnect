export type StoragePersistenceResult = 'persistent' | 'best-effort' | 'unsupported';

export interface PersistenceManager {
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
}

export async function ensurePersistentStorage(
  manager: PersistenceManager | undefined =
    typeof navigator !== 'undefined' ? navigator.storage : undefined
): Promise<StoragePersistenceResult> {
  if (!manager?.persisted || !manager.persist) return 'unsupported';

  try {
    if (await manager.persisted()) return 'persistent';
    return (await manager.persist()) ? 'persistent' : 'best-effort';
  } catch {
    return 'best-effort';
  }
}
