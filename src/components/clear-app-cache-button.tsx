'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';

const CACHE_VERSION_KEY = 'aditya-crm-cache-version';

async function clearBrowserCache() {
  if ('caches' in window) {
    const names = await window.caches.keys();
    await Promise.all(names.map((name) => window.caches.delete(name)));
  }
  // Authentication is an httpOnly cookie and is intentionally not touched.
  window.localStorage.clear();
  window.sessionStorage.clear();
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function ClearAppCacheButton({ canClear }: { canClear: boolean }) {
  const [clearing, setClearing] = useState(false);
  const [cacheSize, setCacheSize] = useState('0B');
  const firstRead = useRef(true);

  async function updateCacheSize() {
    try {
      const estimate = await navigator.storage?.estimate?.();
      setCacheSize(formatBytes(estimate?.usage || 0));
    } catch { setCacheSize('—'); }
  }

  useEffect(() => {
    let active = true;
    async function checkVersion() {
      try {
        const result = await api.get<{ version: number }>('/system/cache-refresh');
        if (!active) return;
        const nextVersion = result.version || 0;
        void updateCacheSize();
        const knownVersion = Number(window.localStorage.getItem(CACHE_VERSION_KEY) || '0');
        if (firstRead.current) {
          firstRead.current = false;
          window.localStorage.setItem(CACHE_VERSION_KEY, String(nextVersion));
          return;
        }
        if (nextVersion > knownVersion) {
          toast.info('App cache cleared in the background.');
          await clearBrowserCache();
          window.localStorage.setItem(CACHE_VERSION_KEY, String(nextVersion));
          await updateCacheSize();
        }
      } catch { /* Retry on the next polling cycle. */ }
    }
    void checkVersion();
    void updateCacheSize();
    const timer = window.setInterval(() => void checkVersion(), 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  async function clearForEveryone() {
    if (clearing || !canClear) return;
    setClearing(true);
    try {
      const result = await api.post<{ version: number }>('/system/cache-refresh');
      await clearBrowserCache();
      window.localStorage.setItem(CACHE_VERSION_KEY, String(result.version || 0));
      await updateCacheSize();
      toast.success('Global cache refresh sent. Active users will clear cache within 30 seconds without reloading.');
    } catch (error: any) {
      toast.error(error.message || 'Could not refresh the app cache.');
    } finally { setClearing(false); }
  }

  if (!canClear) return null;
  return <Button type="button" size="icon" className="fixed bottom-5 right-5 z-30 aspect-square h-14 w-14 !rounded-full border-2 border-white bg-green-600 p-0 text-black shadow-xl hover:bg-green-500" style={{ borderRadius: '9999px' }} onClick={() => void clearForEveryone()} disabled={clearing} title={`Refresh all users' app cache (${cacheSize} browser storage used)`} aria-label={`Refresh all users app cache, ${cacheSize} browser storage used`}>
    <span className={`flex aspect-square h-9 w-9 items-center justify-center !rounded-full bg-white shadow-sm ${clearing ? 'animate-pulse' : ''}`} style={{ borderRadius: '9999px', clipPath: 'circle(50%)' }}><img src="/cache-clean.svg" alt="" className="h-7 w-7" /></span>
    <span className="absolute -right-2 -top-1 min-w-7 rounded-full border-2 border-background bg-black px-1 text-[9px] font-bold leading-5 text-white">{cacheSize}</span>
  </Button>;
}
