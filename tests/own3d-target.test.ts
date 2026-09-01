import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { OWN3D_TARGET_RAS, isOwn3dTargetRa } from '@/lib/own3d-target';

const projectFile = (relativePath: string) => path.join(process.cwd(), relativePath);

describe('own3d target policy', () => {
  it('targets only the two exact requested RAs', () => {
    expect(OWN3D_TARGET_RAS).toEqual(['124101.00574', '23201.00120']);

    for (const ra of OWN3D_TARGET_RAS) {
      expect(isOwn3dTargetRa(ra)).toBe(true);
    }

    expect(isOwn3dTargetRa('124101.00573')).toBe(false);
    expect(isOwn3dTargetRa('23201.00121')).toBe(false);
    expect(isOwn3dTargetRa('12410100574')).toBe(false);
    expect(isOwn3dTargetRa('2320100120')).toBe(false);
    expect(isOwn3dTargetRa(' 124101.00574 ')).toBe(false);
    expect(isOwn3dTargetRa(null)).toBe(false);
    expect(isOwn3dTargetRa(undefined)).toBe(false);
  });

  it('checks the server session before mounting the private app providers', async () => {
    const layout = await readFile(projectFile('app/app/layout.tsx'), 'utf8');

    expect(layout.indexOf('await isOwn3dSession()')).toBeGreaterThan(-1);
    expect(layout.indexOf('await isOwn3dSession()')).toBeLessThan(layout.indexOf('<SessionProvider>'));
    expect(layout).toContain('<Own3dExperienceGate>');
    expect(layout.indexOf('<Own3dExperienceGate>')).toBeLessThan(layout.indexOf('<Providers>'));
  });

  it('replaces the root experience for direct requests from a target session', async () => {
    const layout = await readFile(projectFile('app/layout.tsx'), 'utf8');

    expect(layout).toContain('const showOwn3dScreen = await isOwn3dSession()');
    expect(layout).toContain('showOwn3dScreen ? (');
    expect(layout).toContain('<Own3dScreen />');
    expect(layout.indexOf('<PwaRuntime />')).toBeLessThan(layout.indexOf('<Own3dScreen />'));
  });

  it('uses a document navigation after login so the service worker classifies the first target session', async () => {
    const loginForm = await readFile(projectFile('components/login-form.tsx'), 'utf8');

    expect(loginForm).toContain('setShowRestrictedExperience(true)');
    expect(loginForm).toContain('await prepareRestrictedNavigation()');
    expect(loginForm).toContain('EXPECTED_SERVICE_WORKER_VERSION = 4');
    expect(loginForm).toContain('while (');
    expect(loginForm).toContain("window.location.replace('/app/calendario')");
    expect(loginForm).not.toContain("router.replace('/app/calendario')");
  });

  it('renders only the requested phrase in a full-viewport reduced-motion-safe screen', async () => {
    const component = await readFile(projectFile('components/own3d/Own3dScreen.tsx'), 'utf8');
    const styles = await readFile(projectFile('components/own3d/Own3dScreen.module.css'), 'utf8');

    expect(component).toContain('own3d by tub1cs');
    expect(component).toContain('aria-labelledby="own3d-screen-title"');
    expect(component).toContain('aria-label="own3d by tub1cs"');
    expect(styles).toContain('min-height: 100dvh');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
