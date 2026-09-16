'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

export function ThemeModeSelect() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-9 w-[112px]" aria-hidden="true" />;
  return (
    <label className="flex items-center">
      <span className="sr-only">Theme</span>
      <select value={theme || 'light'} onChange={(event) => setTheme(event.target.value)} aria-label="Choose application theme" className="h-9 w-[112px] cursor-pointer rounded-md border-2 border-border bg-background px-2 text-xs font-semibold text-foreground outline-none focus:border-primary">
        <option value="light">Light theme</option>
        <option value="dark">Dark theme</option>
        <option value="system">System theme</option>
      </select>
    </label>
  );
}
