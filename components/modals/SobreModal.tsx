'use client';

import {
  Shield,
  Zap,
  Calendar,
  BookOpen,
  Clock,
  GraduationCap,
  Github,
  Lock,
  Smartphone
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';

interface SobreModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SobreModal({ isOpen, onClose }: SobreModalProps) {
  const features = [
    {
      icon: Calendar,
      title: 'Horários',
      description: 'Visualize sua grade horária semanal com calendário interativo',
      color: 'from-blue-500/20 to-indigo-500/20',
      iconColor: 'text-blue-600 dark:text-blue-400',
      delay: '0ms'
    },
    {
      icon: BookOpen,
      title: 'Avaliações',
      description: 'Acompanhe suas notas por disciplina e categoria',
      color: 'from-purple-500/20 to-pink-500/20',
      iconColor: 'text-purple-600 dark:text-purple-400',
      delay: '100ms'
    },
    {
      icon: Clock,
      title: 'Faltas',
      description: 'Monitore sua frequência e evite reprovações',
      color: 'from-amber-500/20 to-orange-500/20',
      iconColor: 'text-amber-600 dark:text-amber-400',
      delay: '200ms'
    },
    {
      icon: GraduationCap,
      title: 'Histórico',
      description: 'Acompanhe seu progresso acadêmico completo',
      color: 'from-emerald-500/20 to-teal-500/20',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      delay: '300ms'
    }
  ];

  const securityFeatures = [
    {
      icon: Lock,
      title: 'Criptografia AES-256',
      description: 'Suas credenciais são criptografadas com padrão militar'
    },
    {
      icon: Shield,
      title: 'Sem banco de dados',
      description: 'Nenhum dado pessoal é armazenado em servidores'
    },
    {
      icon: Smartphone,
      title: 'Sessão local',
      description: 'Tudo fica apenas no seu navegador'
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <Zap className="h-5 w-5 text-emerald-500" />
            Sobre o SapoConnect
          </DialogTitle>
          <DialogDescription className="sr-only"></DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <img
                src="/sapo.png"
                alt="SapoConnect Logo"
                className="w-14 sm:w-16 h-auto object-contain"
              />
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <Zap className="w-4 h-4 text-emerald-500" />
              <span className="text-xs sm:text-sm font-medium text-emerald-600 dark:text-emerald-400">
                Acesso rápido ao portal da faculdade
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Bem-vindo ao <span className="text-emerald-500 dark:text-emerald-400">Sapo</span>Connect
            </h2>

            <p className="text-sm text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
              Uma interface alternativa e moderna para acessar suas informações acadêmicas do sistema TOTVS EduConnect.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1"
                  style={{ animationDelay: feature.delay }}
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-3`}>
                    <Icon className={`w-6 h-6 ${feature.iconColor}`} />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-500" />
              Como funciona?
            </h3>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center flex-shrink-0 text-sm">
                  1
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">Faça login</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Use seu RA e senha do portal oficial
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center flex-shrink-0 text-sm">
                  2
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">Conexão segura</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Buscamos seus dados diretamente do sistema
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center flex-shrink-0 text-sm">
                  3
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">Visualize tudo</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Horários, notas, faltas e histórico organizados
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-500" />
              Segurança em primeiro lugar
            </h3>

            <div className="grid sm:grid-cols-3 gap-4">
              {securityFeatures.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.title} className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{feature.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{feature.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-center space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-lg mx-auto">
              <strong>Importante:</strong> Este app não substitui o portal oficial. Solicitações, financeiro e
              requerimentos devem ser feitos diretamente pelo portal da instituição.
            </p>

            <a
              href="https://github.com/lucaversa/sapoconnect"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Github className="w-4 h-4" />
              Ver no GitHub
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
