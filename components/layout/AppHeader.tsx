'use client';

import { useSidebar } from '@/context/SidebarContext';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { clearCredentials } from '@/lib/storage';
import { ThemeToggleButton } from '@/components/tailadmin-ui/common/ThemeToggleButton';
import { useUserInfo } from '@/hooks/use-user-info';
import { useTheme } from '@/context/ThemeContext';
import { MoreVertical, LogOut, Sun, Moon, Plus } from 'lucide-react';
import { IOSHomescreenModal, shouldShowHomescreenButton } from '@/components/modals/IOSHomescreenModal';

export function AppHeader() {
  const { isExpanded, isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showHomescreenModal, setShowHomescreenModal] = useState(false);
  const [canShowHomescreen, setCanShowHomescreen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { ra, greeting } = useUserInfo();
  const { theme, toggleTheme } = useTheme();

  // Check if we should show the add to homescreen button (iOS only)
  useEffect(() => {
    setCanShowHomescreen(shouldShowHomescreenButton());
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setIsDropdownOpen(false);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      await clearCredentials();
      router.push('/login');
    } catch (error) {
      setIsLoggingOut(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-20 bg-white border-b border-gray-200 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        {/* Left - Menu Toggle */}
        {/* Mobile Toggle */}
        <button
          className="flex items-center justify-center w-10 h-10 text-gray-500 border border-gray-200 rounded-lg dark:border-gray-800 dark:text-gray-400 shrink-0 lg:hidden"
          onClick={toggleMobileSidebar}
          aria-label="Toggle Mobile Sidebar"
        >
          {isMobileOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z" fill="currentColor" />
            </svg>
          ) : (
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M0.583252 1C0.583252 0.585788 0.919038 0.25 1.33325 0.25H14.6666C15.0808 0.25 15.4166 0.585786 15.4166 1C15.4166 1.41421 15.0808 1.75 14.6666 1.75L1.33325 1.75C0.919038 1.75 0.583252 1.41422 0.583252 1ZM0.583252 11C0.583252 10.5858 0.919038 10.25 1.33325 10.25L14.6666 10.25C15.0808 10.25 15.4166 10.5858 15.4166 11C15.4166 11.4142 15.0808 11.75 14.6666 11.75L1.33325 11.75C0.919038 11.75 0.583252 11.4142 0.583252 11ZM1.33325 5.25C0.919038 5.25 0.583252 5.58579 0.583252 6C0.583252 6.41421 0.919038 6.75 1.33325 6.75L7.99992 6.75C8.41413 6.75 8.74992 6.41421 8.74992 6C8.74992 5.58579 8.41413 5.25 7.99992 5.25L1.33325 5.25Z" fill="currentColor" />
            </svg>
          )}
        </button>

        {/* Desktop Toggle */}
        <button
          className="hidden lg:flex items-center justify-center w-10 h-10 text-gray-500 border border-gray-200 rounded-lg dark:border-gray-800 dark:text-gray-400 shrink-0"
          onClick={toggleSidebar}
          aria-label="Toggle Sidebar"
        >
          {isExpanded ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z" fill="currentColor" />
            </svg>
          ) : (
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M0.583252 1C0.583252 0.585788 0.919038 0.25 1.33325 0.25H14.6666C15.0808 0.25 15.4166 0.585786 15.4166 1C15.4166 1.41421 15.0808 1.75 14.6666 1.75L1.33325 1.75C0.919038 1.75 0.583252 1.41422 0.583252 1ZM0.583252 11C0.583252 10.5858 0.919038 10.25 1.33325 10.25L14.6666 10.25C15.0808 10.25 15.4166 10.5858 15.4166 11C15.4166 11.4142 15.0808 11.75 14.6666 11.75L1.33325 11.75C0.919038 11.75 0.583252 11.4142 0.583252 11ZM1.33325 5.25C0.919038 5.25 0.583252 5.58579 0.583252 6C0.583252 6.41421 0.919038 6.75 1.33325 6.75L7.99992 6.75C8.41413 6.75 8.74992 6.41421 8.74992 6C8.74992 5.58579 8.41413 5.25 7.99992 5.25L1.33325 5.25Z" fill="currentColor" />
            </svg>
          )}
        </button>

        {/* Center - Greeting + RA */}
        <div className="absolute left-1/2 -translate-x-1/2">
          <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white text-center">
            <span>{greeting}</span>
            {ra && <span className="text-gray-600 dark:text-gray-400">, RA: {ra}</span>}
          </p>
        </div>

        {/* Right - Actions */}
        <div className="flex items-center gap-3 ml-auto">
          {/* Desktop: Show buttons normally */}
          <div className="hidden sm:flex items-center gap-3">
            <ThemeToggleButton />

            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 transition-colors border border-red-200 rounded-lg hover:bg-red-50 dark:border-red-800/50 dark:text-red-400 dark:hover:bg-red-900/10 disabled:opacity-50"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden xl:inline">{isLoggingOut ? 'Saindo...' : 'Sair'}</span>
            </button>
          </div>

          {/* Mobile: Dropdown menu */}
          <div className="relative sm:hidden" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center justify-center w-10 h-10 text-gray-500 border border-gray-200 rounded-lg dark:border-gray-800 dark:text-gray-400"
              aria-label="Menu de opções"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {/* Dropdown */}
            {isDropdownOpen && (
              <div className="absolute right-0 top-12 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-50">
                <button
                  onClick={() => {
                    toggleTheme();
                    setIsDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {theme === 'dark' ? (
                    <Sun className="w-4 h-4" />
                  ) : (
                    <Moon className="w-4 h-4" />
                  )}
                  {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
                </button>

                {/* Add to Homescreen - iOS only */}
                {canShowHomescreen && (
                  <button
                    onClick={() => {
                      setShowHomescreenModal(true);
                      setIsDropdownOpen(false);
                    }}
                    className="w-full flex items-center justify-start gap-3 px-4 py-3 text-sm text-left text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar à Tela Inicial
                  </button>
                )}

                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                >
                  <LogOut className="w-4 h-4" />
                  {isLoggingOut ? 'Saindo...' : 'Sair'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* iOS Homescreen Modal */}
      <IOSHomescreenModal
        isOpen={showHomescreenModal}
        onClose={() => setShowHomescreenModal(false)}
      />
    </header>
  );
}
