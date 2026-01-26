'use client';

import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';

const THEME_CHOSEN_KEY = 'sapoconnect_theme_chosen';

export function ThemeChoiceModal() {
    const [isOpen, setIsOpen] = useState(false);
    const { theme, toggleTheme } = useTheme();

    useEffect(() => {
        // Check if user has already chosen theme
        const hasChosenTheme = localStorage.getItem(THEME_CHOSEN_KEY);
        if (!hasChosenTheme) {
            // Small delay to ensure smooth initial render
            const timer = setTimeout(() => {
                setIsOpen(true);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleChooseTheme = (selectedTheme: 'light' | 'dark') => {
        // If current theme is different, toggle it
        if (theme !== selectedTheme) {
            toggleTheme();
        }
        // Mark as chosen
        localStorage.setItem(THEME_CHOSEN_KEY, 'true');
        setIsOpen(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-center text-xl">
                        Escolha seu tema
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        Como você prefere visualizar o SapoConnect?
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-4 mt-4">
                    {/* Light Theme Option */}
                    <button
                        onClick={() => handleChooseTheme('light')}
                        className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-gray-200 dark:border-gray-700 hover:border-amber-400 dark:hover:border-amber-500 transition-all hover:scale-105 bg-white dark:bg-gray-800"
                    >
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-300 to-orange-400 flex items-center justify-center shadow-lg">
                            <Sun className="w-8 h-8 text-white" />
                        </div>
                        <span className="font-semibold text-gray-900 dark:text-white">
                            Claro
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 text-center">
                            Ideal para uso diurno
                        </span>
                    </button>

                    {/* Dark Theme Option */}
                    <button
                        onClick={() => handleChooseTheme('dark')}
                        className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 transition-all hover:scale-105 bg-white dark:bg-gray-800"
                    >
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                            <Moon className="w-8 h-8 text-white" />
                        </div>
                        <span className="font-semibold text-gray-900 dark:text-white">
                            Escuro
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 text-center">
                            Confortável para os olhos
                        </span>
                    </button>
                </div>

                <p className="text-xs text-center text-gray-400 mt-4">
                    Você pode alterar isso depois no menu
                </p>
            </DialogContent>
        </Dialog>
    );
}
