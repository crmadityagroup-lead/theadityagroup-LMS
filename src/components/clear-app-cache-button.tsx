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
  if (bytes < 1024) return '0KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function ClearAppCacheButton({ canClear }: { canClear: boolean }) {
  const [clearing, setClearing] = useState(false);
  const [cacheBytes, setCacheBytes] = useState(0);
  const firstRead = useRef(true);

  async function updateCacheSize() {
    try {
      let bytes = 0;
      if ('caches' in window) {
        const cacheNames = await window.caches.keys();
        for (const cacheName of cacheNames) {
          const cache = await window.caches.open(cacheName);
          const requests = await cache.keys();
          const sizes = await Promise.all(requests.map(async (request) => {
            try { return (await cache.match(request))?.clone().blob().then((blob) => blob.size) || 0; }
            catch { return 0; }
          }));
          bytes += sizes.reduce((total, size) => total + size, 0);
        }
      }
      // Include application storage that this button can clear. Browser HTTP cache is
      // intentionally not exposed by browsers, so it cannot be measured precisely.
      const encoder = new TextEncoder();
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (key) bytes += encoder.encode(key + (window.localStorage.getItem(key) || '')).length;
      }
      for (let index = 0; index < window.sessionStorage.length; index += 1) {
        const key = window.sessionStorage.key(index);
        if (key) bytes += encoder.encode(key + (window.sessionStorage.getItem(key) || '')).length;
      }
      setCacheBytes(bytes);
    } catch { setCacheBytes(0); }
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
    const versionTimer = window.setInterval(() => void checkVersion(), 30000);
    const sizeTimer = window.setInterval(() => void updateCacheSize(), 5000);
    const onVisible = () => { if (document.visibilityState === 'visible') void updateCacheSize(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { active = false; window.clearInterval(versionTimer); window.clearInterval(sizeTimer); document.removeEventListener('visibilitychange', onVisible); };
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
  const cacheSize = formatBytes(cacheBytes);
  return <Button type="button" size="icon" className="fixed bottom-5 right-5 z-30 aspect-square h-14 w-14 !rounded-full border-2 border-white bg-green-600 p-0 text-black shadow-xl hover:bg-green-500" style={{ borderRadius: '9999px' }} onClick={() => void clearForEveryone()} disabled={clearing} title={`Refresh all users' app cache (${cacheSize} can be cleared)`} aria-label={`Refresh all users app cache, ${cacheSize} can be cleared`}>
    <span className={`flex aspect-square h-9 w-9 items-center justify-center !rounded-full bg-white shadow-sm ${clearing ? 'animate-pulse' : ''}`} style={{ borderRadius: '9999px', clipPath: 'circle(50%)' }}><img src="/cache-clean.svg" alt="" className="h-7 w-7" /></span>
    <span className={`absolute -right-2 -top-1 min-w-7 rounded-full border-2 border-background px-1 text-[9px] font-bold leading-5 text-white ${cacheBytes >= 1024 ? 'bg-red-600' : 'bg-green-700'}`}>{cacheSize}</span>
  </Button>;
}
