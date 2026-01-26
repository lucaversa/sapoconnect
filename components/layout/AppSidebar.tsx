'use client';

import { useSidebar } from '@/context/SidebarContext';
import { useSession } from '@/lib/session-provider';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SapoMascot } from '@/components/ui/sapo-mascot';
import { Calendar, XCircle, Star, Clock, ExternalLink, GraduationCap, Github, Wifi, WifiOff, Info } from 'lucide-react';
import { SobreModal } from '@/components/modals/SobreModal';
import {
  ChevronLeftIcon,
} from '@/icons';
import { useState, useEffect } from 'react';

function formatLastUpdate(timestamp: number | undefined): string {
  if (!timestamp) return 'desconhecido';

  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  if (hours < 24) return `há ${hours}h`;
  return `há ${days}d`;
}

const menuItems = [
  { icon: <Calendar className="w-5 h-5" />, label: 'Horários', href: '/app/calendario' },
  { icon: <XCircle className="w-5 h-5" />, label: 'Faltas', href: '/app/faltas' },
  { icon: <Star className="w-5 h-5" />, label: 'Avaliações', href: '/app/avaliacoes' },
  { icon: <Clock className="w-5 h-5" />, label: 'Histórico', href: '/app/historico' },
];

export function AppSidebar() {
  const { isExpanded, isMobileOpen, isHovered, toggleSidebar, setIsHovered } = useSidebar();
  const pathname = usePathname();
  const { user } = useSession();
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [isConnected, setIsConnected] = useState(true);
  const [isSobreOpen, setIsSobreOpen] = useState(false);

  const showLabel = isExpanded || isHovered || isMobileOpen;

  // Verificar conexão e atualizar tempo periodicamente
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch('/api/auth/session');
        setIsConnected(response.ok);
        if (response.ok) {
          const data = await response.json();
          setLastUpdate(data.lastExternalLoginAt || Date.now());
        }
      } catch {
        setIsConnected(false);
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  // Atualizar quando session mudar
  useEffect(() => {
    if (user) {
      setLastUpdate(Date.now());
      setIsConnected(true);
    }
  }, [user]);

  return (
    <aside
      className={`fixed top-0 left-0 z-50 h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 ${showLabel ? 'w-64' : 'w-20'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="h-20 flex items-center justify-between px-3 border-b border-gray-100 dark:border-gray-800">
          <Link href="/app/calendario" className="flex items-center gap-3">
            <SapoMascot className="w-14 h-14" />
            {showLabel && (
              <div className="flex flex-col">
                <span className="text-lg font-semibold leading-tight">
                  <span className="text-emerald-500 dark:text-emerald-400">Sapo</span>
                  <span className="text-gray-900 dark:text-white">Connect</span>
                </span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  de{' '}
                  <span
                    className="italic font-semibold text-emerald-500/80 dark:text-emerald-400/80"
                    style={{ fontFamily: "var(--font-playfair-display), Georgia, serif" }}
                  >
                    aluno
                  </span>
                  {' '}para{' '}
                  <span className="relative inline-block">
                    <span
                      className="italic font-semibold text-emerald-500/80 dark:text-emerald-400/80"
                      style={{ fontFamily: "var(--font-playfair-display), Georgia, serif" }}
                    >
                      aluno
                    </span>
                    <svg
                      className="absolute -bottom-0.5 left-0 w-full h-1.5 text-emerald-400/70 dark:text-emerald-500/60"
                      viewBox="0 0 100 8"
                      preserveAspectRatio="none"
                    >
                      <path
                        d="M2,5 Q25,3 50,5 T98,4"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        fill="none"
                      />
                    </svg>
                  </span>
                </span>
              </div>
            )}
          </Link>
          {showLabel && (
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ChevronLeftIcon className={`w-5 h-5 text-gray-500 transition-transform ${!isExpanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>

        {/* Menu */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                  }`}
              >
                <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                  {item.icon}
                </span>
                {showLabel && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>



        {/* Portal Link */}
        <div className="p-3 border-t border-gray-100 dark:border-gray-800 space-y-1">
          <a
            href="https://fundacaoeducacional132827.rm.cloudtotvs.com.br/FrameHTML/Web/App/Edu/PortalEducacional/login/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-emerald-50 dark:text-gray-300 dark:hover:bg-emerald-950/30 transition-colors group"
          >
            <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <GraduationCap className="w-5 h-5" />
            </span>
            {showLabel && (
              <>
                <span className="flex-1">Portal Oficial</span>
                <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-emerald-500 transition-colors" />
              </>
            )}
          </a>
          <a
            href="https://github.com/lucaversa/sapoconnect"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors group"
          >
            <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-gray-600 dark:text-gray-400">
              <Github className="w-5 h-5" />
            </span>
            {showLabel && (
              <>
                <span className="flex-1">GitHub</span>
                <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
              </>
            )}
          </a>
          <button
            type="button"
            onClick={() => setIsSobreOpen(true)}
            className="w-full flex items-center justify-start gap-3 px-3 py-2.5 rounded-lg text-left text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
            aria-label="Sobre"
          >
            <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-gray-600 dark:text-gray-400">
              <Info className="w-5 h-5" />
            </span>
            {showLabel && <span className="flex-1 text-left">Sobre</span>}
          </button>

          {/* Session Status */}
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs">
            <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
              {isConnected ? (
                <Wifi className="w-4 h-4 text-emerald-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
            </span>
            {showLabel && (
              <div className="flex flex-col">
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {isConnected ? 'Conectado' : 'Desconectado'}
                </span>
                <span className="text-gray-400 dark:text-gray-500">
                  Atualizado {formatLastUpdate(lastUpdate)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      <SobreModal isOpen={isSobreOpen} onClose={() => setIsSobreOpen(false)} />
    </aside>
  );
}
