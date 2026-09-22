// Auth helpers: JWT signing/verification, role checks, scope helpers.
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { db } from './db';
import { cookies } from 'next/headers';

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  ADMIN_2: 'admin_2',
  DATA_OP_1: 'data_operator_1',
  DATA_OP_2: 'data_operator_2',
  DEPT_USER: 'department_user',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

export interface AuthUser {
  id: number;
  email: string;
  phone?: string | null;
  avatar_data?: string | null;
  role: string;
  name: string;
  dealer_id: number | null;
  dealer_name?: string | null;
  department: string | null;
  departments?: string[];
  active?: boolean;
  email_verified?: boolean;
  last_login_at?: string | null;
  last_active_at?: string;
  created_at?: string;
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required; refusing to start without a configured signing secret');
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const COOKIE_NAME = 'crm_token';
const AUTH_CACHE_TTL_MS = 10_000;
const authCache = new Map<string, { user: AuthUser; expiresAt: number }>();

export function signToken(user: { id: number; email: string; role: string; name: string; dealer_id: number | null; department: string | null; departments?: string[] }) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name, dealer_id: user.dealer_id, department: user.department, departments: user.departments || [] },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    return decoded;
  } catch {
    return null;
  }
}

/** Get the logged-in user from the httpOnly cookie OR Authorization: Bearer header.
 *  Refreshes from DB to catch role/active changes. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  let token = cookieStore.get(COOKIE_NAME)?.value;
  // Also accept Bearer token (for API clients / programmatic access)
  if (!token) {
    const { headers } = await import('next/headers');
    const h = await headers();
    const auth = h.get('authorization') || '';
    if (auth.startsWith('Bearer ')) token = auth.slice(7);
  }
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded) return null;
  const cached = authCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached.user;
  // Refresh from DB
  const [row, avatarRows] = await Promise.all([
    db.crmUser.findUnique({
    where: { id: decoded.id },
    select: { id: true, name: true, email: true, phone: true, role: true, dealerId: true, department: true, departments: true, active: true, emailVerified: true, lastLoginAt: true, lastActiveAt: true, createdAt: true, dealer: { select: { name: true } } },
    }),
    // Use a raw read for the optional avatar field so deployments with an older
    // generated Prisma client can still authenticate while rolling out this feature.
    db.$queryRaw<Array<{ avatar_data: string | null }>>(Prisma.sql`SELECT avatar_data FROM crm_users WHERE id = ${decoded.id}`),
  ]);
  if (!row || !row.active) return null;
  // Map to snake_case for API response (frontend expects dealer_id, email_verified, etc.)
  const user: AuthUser = {
    id: row.id, name: row.name, email: row.email, phone: row.phone, avatar_data: avatarRows[0]?.avatar_data || null, role: row.role,
    dealer_id: row.dealerId, dealer_name: row.dealer?.name || null, department: row.department, departments: row.departments.length ? row.departments : (row.department ? [row.department] : []), active: row.active,
    email_verified: row.emailVerified, last_login_at: row.lastLoginAt as any,
    last_active_at: row.lastActiveAt as any, created_at: row.createdAt as any,
  };
  // Avoid an extra database write on every API request. Presence is updated
  // only when the cached timestamp is older than five minutes.
  if (!row.lastActiveAt || Date.now() - new Date(row.lastActiveAt).getTime() > 5 * 60 * 1000) {
    void db.$executeRaw`UPDATE crm_users SET last_active_at = now() WHERE id = ${row.id}`.catch(() => {});
  }
  authCache.set(token, { user, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
  return user;
}

export function setAuthCookie(token: string) {
  const expires = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8h
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    expires,
  };
}

export function clearAuthCookie() {
  return {
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  };
}

// Role helpers
export function isAdmin(user: AuthUser | null) {
  return !!user && ([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ADMIN_2] as string[]).includes(user.role);
}
export function isSuperAdmin(user: AuthUser | null) {
  return user?.role === ROLES.SUPER_ADMIN;
}
export function isOperator(user: AuthUser | null) {
  return !!user && ([ROLES.DATA_OP_1, ROLES.DATA_OP_2] as string[]).includes(user.role);
}

/** Dealers visible to this user: null = all dealers, [] = none, [ids] = specific dealers */
export function visibleDealerIds(user: AuthUser): number[] | null {
  const allDealersRoles = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.DATA_OP_1];
  const singleDealerRoles = [ROLES.ADMIN_2, ROLES.DATA_OP_2, ROLES.DEPT_USER];
  if ((allDealersRoles as string[]).includes(user.role)) {
    if (user.role === ROLES.DATA_OP_1 && user.dealer_id) {
      return [user.dealer_id];
    }
    return null; // all
  }
  if ((singleDealerRoles as string[]).includes(user.role)) {
    return user.dealer_id ? [user.dealer_id] : [];
  }
  return [];
}

/** Department scope: null = all departments, otherwise the user's permitted departments. */
export function visibleDepartments(user: AuthUser): string[] | null {
  if (([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ADMIN_2, ROLES.DATA_OP_1, ROLES.DATA_OP_2] as string[]).includes(user.role)) {
    return null;
  }
  return user.departments?.length ? user.departments : (user.department ? [user.department] : []);
}

export function canCreateLead(user: AuthUser) {
  return ([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.DATA_OP_1, ROLES.DATA_OP_2] as string[]).includes(user.role);
}

export function seesOnlyCreatedLeads(user: AuthUser) {
  return ([ROLES.DATA_OP_1, ROLES.DATA_OP_2] as string[]).includes(user.role);
}
export function canManageLeads(user: AuthUser | null) {
  return !!user && ([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ADMIN_2] as string[]).includes(user.role);
}

export type LeadAction =
  | 'VIEW' | 'UPDATE' | 'DELETE' | 'RESTORE' | 'PERMANENT_DELETE'
  | 'ADD_FOLLOWUP' | 'UPDATE_DEPARTMENT' | 'ASSIGN' | 'REASSIGN' | 'CHANGE_STATUS';

export interface LeadAuthorizationTarget {
  dealerId: number;
  department: string | null;
  assignedUserId: number | null;
  createdBy?: number | null;
}

/** Authorize an action against the loaded lead, never against an untrusted id alone. */
export function authorizeLeadAction(user: AuthUser | null, lead: LeadAuthorizationTarget, action: LeadAction) {
  if (!user || !lead) return false;
  if (user.role === ROLES.SUPER_ADMIN) return true;

  const dealerIds = visibleDealerIds(user);
  if (dealerIds !== null && !dealerIds.includes(lead.dealerId)) return false;

  if (['DELETE', 'RESTORE', 'PERMANENT_DELETE'].includes(action)) {
    return ([ROLES.ADMIN, ROLES.ADMIN_2] as string[]).includes(user.role);
  }

  // Department Users may update the status, remark, and follow-up on their
  // assigned department leads, but cannot edit the core lead or recycle it.
  if (user.role === ROLES.DEPT_USER) {
    return ['VIEW', 'UPDATE_DEPARTMENT'].includes(action) && !!lead.department && visibleDepartments(user)?.includes(lead.department) && lead.assignedUserId === user.id;
  }
  if (seesOnlyCreatedLeads(user) && lead.createdBy !== user.id) return false;

  return [ROLES.ADMIN, ROLES.ADMIN_2, ROLES.DATA_OP_1, ROLES.DATA_OP_2].includes(user.role as any) &&
    ['VIEW', 'UPDATE', 'ADD_FOLLOWUP', 'UPDATE_DEPARTMENT', 'ASSIGN', 'REASSIGN', 'CHANGE_STATUS'].includes(action);
}
