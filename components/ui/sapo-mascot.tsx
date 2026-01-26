'use client';

import { useState } from 'react';

interface SapoMascotProps {
  className?: string;
}

export function SapoMascot({ className = '' }: SapoMascotProps) {
  const [imageError, setImageError] = useState(false);

  // Parse width from className (e.g., "w-8 h-8" -> "2rem" for both)
  const sizeClass = className.match(/w-\d+/)?.[0] || 'w-8';
  const sizeMap: Record<string, string> = {
    'w-6': '1.5rem',
    'w-7': '1.75rem',
    'w-8': '2rem',
    'w-9': '2.25rem',
    'w-10': '2.5rem',
    'w-12': '3rem',
    'w-14': '3.5rem',
    'w-16': '4rem',
    'w-20': '5rem',
    'w-24': '6rem',
    'w-32': '8rem',
    'w-40': '10rem',
    'w-48': '12rem',
  };
  const size = sizeMap[sizeClass] || '2rem';

  if (imageError) {
    return (
      <div
        className="flex items-center justify-center bg-primary/10 rounded-full shrink-0"
        style={{ width: size, height: size }}
      >
        <span className="text-primary font-bold">SC</span>
      </div>
    );
  }

  return (
    <img
      src="/sapo.png"
      alt="Sapo Saporrada"
      className={`object-contain drop-shadow-lg hover:scale-105 transition-transform duration-300 shrink-0 ${className}`}
      onError={() => setImageError(true)}
      style={{ width: size, height: size }}
    />
  );
}
