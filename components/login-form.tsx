'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { saveCredentials } from '@/lib/storage';
import { forceCheckSession } from '@/lib/auth-client';
import { AlertCircle, Loader2, Shield, Github, Lock, Code, GraduationCap, Server, ExternalLink } from 'lucide-react';

export function LoginForm() {
  const router = useRouter();
  const [codUsuario, setCodUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);

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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao fazer login');
      }

      await saveCredentials({ codUsuario, senha });
      // Atualiza o estado da sessão no client para remover o banner de sessão expirada.
      void forceCheckSession();
      router.push('/app/calendario');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Card className="shadow-theme-lg border-0">
        <CardContent className="p-5 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-5">
            {error && (
              <div className="animate-in slide-in-from-top-2 duration-300">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <div>
                      <p className="text-sm font-medium text-red-800 dark:text-red-200">
                        Não foi possível fazer login
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        Verifique seu RA e senha e tente novamente.
                      </p>
                    </div>
                    <div className="pt-2 border-t border-red-200 dark:border-red-900/50">
                      <p className="text-xs text-red-700 dark:text-red-300 flex items-start gap-1.5">
                        <Server className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                        <span>
                          Se o problema persistir, o sistema da faculdade (EduConnect) pode estar fora do ar.
                          Tente acessar o{' '}
                          <a
                            href="https://fundacaoeducacional132827.rm.cloudtotvs.com.br"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 font-medium underline hover:no-underline"
                          >
                            portal oficial
                            <ExternalLink className="h-3 w-3" />
                          </a>
                          {' '}para verificar.
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1 sm:space-y-2 animate-in fade-in slide-in-from-top-2 duration-300 delay-100">
              <Label htmlFor="codUsuario" className="text-gray-700 dark:text-gray-300 text-xs sm:text-sm font-medium">
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
                className="h-9 sm:h-11 text-sm border-gray-200 dark:border-gray-700 focus:border-primary focus:ring-primary/20 transition-all duration-200"
              />
            </div>

            <div className="space-y-1 sm:space-y-2 animate-in fade-in slide-in-from-top-2 duration-300 delay-200">
              <Label htmlFor="senha" className="text-gray-700 dark:text-gray-300 text-xs sm:text-sm font-medium">
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
                className="h-9 sm:h-11 text-sm border-gray-200 dark:border-gray-700 focus:border-primary focus:ring-primary/20 transition-all duration-200"
              />
            </div>

            <div className="!mt-6 sm:!mt-5">
              <Button
                type="submit"
                className="w-full h-9 sm:h-11 text-xs sm:text-sm font-semibold shadow-theme-sm hover:shadow-theme-md transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 animate-in fade-in slide-in-from-top-2 duration-300 delay-300"
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
        className="mt-5 sm:mt-4 w-full flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors duration-200 animate-in fade-in slide-in-from-top-2 duration-500 delay-400"
      >
        <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        Isso é seguro?
      </button>

      <Dialog open={isSecurityModalOpen} onOpenChange={setIsSecurityModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
              <Shield className="h-5 w-5 text-primary" />
              Segurança e Privacidade
            </DialogTitle>
            <DialogDescription className="sr-only"></DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Seus dados ficam com você
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  <strong>Não existe banco de dados</strong>. Suas credenciais são criptografadas e armazenadas apenas no seu dispositivo. Todas as requisições são feitas diretamente pela API oficial do sistema da faculdade.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Code className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Projeto Open Source
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Este é um projeto de código aberto. Qualquer pessoa pode verificar e auditar o código-fonte para garantir a segurança.
                </p>
                <a
                  href="https://github.com/lucaversa/sapoconnect"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  <Github className="h-4 w-4" />
                  Ver no GitHub
                </a>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Feito por alunos, para alunos
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Desenvolvido por estudantes para facilitar a navegação de notas, faltas e horários de forma mais intuitiva e moderna.
                </p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                <strong className="text-gray-600 dark:text-gray-300">Importante:</strong> Este aplicativo não substitui o portal oficial da faculdade. Solicitações, financeiro e demais requerimentos devem ser tratados diretamente pelo portal da instituição.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
