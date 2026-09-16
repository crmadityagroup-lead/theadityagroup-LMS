'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'aditya-crm-theme-colors';

export const DEFAULT_THEME_COLORS = {
  background: '#ffffff',
  foreground: '#000000',
  primary: '#000000',
  primaryForeground: '#ffffff',
  accent: '#d89b27',
  accentForeground: '#000000',
  card: '#ffffff',
  cardForeground: '#000000',
  muted: '#f4f4f5',
  mutedForeground: '#52525b',
  border: '#000000',
  sidebar: '#ffffff',
  sidebarForeground: '#000000',
  sidebarAccent: '#d89b27',
  sidebarAccentForeground: '#000000',
  chart1: '#3B82F6',
  chart2: '#8B5CF6',
  chart3: '#F97316',
  chart4: '#22C55E',
  chart5: '#EF4444',
};

type ThemeColors = typeof DEFAULT_THEME_COLORS;

const CSS_VARIABLES: Record<keyof ThemeColors, string> = {
  background: '--background', foreground: '--foreground', primary: '--primary', primaryForeground: '--primary-foreground',
  accent: '--accent', accentForeground: '--accent-foreground', card: '--card', cardForeground: '--card-foreground',
  muted: '--muted', mutedForeground: '--muted-foreground', border: '--border', sidebar: '--sidebar',
  sidebarForeground: '--sidebar-foreground', sidebarAccent: '--sidebar-accent', sidebarAccentForeground: '--sidebar-accent-foreground',
  chart1: '--chart-1', chart2: '--chart-2', chart3: '--chart-3', chart4: '--chart-4', chart5: '--chart-5',
};

function applyThemeColors(colors: ThemeColors) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  (Object.keys(CSS_VARIABLES) as Array<keyof ThemeColors>).forEach((key) => {
    root.style.setProperty(CSS_VARIABLES[key], colors[key]);
  });
  // Existing branded controls use the gold token rather than --accent.
  root.style.setProperty('--color-gold', colors.accent);
  root.style.setProperty('--color-gold-deep', colors.accent);
  root.style.setProperty('--color-gold-hover', colors.accent);
  root.style.setProperty('--ring', colors.accent);
}

async function loadGlobalTheme(): Promise<ThemeColors | null> {
  try {
    const response = await fetch('/api/theme', { cache: 'no-store' });
    if (!response.ok) return null;
    const payload = await response.json();
    const colors = { ...DEFAULT_THEME_COLORS, ...(payload.colors || {}) };
    applyThemeColors(colors);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
    window.dispatchEvent(new Event('aditya-theme-colors-change'));
    return colors;
  } catch {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const colors = { ...DEFAULT_THEME_COLORS, ...JSON.parse(saved) };
        applyThemeColors(colors);
        return colors;
      }
    } catch { /* Keep CSS defaults. */ }
    return null;
  }
}

export function ThemeColorApplier() {
  useEffect(() => {
    void loadGlobalTheme();
  }, []);
  return null;
}

const COLOR_FIELDS: Array<{ key: keyof ThemeColors; label: string }> = [
  { key: 'background', label: 'Page background' },
  { key: 'foreground', label: 'Page text' },
  { key: 'primary', label: 'Primary buttons' },
  { key: 'primaryForeground', label: 'Primary button text' },
  { key: 'accent', label: 'Accent' },
  { key: 'accentForeground', label: 'Accent text' },
  { key: 'card', label: 'Cards and panels' },
  { key: 'cardForeground', label: 'Card text' },
  { key: 'muted', label: 'Muted surfaces' },
  { key: 'mutedForeground', label: 'Muted text' },
  { key: 'border', label: 'Borders' },
  { key: 'sidebar', label: 'Sidebar background' },
  { key: 'sidebarForeground', label: 'Sidebar text' },
  { key: 'sidebarAccent', label: 'Sidebar active item' },
  { key: 'sidebarAccentForeground', label: 'Sidebar active text' },
  { key: 'chart1', label: 'Chart color 1' },
  { key: 'chart2', label: 'Chart color 2' },
  { key: 'chart3', label: 'Chart color 3' },
  { key: 'chart4', label: 'Chart color 4' },
  { key: 'chart5', label: 'Chart color 5' },
];

export function ThemeColorPicker() {
  const [colors, setColors] = useState<ThemeColors>(DEFAULT_THEME_COLORS);

  useEffect(() => {
    void loadGlobalTheme().then((saved) => { if (saved) setColors(saved); });
  }, []);

  function updateColor(key: keyof ThemeColors, value: string) {
    const next = { ...colors, [key]: value };
    setColors(next);
    applyThemeColors(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event('aditya-theme-colors-change'));
    void fetch('/api/theme', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ colors: next }) });
  }

  function resetColors() {
    setColors(DEFAULT_THEME_COLORS);
    applyThemeColors(DEFAULT_THEME_COLORS);
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event('aditya-theme-colors-change'));
    void fetch('/api/theme', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ colors: DEFAULT_THEME_COLORS }) });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {COLOR_FIELDS.map(({ key, label }) => (
          <label key={key} className="flex items-center justify-between gap-3 rounded-md border-2 border-border p-3 text-sm font-medium">
            <span>{label}</span>
            <span className="flex items-center gap-2 shrink-0">
              <span className="font-mono text-[10px] uppercase text-muted-foreground">{colors[key]}</span>
              <input type="color" value={colors[key]} onChange={(event) => updateColor(key, event.target.value)} className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0" aria-label={label} />
            </span>
          </label>
        ))}
      </div>
      <button type="button" onClick={resetColors} className="cursor-pointer rounded-md border-2 border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted">Reset default colors</button>
    </div>
  );
}
