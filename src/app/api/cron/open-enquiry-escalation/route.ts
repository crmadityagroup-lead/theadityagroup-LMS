import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendOpenEnquiryEscalationEmail } from '@/lib/mail';

const ESCALATION_ACTION = 'open_enquiry_escalation_email_sent';
const ACTIVE_STATUSES = ['new', 'in_progress', 'follow_up'];

// GET /api/cron/open-enquiry-escalation — called hourly by the deployment scheduler.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const leads = await db.crmLead.findMany({
    where: {
      status: { in: ACTIVE_STATUSES },
      createdAt: { lte: cutoff },
      activities: { none: { action: ESCALATION_ACTION } },
    },
    select: {
      id: true, leadCode: true, customerName: true, mobile: true, department: true, priority: true, status: true, createdAt: true,
      dealer: { select: { name: true } },
      enquiryCategory: { select: { name: true } },
      enquiryType: { select: { name: true } },
      assignedUser: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
  const recipient = process.env.OPEN_ENQUIRY_ESCALATION_RECIPIENT || 'tech@theadityagroup.com';
  const results = await Promise.allSettled(leads.map(async (lead) => {
    await sendOpenEnquiryEscalationEmail({
      leadCode: lead.leadCode,
      recipients: [recipient],
      fields: {
        'Lead code': lead.leadCode,
        Customer: lead.customerName,
        Mobile: lead.mobile,
        Dealer: lead.dealer?.name,
        'Enquiry category': lead.enquiryCategory?.name,
        'Enquiry type': lead.enquiryType?.name,
        Department: lead.department,
        'Assigned user': lead.assignedUser?.name || 'Unassigned',
        'Assigned user email': lead.assignedUser?.email || '—',
        Priority: lead.priority,
        Status: lead.status,
        'Created at': lead.createdAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      },
    });
    await db.crmLeadActivity.create({ data: { leadId: lead.id, action: ESCALATION_ACTION, details: { recipient, threshold_hours: 48 } } });
  }));
  const sent = results.filter((result) => result.status === 'fulfilled').length;
  const failed = results.length - sent;
  if (failed) console.error(`Open-enquiry escalation: ${failed} delivery failure(s).`);
  return NextResponse.json({ checked: leads.length, sent, failed });
}
