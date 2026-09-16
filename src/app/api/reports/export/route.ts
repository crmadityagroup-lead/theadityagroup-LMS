import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { buildLeadFilters, LeadFilterError } from '@/lib/lead-filters';

// GET /api/reports/export — CSV export of leads within scope
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response('Not authenticated', { status: 401 });
  if (user.role === 'department_user') return new Response('Reports are not available for Department Users', { status: 403 });

  let where;
  try { where = buildLeadFilters(user, req.nextUrl.searchParams); }
  catch (error) { return new Response(error instanceof LeadFilterError ? error.message : 'Invalid filters', { status: 400 }); }

  const leads = await db.crmLead.findMany({
    where,
    take: 5000,
    orderBy: { createdAt: 'desc' },
    select: {
      leadCode: true, customerName: true, mobile: true, email: true, location: true, source: true, referralCustomerName: true, priority: true, status: true, department: true, createdAt: true, nextFollowupDate: true, closedAt: true,
      dealer: { select: { name: true } }, brand: { select: { name: true } }, model: { select: { name: true } },
      enquiryCategory: { select: { name: true } }, enquiryType: { select: { name: true } },
      assignedUser: { select: { name: true } }, createdByUser: { select: { name: true } },
    },
  });

  const headers = ['Lead Code', 'Customer', 'Mobile', 'Email', 'Location', 'Source', 'Reference Customer', 'Dealer', 'Brand', 'Model', 'Category', 'Enquiry Type', 'Department', 'Priority', 'Status', 'Assigned To', 'Created By', 'Created At', 'Next Follow-up', 'Closed At'];
  const rows = leads.map((l: any) => [
    l.leadCode, l.customerName, l.mobile, l.email || '', l.location || '', l.source || '',
    l.referralCustomerName || '', l.dealer?.name || '', l.brand?.name || '', l.model?.name || '',
    l.enquiryCategory?.name || '', l.enquiryType?.name || '', l.department,
    l.priority, l.status, l.assignedUser?.name || '', l.createdByUser?.name || '',
    l.createdAt.toISOString(), l.nextFollowupDate?.toISOString() || '', l.closedAt?.toISOString() || '',
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="crm-leads-${Date.now()}.csv"`,
    },
  });
}
