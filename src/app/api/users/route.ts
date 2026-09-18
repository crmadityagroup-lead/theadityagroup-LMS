import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, isSuperAdmin, visibleDealerIds } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// GET /api/users — list users within scope
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Department user: cannot list users (only sees themselves)
  if (user.role === 'department_user') {
    const me = await db.crmUser.findMany({
      where: { id: user.id },
      select: { id: true, name: true, email: true, phone: true, role: true, dealerId: true, department: true, active: true, lastLoginAt: true, createdAt: true },
    });
    return NextResponse.json({ users: me });
  }
  if (!isSuperAdmin(user) && user.role !== 'admin' && !['data_operator_1', 'data_operator_2'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const dealerIds = visibleDealerIds(user);
  const where: any = { active: true };
  if (dealerIds !== null) {
    if (dealerIds.length === 0) return NextResponse.json({ users: [] });
    where.dealerId = { in: dealerIds };
  }

  const users = await db.crmUser.findMany({
    where,
    select: { id: true, name: true, email: true, phone: true, role: true, dealerId: true, department: true, active: true, emailVerified: true, lastLoginAt: true, createdAt: true, dealer: { select: { name: true, code: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const avatarRows = users.length
    ? await db.$queryRaw<Array<{ id: number; avatar_data: string | null }>>(Prisma.sql`SELECT id, avatar_data FROM crm_users WHERE id IN (${Prisma.join(users.map((item) => item.id))})`)
    : [];
  const avatarsByUserId = new Map(avatarRows.map((avatar) => [avatar.id, avatar.avatar_data]));
  const out = users.map((u: any) => ({ ...u, avatar_data: avatarsByUserId.get(u.id) || null, dealer_id: u.dealerId, dealer_name: u.dealer?.name || null, dealer_code: u.dealer?.code || null, dealer: undefined }));
  return NextResponse.json({ users: out });
}

// POST /api/users — super admin creates a user
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  const b = await req.json();
  if (!b.name || !b.email || !b.role) return NextResponse.json({ error: 'name, email, role are required' }, { status: 400 });
  const validRoles = ['super_admin', 'admin', 'data_operator_1', 'data_operator_2', 'department_user'];
  if (!validRoles.includes(b.role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  if (['data_operator_2', 'department_user'].includes(b.role) && !b.dealer_id) {
    return NextResponse.json({ error: 'Dealer is required for this role' }, { status: 400 });
  }
  if (b.role === 'department_user' && !b.department) {
    return NextResponse.json({ error: 'Department is required for department users' }, { status: 400 });
  }

  const existing = await db.crmUser.findUnique({ where: { email: b.email }, select: { id: true, recycledAt: true } });
  if (existing) {
    if (existing.recycledAt) {
      return NextResponse.json({ error: 'This email belongs to a recycled user. Permanently delete them from the Recycle Bin first, then try again.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
  }

  const hash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
  const created = await db.crmUser.create({
    data: {
      name: b.name, email: b.email, phone: b.phone || null, passwordHash: hash,
      role: b.role, dealerId: b.dealer_id || null, department: b.department || null,
      active: b.active !== false, emailVerified: true,
    },
    select: { id: true },
  });

  if (b.role === 'department_user' && Array.isArray(b.enquiry_type_ids)) {
    for (const etId of b.enquiry_type_ids) {
      await db.crmUserEnquiryType.upsert({ where: { userId_enquiryTypeId: { userId: created.id, enquiryTypeId: etId } }, update: {}, create: { userId: created.id, enquiryTypeId: etId } });
    }
  }
  await db.crmLoginHistory.create({ data: { userId: created.id, email: b.email, action: 'user_created', userAgent: `Created by ${user.email}` } });
  return NextResponse.json({ id: created.id, message: 'User created. They can sign in with OTP using their email.' }, { status: 201 });
}
