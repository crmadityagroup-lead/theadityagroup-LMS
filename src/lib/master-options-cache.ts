import { api } from '@/lib/api-client';

const typesCache = new Map<string, Promise<any>>();
const usersCache = new Map<string, Promise<any>>();
const masterCache = new Map<string, Promise<any>>();

function cached(path: string) {
  if (!masterCache.has(path)) {
    const request = api.get(path).catch((error) => {
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
  if (!typesCache.has(categoryId)) typesCache.set(categoryId, api.get(`/master/enquiry-types?category_id=${categoryId}`).catch((error) => { typesCache.delete(categoryId); throw error; }));
  return typesCache.get(categoryId)!;
}

export function getCachedEligibleUsers(dealerId: string, department: string, typeId: string) {
  const key = `${dealerId}:${department}:${typeId}`;
  if (!usersCache.has(key)) usersCache.set(key, api.get(`/master/eligible-users?dealer_id=${dealerId}&department=${encodeURIComponent(department)}&enquiry_type_id=${typeId}`).catch((error) => { usersCache.delete(key); throw error; }));
  return usersCache.get(key)!;
}
