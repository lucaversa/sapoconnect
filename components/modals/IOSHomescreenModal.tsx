'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, Smartphone } from 'lucide-react';
import {
    Dialog,
    DialogContent,
} from '@/components/ui/dialog';

const IOS_HOMESCREEN_KEY = 'sapoconnect_ios_homescreen_shown';

// Check if device is iOS
function isIOS(): boolean {
    if (typeof window === 'undefined') return false;
    const userAgent = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent);
}

// Check if already installed as PWA
function isStandalone(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

// Tutorial images - place these in public/tutorial/
const TUTORIAL_IMAGES = [
    '/tutorial/ios-step-1.png',
    '/tutorial/ios-step-2.png',
    '/tutorial/ios-step-3.png',
    '/tutorial/ios-step-4.png',
    '/tutorial/ios-step-5.png',
];

interface IOSHomescreenModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function IOSHomescreenModal({ isOpen, onClose }: IOSHomescreenModalProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const touchStartX = useRef(0);
    const touchEndX = useRef(0);

    // Total slides = intro + images
    const totalSlides = TUTORIAL_IMAGES.length + 1;
    const isLastSlide = currentIndex === totalSlides - 1;
    const isIntroSlide = currentIndex === 0;

    const handleClose = () => {
        localStorage.setItem(IOS_HOMESCREEN_KEY, 'true');
        setCurrentIndex(0);
        onClose();
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        touchEndX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = () => {
        const diff = touchStartX.current - touchEndX.current;
        const threshold = 50;

        if (diff > threshold && currentIndex < totalSlides - 1) {
            // Swipe left - next
            setCurrentIndex(prev => prev + 1);
        } else if (diff < -threshold && currentIndex > 0) {
            // Swipe right - previous
            setCurrentIndex(prev => prev - 1);
        }
    };

    // Reset index when modal opens
    useEffect(() => {
        if (isOpen) {
            setCurrentIndex(0);
        }
    }, [isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-sm p-0 overflow-hidden max-h-[90vh]">
                {/* Carousel Container */}
                <div
                    className="relative w-full overflow-hidden touch-pan-y"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    <div
                        className="flex transition-transform duration-300 ease-out"
                        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
                    >
                        {/* Intro Slide */}
                        <div className="w-full flex-shrink-0 p-8 flex flex-col items-center justify-center min-h-[400px] bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-950/30 dark:to-gray-900">
                            <div className="w-20 h-20 rounded-2xl bg-emerald-500 flex items-center justify-center mb-6 shadow-lg">
                                <Smartphone className="w-10 h-10 text-white" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-3">
                                Adicionar à Tela Inicial
                            </h2>
                            <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
                                Instale o SapoConnect como um app no seu iPhone/iPad
                            </p>
                            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
                                <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                    Siga os passos a seguir
                                </span>
                            </div>
                        </div>

                        {/* Image Slides */}
                        {TUTORIAL_IMAGES.map((src, index) => (
                            <div
                                key={index}
                                className="w-full flex-shrink-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 p-4"
                            >
                                <img
                                    src={src}
                                    alt={`Passo ${index + 1}`}
                                    className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Dots Indicator */}
                <div className="flex justify-center gap-2 py-3 bg-white dark:bg-gray-900">
                    {Array.from({ length: totalSlides }).map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentIndex(index)}
                            className={`h-2 rounded-full transition-all ${index === currentIndex
                                    ? 'bg-emerald-500 w-6'
                                    : 'bg-gray-300 dark:bg-gray-600 w-2'
                                }`}
                        />
                    ))}
                </div>

                {/* Action Button */}
                <div className="p-4 pt-0">
                    {isLastSlide ? (
                        <button
                            onClick={handleClose}
                            className="w-full px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors"
                        >
                            Entendi!
                        </button>
                    ) : (
                        <button
                            onClick={() => setCurrentIndex(prev => prev + 1)}
                            className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
                        >
                            {isIntroSlide ? 'Começar' : 'Próximo'}
                        </button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Auto-show modal for iOS users on first visit
export function IOSHomescreenAutoModal() {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        // Only show on iOS, not already installed, and not shown before
        const hasShown = localStorage.getItem(IOS_HOMESCREEN_KEY);

        if (isIOS() && !isStandalone() && !hasShown) {
            // Delay to let theme modal show first
            const timer = setTimeout(() => {
                setIsOpen(true);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    return <IOSHomescreenModal isOpen={isOpen} onClose={() => setIsOpen(false)} />;
}

// Export helper to check if we should show the menu button
export function shouldShowHomescreenButton(): boolean {
    if (typeof window === 'undefined') return false;
    return isIOS() && !isStandalone();
}
