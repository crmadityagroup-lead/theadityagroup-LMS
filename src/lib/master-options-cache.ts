import { api } from '@/lib/api-client';

const typesCache = new Map<string, Promise<any>>();
const usersCache = new Map<string, Promise<any>>();
const masterCache = new Map<string, Promise<any>>();
const MASTER_CACHE_TTL_MS = 5 * 60 * 1000;
// Bump this when the master catalogue changes so old browser sessions do not
// hide newly added categories or enquiry types for up to five minutes.
const MASTER_CATALOGUE_VERSION = 'v2';

function storageKey(path: string) {
  return `crm:master-cache:${MASTER_CATALOGUE_VERSION}:${path}`;
}

// Only these lookup lists are global. Dealer and eligible-user responses are
// permission-scoped, so they stay in memory for the current page only.
function isSessionCacheable(path: string) {
  return path.startsWith('/master/enquiry-categories') || path.startsWith('/master/enquiry-types');
}

function readStored(path: string) {
  if (typeof window === 'undefined' || !isSessionCacheable(path)) return null;
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(storageKey(path)) || 'null');
    return stored && Date.now() - stored.savedAt < MASTER_CACHE_TTL_MS ? stored.value : null;
  } catch {
    return null;
  }
}

function store(path: string, value: any) {
  if (typeof window === 'undefined' || !isSessionCacheable(path)) return;
  try { window.sessionStorage.setItem(storageKey(path), JSON.stringify({ savedAt: Date.now(), value })); } catch {}
}

function cached(path: string) {
  if (!masterCache.has(path)) {
    const stored = readStored(path);
    if (stored) {
      masterCache.set(path, Promise.resolve(stored));
      return masterCache.get(path)!;
    }
    const request = api.get(path).then((value) => {
      store(path, value);
      return value;
    }).catch((error) => {
      masterCache.delete(path);
      throw error;
    });
    masterCache.set(path, request);
  }
  return masterCache.get(path)!;
}

export function getCachedMaster(path: string) {
  return cached(path);
}

export function getCachedEnquiryTypes(categoryId: string) {
  if (!typesCache.has(categoryId)) {
    const path = `/master/enquiry-types?category_id=${categoryId}`;
    const stored = readStored(path);
    if (stored) typesCache.set(categoryId, Promise.resolve(stored));
    else typesCache.set(categoryId, api.get(path).then((value) => { store(path, value); return value; }).catch((error) => { typesCache.delete(categoryId); throw error; }));
  }
  return typesCache.get(categoryId)!;
}

export function getCachedEligibleUsers(dealerId: string, department: string, typeId: string) {
  const key = `${dealerId}:${department}:${typeId}`;
  if (!usersCache.has(key)) {
    const path = `/master/eligible-users?dealer_id=${dealerId}&department=${encodeURIComponent(department)}&enquiry_type_id=${typeId}`;
    const stored = readStored(path);
    if (stored) usersCache.set(key, Promise.resolve(stored));
    else usersCache.set(key, api.get(path).then((value) => { store(path, value); return value; }).catch((error) => { usersCache.delete(key); throw error; }));
  }
  return usersCache.get(key)!;
}
