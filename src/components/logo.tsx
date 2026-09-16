'use client';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

interface LogoProps {
  className?: string;
  /** Show the full logo with "ADITYA GROUP" text, or just the sunburst icon */
  variant?: 'full' | 'icon';
  /** Height in px */
  size?: number;
}

/**
 * Aditya Group logo — swaps based on theme.
 * - Light mode → /logo-light.png  (sunburst + black "ADITYA GROUP" text — reads on light bg)
 * - Dark mode  → /logo.png        (sunburst only — gold rays read on dark bg)
 *
 * variant="full"  → theme-aware image swap. Uses explicit width + height to avoid
 *                   the next/image "width or height modified" warning.
 * variant="icon"  → always /logo.png (sunburst only) on a white rounded chip
 */
export function Logo({ className = '', variant = 'full', size = 32 }: LogoProps) {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const isDark = mounted && (resolvedTheme === 'dark' || theme === 'dark');

  // Icon variant — sunburst on white chip, consistent in both themes
  if (variant === 'icon') {
    return (
      <div
        className={`relative flex items-center justify-center overflow-hidden shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        <Image
          src={isDark ? '/logo.png' : '/logo-light.png'}
          alt="Aditya Group"
          width={size}
          height={size}
          style={{ width: 'auto', height: 'auto' }}
          priority
        />
      </div>
    );
  }

  // Full variant — explicit width + height (no fill, no CSS conflicts)
  // logo-light.png aspect ratio is ~1.29:1 (2790x2165), logo.png is ~1.29:1 too
  const h = size;
  const w = Math.round(size * 1.3);
  return (
    <div className={`flex items-center justify-center shrink-0 ${className}`} style={{ height: h }}>
      <Image
        src={isDark ? '/logo.png' : '/logo-light.png'}
        alt="Aditya Group"
        width={w}
        height={h}
        style={{ width: 'auto', height: '100%' }}
        priority
      />
    </div>
  );
}
