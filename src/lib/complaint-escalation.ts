import { db } from '@/lib/db';
import { getLeadAssignees } from '@/lib/lead-assignees';
import { sendComplaintEscalationEmail } from '@/lib/mail';

const ESCALATION_RECIPIENT = 'abhijitpadhy2000@gmail.com';
const TERMINAL_STATUSES = ['converted', 'closed', 'lost', 'recycled'];
const RUN_INTERVAL_MS = 5 * 60 * 1000;

let lastRunAt = 0;
let activeRun: Promise<number> | null = null;

async function runEscalation() {
  const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const leads = await db.crmLead.findMany({
    where: {
      createdAt: { lte: cutoff },
      status: { notIn: TERMINAL_STATUSES },
      enquiryType: { name: { contains: 'Complain', mode: 'insensitive' } },
    },
    select: {
      id: true,
      leadCode: true,
      customerName: true,
      mobile: true,
      email: true,
      location: true,
      source: true,
      department: true,
      variant: true,
      priority: true,
      status: true,
      initialRemarks: true,
      nextFollowupDate: true,
      createdAt: true,
      dealer: { select: { name: true } },
      brand: { select: { name: true } },
      model: { select: { name: true } },
      enquiryCategory: { select: { name: true } },
      enquiryType: { select: { name: true } },
      createdByUser: { select: { name: true, email: true } },
      assignedUser: { select: { name: true, email: true } },
    },
  });

  let sent = 0;
  for (const lead of leads) {
    const alreadyEscalated = await db.crmLeadActivity.findFirst({
      where: { leadId: lead.id, action: 'complaint_escalated' },
      select: { id: true },
    });
    if (alreadyEscalated) continue;

    const assignees = await getLeadAssignees(lead.id);
    const assignedUsers = assignees.length > 0
      ? assignees.map((assignee) => `${assignee.name} <${assignee.email}>`)
      : lead.assignedUser ? [`${lead.assignedUser.name} <${lead.assignedUser.email}>`] : [];
    const assignedEmails = assignees.length > 0
      ? assignees.map((assignee) => assignee.email)
      : lead.assignedUser?.email ? [lead.assignedUser.email] : [];

    await sendComplaintEscalationEmail({
      leadCode: lead.leadCode,
      recipients: [ESCALATION_RECIPIENT],
      fields: {
        'Lead code': lead.leadCode,
        'Customer name': lead.customerName,
        'Mobile': lead.mobile,
        'Customer email': lead.email,
        'Dealer': lead.dealer?.name,
        'Brand': lead.brand?.name,
        'Model': lead.model?.name,
        'Location': lead.location,
        'Source': lead.source,
        'Department': lead.department,
        'Enquiry category': lead.enquiryCategory?.name,
        'Enquiry type': lead.enquiryType?.name,
        'Status': lead.status,
        'Priority': lead.priority,
        'Created at': lead.createdAt.toISOString(),
        'Assigned by': lead.createdByUser ? `${lead.createdByUser.name} <${lead.createdByUser.email}>` : undefined,
        'Assigned to': assignedUsers.join(', '),
        'Assigned user emails': assignedEmails.join(', '),
        'Initial remarks': lead.initialRemarks,
        'Next follow-up date': lead.nextFollowupDate?.toISOString(),
      },
    });
    await db.crmLeadActivity.create({
      data: {
        leadId: lead.id,
        action: 'complaint_escalated',
        details: { recipient: ESCALATION_RECIPIENT, reason: 'open for two days' },
      },
    });
    sent += 1;
  }
  return sent;
}

export function escalateOpenComplaints(force = false) {
  if (!force && Date.now() - lastRunAt < RUN_INTERVAL_MS) return Promise.resolve(0);
  if (activeRun) return activeRun;
  lastRunAt = Date.now();
  activeRun = runEscalation().finally(() => {
    activeRun = null;
  });
  return activeRun;
}
