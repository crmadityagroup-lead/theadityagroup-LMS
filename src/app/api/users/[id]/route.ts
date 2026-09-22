import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, isSuperAdmin } from '@/lib/auth';
import { DEPARTMENTS } from '@/lib/department-constants';

function requestedDepartments(body: any) {
  const values: unknown[] = Array.isArray(body.departments) ? body.departments : (typeof body.department === 'string' ? [body.department] : []);
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && DEPARTMENTS.includes(value as typeof DEPARTMENTS[number])))];
}

// GET /api/users/[id] — get a single user (super admin)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  const { id } = await params;
  const target = await db.crmUser.findUnique({
    where: { id: parseInt(id, 10) },
    select: { id: true, name: true, email: true, phone: true, role: true, dealerId: true, department: true, departments: true, active: true, emailVerified: true, lastLoginAt: true, lastActiveAt: true, createdAt: true, dealer: { select: { name: true, code: true } } },
  });
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  const enquiry_types = await db.crmUserEnquiryType.findMany({ where: { userId: parseInt(id, 10) }, select: { enquiryType: { select: { id: true, name: true, categoryId: true } } } });
  return NextResponse.json({
    user: { ...target, dealer_id: target.dealerId, dealer_name: target.dealer?.name || null, dealer_code: target.dealer?.code || null, dealer: undefined },
    enquiry_types: enquiry_types.map((e: any) => e.enquiryType),
  });
}

// PATCH /api/users/[id] — update user (super admin)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  const { id } = await params;
  const uid = parseInt(id, 10);
  const target = await db.crmUser.findUnique({ where: { id: uid }, select: { id: true, role: true, department: true, departments: true } });
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  const b = await req.json();
  const departments = b.departments !== undefined || b.department !== undefined
    ? requestedDepartments(b)
    : (target.departments.length ? target.departments : (target.department ? [target.department] : []));
  const nextRole = b.role ?? target.role;
  if (b.role && ['admin_2', 'data_operator_2', 'department_user'].includes(nextRole) && !b.dealer_id) {
    return NextResponse.json({ error: 'Dealer is required for this role' }, { status: 400 });
  }
  if (nextRole === 'department_user' && departments.length === 0) {
    return NextResponse.json({ error: 'Select at least one department for department users' }, { status: 400 });
  }
  if (nextRole === 'operator') return NextResponse.json({ error: 'The operator role has been retired' }, { status: 400 });
  const updates: any = {};
  const allowed = ['name', 'phone', 'role', 'dealer_id', 'active'];
  for (const k of allowed) {
    if (b[k] !== undefined) updates[k === 'dealer_id' ? 'dealerId' : k] = b[k];
  }
  if (b.departments !== undefined || b.department !== undefined) {
    updates.departments = departments;
    updates.department = departments[0] || null;
  }
  if (Object.keys(updates).length > 0) {
    await db.crmUser.update({ where: { id: uid }, data: updates });
  }
  if (Array.isArray(b.enquiry_type_ids) && nextRole === 'department_user') {
    await db.crmUserEnquiryType.deleteMany({ where: { userId: uid } });
    for (const etId of b.enquiry_type_ids) {
      await db.crmUserEnquiryType.upsert({ where: { userId_enquiryTypeId: { userId: uid, enquiryTypeId: etId } }, update: {}, create: { userId: uid, enquiryTypeId: etId } });
    }
  }
  return NextResponse.json({ message: 'User updated' });
}

// DELETE /api/users/[id] — soft-delete (recycle)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  const { id } = await params;
  const uid = parseInt(id, 10);
  if (uid === user.id) return NextResponse.json({ error: 'Cannot deactivate yourself' }, { status: 400 });
  const target = await db.crmUser.findUnique({ where: { id: uid }, select: { email: true } });
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  await db.crmUser.update({ where: { id: uid }, data: { active: false, recycledAt: new Date() } });
  await db.crmLoginHistory.create({ data: { userId: uid, email: target.email, action: 'user_recycled', userAgent: `Recycled by ${user.email}` } });
  return NextResponse.json({ message: 'User moved to recycle bin' });
}
