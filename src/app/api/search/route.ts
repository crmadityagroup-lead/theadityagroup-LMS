import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, ROLES, seesOnlyCreatedLeads, visibleDealerIds, visibleDepartment, isSuperAdmin } from '@/lib/auth';

// GET /api/search?q=<query> — search leads + users within scope
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const q = req.nextUrl.searchParams.get('q') || '';
  if (q.trim().length < 2) return NextResponse.json({ leads: [], users: [] });

  const where: any = { OR: [
    { leadCode: { contains: q, mode: 'insensitive' } },
    { customerName: { contains: q, mode: 'insensitive' } },
    { mobile: { contains: q, mode: 'insensitive' } },
    { email: { contains: q, mode: 'insensitive' } },
  ] };
  const dealerIds = visibleDealerIds(user);
  if (dealerIds !== null) {
    if (dealerIds.length === 0) return NextResponse.json({ leads: [], users: [] });
    where.AND = [{ dealerId: { in: dealerIds } }];
  }
  const dept = visibleDepartment(user);
  if (dept !== null) {
    where.AND = [...(where.AND || []), { department: dept }];
  }
  if (user.role === ROLES.DEPT_USER) {
    where.AND = [...(where.AND || []), { assignedUserId: user.id }];
  }
  if (seesOnlyCreatedLeads(user)) {
    where.AND = [...(where.AND || []), { createdBy: user.id }];
  }

  const leads = await db.crmLead.findMany({
    where,
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: { id: true, leadCode: true, customerName: true, mobile: true, status: true, priority: true, dealer: { select: { name: true } }, brand: { select: { name: true } }, model: { select: { name: true } } },
  });

  let users: any[] = [];
  if (isSuperAdmin(user)) {
    const userWhere: any = { OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ] };
    if (dealerIds !== null) {
      userWhere.AND = [{ dealerId: { in: dealerIds } }];
    }
    users = await db.crmUser.findMany({
      where: userWhere,
      take: 10,
      select: { id: true, name: true, email: true, role: true, active: true, dealer: { select: { name: true } } },
    });
  }

  return NextResponse.json({
    leads: leads.map((l: any) => ({
      route: 'leads', arg: l.id,
      title: l.leadCode, subtitle: l.customerName,
      meta: `${l.dealer?.name || ''} · ${l.brand?.name || ''} ${l.model?.name || ''} · ${l.status}`.replace(/\s+/g, ' ').trim(),
    })),
    users: users.map((u: any) => ({
      route: 'users', arg: undefined,
      title: u.name, subtitle: u.email,
      meta: `${u.role} · ${u.dealer?.name || 'Group'} · ${u.active ? 'Active' : 'Inactive'}`,
    })),
  });
}
