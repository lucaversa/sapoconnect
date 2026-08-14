'use client';

import { getSessionManager } from './session-manager';

export async function ensureSession(): Promise<boolean> {
  try {
    const sessionManager = getSessionManager();
    const currentState = sessionManager.getCurrentState();

    if (currentState.status === 'active' && currentState.user) {
      return true;
    }

    const refreshed = await sessionManager.refreshSession();
    if (refreshed) return true;

    if (sessionManager.getCurrentState().status === 'error') {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
