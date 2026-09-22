import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, ROLES, seesOnlyCreatedLeads, visibleDealerIds, visibleDepartments } from '@/lib/auth';

// GET /api/dashboard — role-scoped dashboard stats
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const where: any = { AND: [{ status: { not: 'recycled' } }] };
  const params = new URL(req.url).searchParams;
  const dealerParam = params.get('dealer_id');
  const departmentParam = params.get('department');
  const statusParam = params.get('status');
  const priorityParam = params.get('priority');
  const fromDateParam = params.get('from_date');
  const toDateParam = params.get('to_date');
  const dealerFilter = dealerParam ? Number(dealerParam) : null;
  if (dealerParam && (dealerFilter === null || !Number.isInteger(dealerFilter) || dealerFilter <= 0)) {
    return NextResponse.json({ error: 'Invalid dealer filter' }, { status: 400 });
  }
  const parseDate = (value: string | null, endOfDay = false) => {
    if (!value) return null;
    const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const fromDate = parseDate(fromDateParam);
  const toDate = parseDate(toDateParam, true);
  if ((fromDateParam && !fromDate) || (toDateParam && !toDate)) {
    return NextResponse.json({ error: 'Invalid date filter' }, { status: 400 });
  }
  const dealerIds = visibleDealerIds(user);
  if (dealerIds !== null) {
    if (dealerIds.length === 0) return NextResponse.json({ total: 0, by_status: {}, by_priority: {}, by_department: [], by_dealer: [], dealer_options: [], dealer_status_breakdown: [], followups_due_today: 0, overdue_followups: 0, new_unworked: 0, high_critical: 0, recently_assigned: 0, upcoming_followups: 0, recent_leads: [] });
    where.AND.push({ dealerId: { in: dealerIds } });
  }
  const departments = visibleDepartments(user);
  if (departments !== null) where.AND.push({ department: { in: departments } });
  if (user.role === ROLES.DEPT_USER) where.AND.push({ assignedUserId: user.id });
  if (seesOnlyCreatedLeads(user)) where.AND.push({ createdBy: user.id });
  if (dealerFilter !== null) where.AND.push({ dealerId: dealerFilter });
  if (departmentParam) where.AND.push({ department: departmentParam });
  if (statusParam) where.AND.push({ status: statusParam });
  if (priorityParam) where.AND.push({ priority: priorityParam });
  if (fromDate || toDate) where.AND.push({ createdAt: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } });

  const activeStatusFilter = { status: { notIn: ['converted', 'closed', 'lost', 'recycled'] } };
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysAhead = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const loadMetrics = () => Promise.all([
    db.crmLead.count({ where }),
    db.crmLead.groupBy({ by: ['status'], where, _count: true }),
    db.crmLead.groupBy({ by: ['priority'], where, _count: true }),
    db.crmLead.groupBy({ by: ['department'], where, _count: true, orderBy: { _count: { department: 'desc' } } }),
    db.crmLead.groupBy({ by: ['dealerId'], where, _count: true }),
    // dealer × status cross-tab via Prisma groupBy (then pivot in JS below)
    db.crmLead.findMany({ where, take: 10, orderBy: { createdAt: 'desc' }, select: { id: true, leadCode: true, customerName: true, mobile: true, priority: true, status: true, nextFollowupDate: true, createdAt: true, department: true, dealer: { select: { name: true } }, brand: { select: { name: true } }, model: { select: { name: true } }, enquiryType: { select: { name: true } } } }),
    db.crmLead.count({ where: { ...where, AND: [...where.AND, { nextFollowupDate: { gte: todayStart, lt: todayEnd } }, activeStatusFilter] } }),
    db.crmLead.count({ where: { ...where, AND: [...where.AND, { nextFollowupDate: { lt: today } }, activeStatusFilter] } }),
    db.crmLead.count({ where: { ...where, AND: [...where.AND, { status: 'new' }] } }),
    db.crmLead.count({ where: { ...where, AND: [...where.AND, { priority: { in: ['High', 'Critical'] } }, activeStatusFilter] } }),
    db.crmLead.count({ where: { ...where, AND: [...where.AND, { createdAt: { gt: sevenDaysAgo } }] } }),
    db.crmLead.count({ where: { ...where, AND: [...where.AND, { nextFollowupDate: { gte: today, lte: sevenDaysAhead } }, activeStatusFilter] } }),
  ]);

  let metrics: Awaited<ReturnType<typeof loadMetrics>> | null = null;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2 && !metrics; attempt += 1) {
    try {
      metrics = await loadMetrics();
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }
  if (!metrics) {
    console.error('Dashboard metrics query failed:', lastError);
    return NextResponse.json({ error: 'Dashboard data is temporarily unavailable. Please retry.' }, { status: 503 });
  }
  const [total, statusRows, priorityRows, deptRows, dealerRows, recentLeads, todayDue, overdue, newUnworked, highCrit, recentAssigned, upcoming] = metrics;

  const statusMap: Record<string, number> = {};
  statusRows.forEach((s: any) => { statusMap[s.status] = s._count; });
  const priorityMap: Record<string, number> = {};
  priorityRows.forEach((p: any) => { priorityMap[p.priority] = p._count; });

  // Dealer names for by_dealer
  const dealerIdsSet = dealerRows.map((d: any) => d.dealerId).filter(Boolean);
  const dealers = dealerIdsSet.length > 0 ? await db.crmDealer.findMany({ where: { id: { in: dealerIdsSet } }, select: { id: true, name: true } }) : [];
  const dealerNameMap = new Map(dealers.map((d: any) => [d.id, d.name]));
  const dealerOptions = await db.crmDealer.findMany({
    where: dealerIds === null ? { active: true } : { id: { in: dealerIds }, active: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

    return NextResponse.json({
    total,
    by_status: statusMap,
    by_priority: priorityMap,
    dealer_options: dealerOptions,
    by_department: deptRows.map((d: any) => ({ department: d.department || '(none)', c: d._count })),
    by_dealer: dealerRows.map((d: any) => ({ id: d.dealerId, name: dealerNameMap.get(d.dealerId) || '—', c: d._count })),
    dealer_status_breakdown: [],
    followups_due_today: todayDue,
    overdue_followups: overdue,
    new_unworked: newUnworked,
    high_critical: highCrit,
    recently_assigned: recentAssigned,
    upcoming_followups: upcoming,
    recent_leads: recentLeads.map((l: any) => ({
      id: l.id, lead_code: l.leadCode, customer_name: l.customerName, mobile: l.mobile, priority: l.priority, status: l.status, next_followup_date: l.nextFollowupDate, created_at: l.createdAt,
      dealer_name: l.dealer?.name || null, brand_name: l.brand?.name || null, model_name: l.model?.name || null, enquiry_type_name: l.enquiryType?.name || null, department: l.department,
    })),
    user: { id: user.id, name: user.name, role: user.role, department: user.department, dealer_id: user.dealer_id },
    });
  } catch (error) {
    console.error('Dashboard request failed:', error);
    return NextResponse.json({ error: 'Dashboard data is temporarily unavailable. Please retry.' }, { status: 503 });
  }
}
