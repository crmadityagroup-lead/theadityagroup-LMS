import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, ROLES, seesOnlyCreatedLeads, visibleDealerIds, visibleDepartment } from '@/lib/auth';
import { LEAD_STATUSES, LEAD_PRIORITIES } from '@/lib/lead-filters';

// GET /api/reports/summary — aggregated report with role scoping
// Query params: from_date, to_date, dealer_id, brand_id, department, status, source, assigned_user_id, role
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (user.role === 'department_user') return NextResponse.json({ error: 'Reports are not available for Department Users' }, { status: 403 });

  const filters = req.nextUrl.searchParams;
  const requestedStatus = filters.get('status');
  const requestedPriority = filters.get('priority');
  if (requestedStatus && !(LEAD_STATUSES as readonly string[]).includes(requestedStatus)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  if (requestedPriority && !(LEAD_PRIORITIES as readonly string[]).includes(requestedPriority)) return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
  // Recycled leads are reported only in Recycle Bin, never in analytics.
  const conds: string[] = ["l.status <> 'recycled'"];
  const params: any[] = [];
  let idx = 1;

  // Visibility scope
  const dealerIds = visibleDealerIds(user);
  if (dealerIds !== null) {
    if (dealerIds.length === 0) return NextResponse.json({ total: 0, converted: 0, conversion_rate: 0, viewer_role: user.role, by_status: [], by_dealer: [], by_brand: [], by_category: [], by_enquiry_type: [], by_department: [], by_source: [], user_workload: [] });
    conds.push(`l.dealer_id = ANY($${idx}::int[])`); params.push(dealerIds); idx++;
  }
  const dept = visibleDepartment(user);
  if (dept !== null) { conds.push(`l.department = $${idx}`); params.push(dept); idx++; }
  if (user.role === ROLES.DEPT_USER) { conds.push(`l.assigned_user_id = $${idx}`); params.push(user.id); idx++; }
  if (seesOnlyCreatedLeads(user)) { conds.push(`l.created_by = $${idx}`); params.push(user.id); idx++; }

  // Optional filters
  if (filters.get('from_date')) { conds.push(`l.created_at >= $${idx}`); params.push(filters.get('from_date')); idx++; }
  if (filters.get('to_date')) { conds.push(`l.created_at <= $${idx}`); params.push(filters.get('to_date')); idx++; }
  if (filters.get('dealer_id')) { conds.push(`l.dealer_id = $${idx}`); params.push(parseInt(filters.get('dealer_id')!, 10)); idx++; }
  if (filters.get('brand_id')) { conds.push(`l.brand_id = $${idx}`); params.push(parseInt(filters.get('brand_id')!, 10)); idx++; }
  if (filters.get('department')) { conds.push(`l.department = $${idx}`); params.push(filters.get('department')); idx++; }
  if (filters.get('status')) { conds.push(`l.status = $${idx}`); params.push(filters.get('status')); idx++; }
  if (filters.get('priority')) { conds.push(`l.priority = $${idx}`); params.push(filters.get('priority')); idx++; }
  if (filters.get('source')) { conds.push(`l.source = $${idx}`); params.push(filters.get('source')); idx++; }
  if (filters.get('assigned_user_id')) { conds.push(`l.assigned_user_id = $${idx}`); params.push(parseInt(filters.get('assigned_user_id')!, 10)); idx++; }

  const fullWhere = conds.length ? conds.join(' AND ') : 'TRUE';

  // Run all aggregations via $queryRaw so we can use Postgres FILTER + arrays
  const [byDate, byDealer, byBrand, byCategory, byType, byDept, bySource, byStatus, totalRow, convertedRow] = await Promise.all([
    db.$queryRawUnsafe(`SELECT to_char(date_trunc('day', l.created_at), 'YYYY-MM-DD') AS date, COUNT(*)::int AS c FROM crm_leads l WHERE ${fullWhere} GROUP BY 1 ORDER BY 1 LIMIT 90`, ...params),
    db.$queryRawUnsafe(`SELECT d.name, COUNT(*)::int AS c FROM crm_leads l JOIN crm_dealers d ON d.id=l.dealer_id WHERE ${fullWhere} GROUP BY d.name ORDER BY c DESC`, ...params),
    db.$queryRawUnsafe(`SELECT COALESCE(b.name,'(none)') AS name, COUNT(*)::int AS c FROM crm_leads l LEFT JOIN crm_brands b ON b.id=l.brand_id WHERE ${fullWhere} GROUP BY b.name ORDER BY c DESC`, ...params),
    db.$queryRawUnsafe(`SELECT ec.name, COUNT(*)::int AS c FROM crm_leads l JOIN crm_enquiry_categories ec ON ec.id=l.enquiry_category_id WHERE ${fullWhere} GROUP BY ec.name ORDER BY c DESC`, ...params),
    db.$queryRawUnsafe(`SELECT et.name, COUNT(*)::int AS c FROM crm_leads l JOIN crm_enquiry_types et ON et.id=l.enquiry_type_id WHERE ${fullWhere} GROUP BY et.name ORDER BY c DESC`, ...params),
    db.$queryRawUnsafe(`SELECT l.department, COUNT(*)::int AS c FROM crm_leads l WHERE ${fullWhere} GROUP BY l.department ORDER BY c DESC`, ...params),
    db.$queryRawUnsafe(`SELECT COALESCE(l.source,'(unknown)') AS name, COUNT(*)::int AS c FROM crm_leads l WHERE ${fullWhere} GROUP BY l.source ORDER BY c DESC`, ...params),
    db.$queryRawUnsafe(`SELECT l.status, COUNT(*)::int AS c FROM crm_leads l WHERE ${fullWhere} GROUP BY l.status`, ...params),
    db.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM crm_leads l WHERE ${fullWhere}`, ...params),
    db.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM crm_leads l WHERE ${fullWhere} AND l.status='converted'`, ...params),
  ]);

  // User-wise workload — include user role + email for performance report
  // Admin should NOT see super_admin users' performance
  const workloadUserWhere = user.role === ROLES.ADMIN
    ? `${fullWhere} AND (au.role IS NULL OR au.role <> 'super_admin')`
    : fullWhere;
  const workloadRoleFilter = filters.get('role') ? ` AND au.role = $${idx}` : '';
  const workloadParams = filters.get('role') ? [...params, filters.get('role')] : params;
  const userWorkload = await db.$queryRawUnsafe(
    `SELECT au.id AS user_id, au.name AS user_name, au.email AS user_email, au.role, au.department, d.name AS dealer_name, COUNT(*)::int AS c,
       COUNT(*) FILTER (WHERE l.status NOT IN ('converted','closed','lost','recycled'))::int AS active_count,
       COUNT(*) FILTER (WHERE l.status = 'converted')::int AS converted_count
     FROM crm_leads l LEFT JOIN crm_users au ON au.id=l.assigned_user_id LEFT JOIN crm_dealers d ON d.id=l.dealer_id
     WHERE ${workloadUserWhere}${workloadRoleFilter} GROUP BY au.id, au.name, au.email, au.role, au.department, d.name ORDER BY c DESC LIMIT 100`,
    ...workloadParams
  );

  const total = (totalRow as any[])[0]?.c || 0;
  const converted = (convertedRow as any[])[0]?.c || 0;
  const conversionRate = total > 0 ? parseFloat(((converted / total) * 100).toFixed(2)) : 0;

  return NextResponse.json({
    total,
    converted,
    conversion_rate: conversionRate,
    viewer_role: user.role,
    by_date: byDate,
    by_dealer: byDealer,
    by_brand: byBrand,
    by_category: byCategory,
    by_enquiry_type: byType,
    by_department: byDept,
    by_source: bySource,
    by_status: byStatus,
    user_workload: userWorkload,
  });
}
