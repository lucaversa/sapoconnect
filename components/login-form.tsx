'use client';

import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { markReconnectCookieConfirmed, saveOfflineSessionHint } from '@/lib/storage';
import { getLoginFailureView, type LoginFailureView } from '@/lib/login-error';
import { Own3dScreen } from '@/components/own3d/Own3dScreen';
import { AlertCircle, Loader2, Shield, Lock, Code, GraduationCap, Server, ExternalLink } from 'lucide-react';

const EXPECTED_SERVICE_WORKER_VERSION = 4;
const SERVICE_WORKER_VERSION_REQUEST = 'SAPOCONNECT_SW_VERSION';

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function readServiceWorkerVersion(worker: ServiceWorker | null): Promise<number | null> {
  if (!worker) return null;

  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timeoutId = window.setTimeout(() => resolve(null), 250);
    channel.port1.onmessage = (event: MessageEvent<{ version?: number }>) => {
      window.clearTimeout(timeoutId);
      resolve(event.data?.version ?? null);
    };
    worker.postMessage({ type: SERVICE_WORKER_VERSION_REQUEST }, [channel.port2]);
  });
}

async function clearLegacyPwaCaches(): Promise<void> {
  if (!('caches' in window)) return;
  const names = await window.caches.keys();
  await Promise.all(
    names
      .filter((name) => name.startsWith('sapoconnect-') && !name.endsWith('-v4'))
      .map((name) => window.caches.delete(name))
  );
}

async function prepareRestrictedNavigation(): Promise<boolean> {
  if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return true;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });
    await registration.update();

    // Stay on the already-rendered restricted screen until v4 actually owns
    // this client. A v3 controller intentionally never satisfies the check.
    while (
      await readServiceWorkerVersion(navigator.serviceWorker.controller)
        !== EXPECTED_SERVICE_WORKER_VERSION
    ) {
      await delay(150);
    }
    return true;
  } catch {
    return false;
  }
}

export function LoginForm() {
  const [codUsuario, setCodUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<LoginFailureView | null>(null);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [showRestrictedExperience, setShowRestrictedExperience] = useState(false);
  const reducedMotion = useReducedMotion();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codUsuario, senha }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        reconnectStorage?: 'httpOnly';
        migrationConfirmed?: boolean;
        cacheScope?: string;
        ra?: string;
        restrictedExperience?: boolean;
      };

      if (!response.ok) {
        setError(getLoginFailureView(data.code, data.error));
        return;
      }

      if (data.reconnectStorage === 'httpOnly' || data.migrationConfirmed) {
        void markReconnectCookieConfirmed(data.cacheScope);
      }
      if (data.ra && data.cacheScope) {
        await saveOfflineSessionHint(data.ra, data.cacheScope).catch(() => {});
      }
      if (data.restrictedExperience) {
        setShowRestrictedExperience(true);
        await clearLegacyPwaCaches().catch(() => {});
        if (!await prepareRestrictedNavigation()) return;
      }
      window.location.replace('/app/calendario');
    } catch {
      setError(getLoginFailureView('NETWORK_ERROR'));
    } finally {
      setIsLoading(false);
    }
  };

  if (showRestrictedExperience) return <Own3dScreen />;

  return (
    <>
      <Card className="academic-panel overflow-visible rounded-[1.75rem]">
        <CardContent className="p-5 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence initial={false}>
            {error && (
              <motion.div initial={reducedMotion ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                <div
                  className="liquid-float liquid-notice liquid-notice-error flex items-start gap-3 p-4"
                  role="alert"
                  aria-live="polite"
                >
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <div>
                      <p className="text-sm font-medium text-red-800 dark:text-red-200">
                        {error.title}
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        {error.message}
                      </p>
                    </div>
                    {error.showPortalLink ? <div className="pt-2 border-t border-red-200 dark:border-red-900/50">
                      <p className="text-xs text-red-700 dark:text-red-300 flex items-start gap-1.5">
                        <Server className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                        <span>
                          Confira também o{' '}
                          <a
                            href="https://fundacaoeducacional132827.rm.cloudtotvs.com.br"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 font-medium underline hover:no-underline"
                          >
                            portal oficial
                            <ExternalLink className="h-3 w-3" />
                          </a>
                          .
                        </span>
                      </p>
                    </div> : null}
                  </div>
                </div>
              </motion.div>
            )}
            </AnimatePresence>

            <motion.div initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reducedMotion ? 0 : 0.12 }} className="space-y-2">
              <Label htmlFor="codUsuario" className="text-xs font-bold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
                RA
              </Label>
              <Input
                id="codUsuario"
                type="text"
                placeholder="Digite seu RA"
                value={codUsuario}
                onChange={(e) => setCodUsuario(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="username"
                inputMode="numeric"
                className="h-12"
              />
            </motion.div>

            <motion.div initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reducedMotion ? 0 : 0.18 }} className="space-y-2">
              <Label htmlFor="senha" className="text-xs font-bold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
                Senha (EduConnect)
              </Label>
              <Input
                id="senha"
                type="password"
                placeholder="Digite sua senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="current-password"
                className="h-12"
              />
            </motion.div>

            <div className="!mt-6">
              <Button
                type="submit"
                className="h-12 w-full rounded-2xl text-sm font-extrabold"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
            </div>

          </form>
        </CardContent>
      </Card>

      <button
        type="button"
        onClick={() => setIsSecurityModalOpen(true)}
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold text-gray-600 transition-colors hover:bg-primary/5 hover:text-primary dark:text-gray-300 dark:hover:text-primary"
      >
        <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        Isso é seguro?
      </button>

      <Dialog open={isSecurityModalOpen} onOpenChange={setIsSecurityModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
              <span className="icon-orb size-9"><Shield className="size-[18px]" /></span>
              Segurança e privacidade
            </DialogTitle>
            <DialogDescription>Como o SapoConnect protege o acesso e renova sua sessão.</DialogDescription>
          </DialogHeader>

          <div className="no-scrollbar mt-1 max-h-[66dvh] space-y-3 overflow-y-auto pr-0.5">
            <section className="rounded-[1.2rem] border border-primary/15 bg-primary/[0.055] p-4 dark:bg-primary/[0.07]">
              <div className="flex items-start gap-3">
                <span className="icon-orb size-9"><Lock className="size-[18px]" /></span>
                <div className="min-w-0">
                  <h4 className="text-sm font-extrabold text-gray-950 dark:text-white">
                  Reconexão protegida e sem banco de senhas
                  </h4>
                  <div className="mt-2 space-y-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                    <p><strong className="text-gray-800 dark:text-gray-100">Não existe banco de credenciais.</strong> A reconexão usa um cookie criptografado e HttpOnly, que o JavaScript da interface não consegue ler.</p>
                    <p>Esse cookie só participa da autenticação para renovar o acesso quando a sessão da TOTVS expira.</p>
                    <p>Instalações antigas podem manter uma cópia criptografada no IndexedDB do navegador por até 7 dias durante a migração. Depois disso, ela é apagada.</p>
                  </div>
                </div>
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-2">
              <section className="rounded-[1.1rem] border border-white/80 bg-white/55 p-4 dark:border-white/[0.08] dark:bg-white/[0.035]">
                <Code className="size-5 text-primary" aria-hidden="true" />
                <h4 className="mt-3 text-sm font-extrabold text-gray-950 dark:text-white">Código aberto</h4>
                <p className="mt-1 text-xs leading-5 text-gray-600 dark:text-gray-300">O projeto pode ser verificado e auditado por qualquer pessoa.</p>
                <a href="https://github.com/lucaversa/sapoconnect" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80">
                  Ver no GitHub <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              </section>
              <section className="rounded-[1.1rem] border border-white/80 bg-white/55 p-4 dark:border-white/[0.08] dark:bg-white/[0.035]">
                <GraduationCap className="size-5 text-primary" aria-hidden="true" />
                <h4 className="mt-3 text-sm font-extrabold text-gray-950 dark:text-white">De aluno para aluno</h4>
                <p className="mt-1 text-xs leading-5 text-gray-600 dark:text-gray-300">Criado para tornar notas, faltas e horários mais claros no celular.</p>
              </section>
            </div>

            <p className="rounded-2xl border border-gray-200/75 bg-gray-950/[0.025] px-4 py-3 text-center text-xs leading-5 text-gray-500 dark:border-white/[0.07] dark:bg-white/[0.025] dark:text-gray-400">
              <strong className="text-gray-700 dark:text-gray-200">Importante:</strong> solicitações, financeiro e requerimentos continuam no portal oficial da instituição.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
