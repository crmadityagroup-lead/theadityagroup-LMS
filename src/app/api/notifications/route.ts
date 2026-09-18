import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, isSuperAdmin, ROLES, seesOnlyCreatedLeads, visibleDealerIds, visibleDepartment } from '@/lib/auth';

let supportTableReady: Promise<void> | null = null;
function ensureSupportTable() {
  if (!supportTableReady) {
    supportTableReady = (async () => {
      await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS crm_support_tickets (id SERIAL PRIMARY KEY, token TEXT NOT NULL UNIQUE, user_id INTEGER NOT NULL REFERENCES crm_users(id) ON DELETE CASCADE, subject TEXT NOT NULL, description TEXT NOT NULL, route TEXT, user_agent TEXT, status TEXT NOT NULL DEFAULT 'open', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
      await db.$executeRawUnsafe(`ALTER TABLE crm_support_tickets ADD COLUMN IF NOT EXISTS recycled_at TIMESTAMPTZ`);
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS crm_support_tickets_status_idx ON crm_support_tickets(status)`);
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS crm_support_tickets_created_at_idx ON crm_support_tickets(created_at)`);
    })().catch((error) => { supportTableReady = null; throw error; });
  }
  return supportTableReady;
}

// GET /api/notifications?since=<ISO> — notification-worthy events for the current user
// Returns new leads + follow-ups due + overdue follow-ups, newer than `since`.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const requestUrl = new URL(req.url);
  if (requestUrl.searchParams.get('support') === '1' || requestUrl.searchParams.get('support') === 'recycled') {
    if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    await ensureSupportTable();
    const recycled = requestUrl.searchParams.get('support') === 'recycled';
    const tickets = await db.$queryRawUnsafe<Array<any>>(`SELECT t.id, t.token, t.subject, t.description, t.route, t.status, t.created_at, t.updated_at, t.recycled_at, u.id AS user_id, u.name AS user_name, u.email AS user_email, u.role AS user_role, u.avatar_data AS user_avatar_data, d.name AS dealer_name FROM crm_support_tickets t JOIN crm_users u ON u.id = t.user_id LEFT JOIN crm_dealers d ON d.id = u.dealer_id WHERE t.recycled_at IS ${recycled ? 'NOT ' : ''}NULL ORDER BY t.created_at DESC LIMIT 200`);
    return NextResponse.json({ tickets: tickets.map((ticket) => ({ id: ticket.id, token: ticket.token, subject: ticket.subject, description: ticket.description, route: ticket.route, status: ticket.status, created_at: ticket.created_at, updated_at: ticket.updated_at, recycled_at: ticket.recycled_at, user: { id: ticket.user_id, name: ticket.user_name, email: ticket.user_email, avatar_data: ticket.user_avatar_data || null, role: ticket.user_role, dealer: ticket.dealer_name ? { name: ticket.dealer_name } : null } })) });
  }

  // Use the start of the read window as the next cursor. Events committed while
  // this request is querying the database will then be picked up on the next
  // poll instead of being skipped by a cursor from the end of the query.
  const pollStartedAt = new Date();
  const url = new URL(req.url);
  const sinceParam = url.searchParams.get('since');
  const parsedSince = sinceParam ? new Date(sinceParam) : null;
  const since = parsedSince && !Number.isNaN(parsedSince.getTime()) ? parsedSince : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const where: any = { AND: [{ createdAt: { gt: since } }] };
  const dealerIds = visibleDealerIds(user);
  if (dealerIds !== null) {
    if (dealerIds.length === 0) return NextResponse.json({ notifications: [] });
    where.AND.push({ dealerId: { in: dealerIds } });
  }
  const dept = visibleDepartment(user);
  if (dept !== null) where.AND.push({ department: dept });
  if (user.role === ROLES.DEPT_USER) where.AND.push({ assignedUserId: user.id });
  const isDataOperator = [ROLES.DATA_OP_1, ROLES.DATA_OP_2].includes(user.role as any);
  // A creator should not receive their own new-lead alert. Assignment and
  // activity alerts are delivered separately to the relevant users.
  if (seesOnlyCreatedLeads(user)) where.AND.push({ createdBy: { not: user.id } });
  const notificationLeadScope: any = {};
  if (dealerIds !== null) notificationLeadScope.dealerId = { in: dealerIds };
  if (dept !== null) notificationLeadScope.department = dept;
  if (user.role === ROLES.DEPT_USER) notificationLeadScope.assignedUserId = user.id;
  if (seesOnlyCreatedLeads(user)) notificationLeadScope.createdBy = user.id;

  const newLeads = await db.crmLead.findMany({
    where,
    take: 50,
    orderBy: { createdAt: 'desc' },
    select: { id: true, leadCode: true, customerName: true, createdAt: true, status: true, priority: true, department: true, dealer: { select: { name: true } }, enquiryType: { select: { name: true } } },
  });
  const newLeadNotifications = newLeads.map((l: any) => ({
    id: `lead_${l.id}`,
    type: 'new_lead',
    lead_id: l.id,
    lead_code: l.leadCode,
    customer_name: l.customerName,
    dealer_name: l.dealer?.name || null,
    department: l.department,
    enquiry_type: l.enquiryType?.name || null,
    priority: l.priority,
    status: l.status,
    created_at: l.createdAt,
    read: false,
    message: `New lead ${l.leadCode} — ${l.customerName}`,
  }));

  // Assignments can happen after lead creation, so they need their own event query.
  const assignments = await db.crmLeadActivity.findMany({
    where: { createdAt: { gt: since }, action: 'assigned', userId: { not: user.id }, lead: notificationLeadScope },
    take: 50,
    orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
      user: { select: { name: true } },
      lead: { select: { id: true, leadCode: true, customerName: true, mobile: true, department: true, priority: true, status: true, assignedUser: { select: { name: true } }, dealer: { select: { name: true } }, brand: { select: { name: true } }, model: { select: { name: true } }, enquiryType: { select: { name: true } } } },
    },
  });
  const assignmentNotifications = assignments.map((activity: any) => ({
    id: `assignment_${activity.id}`,
    type: 'lead_assigned',
    title: 'New Lead Assigned',
    lead_id: activity.lead.id,
    lead_code: activity.lead.leadCode,
    customer_name: activity.lead.customerName,
    mobile: activity.lead.mobile,
    dealer_name: activity.lead.dealer?.name || null,
    brand_name: activity.lead.brand?.name || null,
    model_name: activity.lead.model?.name || null,
    assigned_user_name: activity.lead.assignedUser?.name || null,
    assigned_by_name: activity.user?.name || null,
    department: activity.lead.department,
    enquiry_type: activity.lead.enquiryType?.name || null,
    priority: activity.lead.priority,
    status: activity.lead.status,
    created_at: activity.createdAt,
    read: false,
    message: `Lead ${activity.lead.leadCode} assigned to you — ${activity.lead.customerName}`,
  })).filter((notification: any) => !newLeadNotifications.some((leadNotification: any) => leadNotification.lead_id === notification.lead_id));

  const statusChanges = await db.crmLeadActivity.findMany({
    where: {
      createdAt: { gt: since },
      action: { in: ['status_changed', 'remark_added'] },
      userId: { not: user.id },
      lead: notificationLeadScope,
    },
    take: 50,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      details: true,
      user: { select: { name: true } },
      lead: { select: { id: true, leadCode: true, customerName: true, mobile: true, department: true, priority: true, status: true, dealer: { select: { name: true } }, brand: { select: { name: true } }, model: { select: { name: true } } } },
    },
  });
  const statusNotifications = statusChanges.map((activity: any) => ({
    id: `status_${activity.id}`,
    type: activity.action === 'remark_added' ? 'lead_remark_added' : 'lead_status_changed',
    title: activity.action === 'remark_added' ? 'New Remark Added' : 'Lead Status Updated',
    lead_id: activity.lead.id,
    lead_code: activity.lead.leadCode,
    customer_name: activity.lead.customerName,
    mobile: activity.lead.mobile,
    dealer_name: activity.lead.dealer?.name || null,
    brand_name: activity.lead.brand?.name || null,
    model_name: activity.lead.model?.name || null,
    actor_name: activity.user?.name || null,
    from_status: activity.details?.from || null,
    to_status: activity.details?.to || null,
    remark: activity.details?.remark || null,
    department: activity.lead.department,
    priority: activity.lead.priority,
    status: activity.lead.status,
    created_at: activity.createdAt,
    read: false,
    message: `Lead ${activity.lead.leadCode} status updated to ${activity.lead.status.replaceAll('_', ' ')} — ${activity.lead.customerName}`,
  }));

  const unassignedLeads = isDataOperator ? await db.crmLead.findMany({
    where: { ...notificationLeadScope, assignedUserId: null, updatedAt: { gt: since } },
    take: 50,
    orderBy: { updatedAt: 'desc' },
    select: { id: true, leadCode: true, customerName: true, department: true, priority: true, status: true, updatedAt: true, dealer: { select: { name: true } } },
  }) : [];
  const unassignedNotifications = unassignedLeads.map((lead: any) => ({
    id: `unassigned_${lead.id}_${new Date(lead.updatedAt).getTime()}`,
    type: 'lead_unassigned',
    lead_id: lead.id,
    lead_code: lead.leadCode,
    customer_name: lead.customerName,
    dealer_name: lead.dealer?.name || null,
    department: lead.department,
    priority: lead.priority,
    status: lead.status,
    created_at: lead.updatedAt,
    read: false,
    message: `Lead ${lead.leadCode} is not assigned — ${lead.customerName}`,
  }));

  let supportNotifications: any[] = [];
  if (isSuperAdmin(user)) {
    try {
      await ensureSupportTable();
      supportNotifications = (await db.$queryRaw<Array<{ id: number; token: string; subject: string; created_at: Date; user_name: string }>>`SELECT t.id, t.token, t.subject, t.created_at, u.name AS user_name FROM crm_support_tickets t JOIN crm_users u ON u.id = t.user_id WHERE t.created_at > ${since} ORDER BY t.created_at DESC LIMIT 50`).map((ticket) => ({
        id: `support_${ticket.id}`,
        type: 'support_request',
        title: 'New Help Request',
        created_at: ticket.created_at,
        read: false,
        message: `${ticket.token} - ${ticket.user_name}: ${ticket.subject}`,
      }));
    } catch (error) {
      console.error('Support notification query failed:', error);
    }
  } else {
    try {
      await ensureSupportTable();
      supportNotifications = (await db.$queryRaw<Array<{ id: number; token: string; subject: string; updated_at: Date }>>`SELECT id, token, subject, updated_at FROM crm_support_tickets WHERE user_id = ${user.id} AND status = 'closed' AND updated_at > ${since} ORDER BY updated_at DESC LIMIT 50`).map((ticket) => ({
        id: `support_closed_${ticket.id}`,
        type: 'support_request_closed',
        title: 'Help Request Closed',
        created_at: ticket.updated_at,
        read: false,
        message: `${ticket.token}: ${ticket.subject} was closed by Super Admin`,
      }));
    } catch (error) {
      console.error('Support closure notification query failed:', error);
    }
  }

  const notifications = [...newLeadNotifications, ...assignmentNotifications, ...statusNotifications, ...unassignedNotifications, ...supportNotifications]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 50);

  return NextResponse.json({ notifications, server_time: pollStartedAt.toISOString() });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (body.kind === 'support_restore') {
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Valid ticket id is required' }, { status: 400 });
    await ensureSupportTable();
    const result = await db.$executeRawUnsafe('UPDATE crm_support_tickets SET recycled_at = NULL, updated_at = NOW() WHERE id = $1 AND recycled_at IS NOT NULL', id);
    if (!result) return NextResponse.json({ error: 'Help request is not in the recycle bin' }, { status: 404 });
    return NextResponse.json({ restored: true });
  }
  if (body.kind !== 'support_close') return NextResponse.json({ error: 'Unsupported notification request' }, { status: 400 });
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Valid ticket id is required' }, { status: 400 });
  await ensureSupportTable();
  const [ticket] = await db.$queryRaw<Array<{ id: number; status: string }>>`UPDATE crm_support_tickets SET status = 'closed', updated_at = NOW() WHERE id = ${id} AND status <> 'closed' RETURNING id, status`;
  if (!ticket) return NextResponse.json({ error: 'Ticket not found or already closed' }, { status: 404 });
  return NextResponse.json({ ticket });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (!['support', 'support_permanent'].includes(body.kind)) return NextResponse.json({ error: 'Unsupported delete request' }, { status: 400 });
  const ids = Array.isArray(body.ids) ? [...new Set(body.ids.map(Number).filter((id: number) => Number.isInteger(id) && id > 0))] : [];
  if (!ids.length) return NextResponse.json({ error: 'Select at least one help request' }, { status: 400 });
  await ensureSupportTable();
  if (body.kind === 'support_permanent') {
    const result = await db.$executeRawUnsafe(`DELETE FROM crm_support_tickets WHERE id = ANY($1::int[]) AND recycled_at IS NOT NULL`, ids);
    return NextResponse.json({ deleted: Number(result) || 0 });
  }
  const result = await db.$executeRawUnsafe(`UPDATE crm_support_tickets SET recycled_at = NOW(), updated_at = NOW() WHERE id = ANY($1::int[]) AND recycled_at IS NULL`, ids);
  return NextResponse.json({ recycled: Number(result) || 0 });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (body.kind !== 'support') return NextResponse.json({ error: 'Unsupported notification request' }, { status: 400 });
  await ensureSupportTable();
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 5000) : '';
  if (!description) return NextResponse.json({ error: 'Please describe the issue' }, { status: 400 });
  const token = `SUP-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  const subject = typeof body.subject === 'string' && body.subject.trim() ? body.subject.trim().slice(0, 160) : 'User-reported issue';
  const route = typeof body.route === 'string' ? body.route.slice(0, 200) : null;
  const userAgent = req.headers.get('user-agent')?.slice(0, 500) || null;
  const [ticket] = await db.$queryRaw<Array<{ id: number; token: string; created_at: Date }>>`INSERT INTO crm_support_tickets (token, user_id, subject, description, route, user_agent) VALUES (${token}, ${user.id}, ${subject}, ${description}, ${route}, ${userAgent}) RETURNING id, token, created_at`;
  return NextResponse.json({ ticket: { id: ticket.id, token: ticket.token, created_at: ticket.created_at } }, { status: 201 });
}
