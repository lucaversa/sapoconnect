'use client';

import { getSessionManager } from './session-manager';

export async function ensureSession(): Promise<boolean> {
  try {
    const sessionManager = getSessionManager();
    let currentState = sessionManager.getCurrentState();

    if (currentState.status === 'active' && currentState.user) {
      return true;
    }

    if (sessionManager.isRefreshing()) {
      const maxWait = 3000;
      const checkInterval = 100;
      let elapsed = 0;

      while (sessionManager.isRefreshing() && elapsed < maxWait) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        elapsed += checkInterval;
      }

      const newState = sessionManager.getCurrentState();
      return newState.status === 'active' && newState.user !== null;
    }

    const refreshed = await sessionManager.refreshSession();
    if (refreshed) return true;

    currentState = sessionManager.getCurrentState();
    if (currentState.status === 'error') {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function checkSession(): Promise<boolean> {
  try {
    const sessionManager = getSessionManager();
    const info = await sessionManager.checkSession(true);
    return info.status === 'active' && info.user !== null;
  } catch {
    return false;
  }
}

export async function forceCheckSession(): Promise<boolean> {
  try {
    const sessionManager = getSessionManager();
    const info = await sessionManager.checkSession(false);
    return info.status === 'active' && info.user !== null;
  } catch {
    return false;
  }
}
