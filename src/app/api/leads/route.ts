import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, canCreateLead } from '@/lib/auth';
import { validateLeadCascade } from '@/lib/cascade';
import { getLeadAssignees, setLeadAssignees } from '@/lib/lead-assignees';
import { sendPushToLeadUsers } from '@/lib/push';
import { buildLeadFilters, LeadFilterError, normalizeMobile, LEAD_SOURCES } from '@/lib/lead-filters';
import { sendLeadAssignmentEmail } from '@/lib/mail';
import { fetchLeadDetail } from '@/lib/lead-detail';

// GET /api/leads — list leads within scope (with filters)
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  let where;
  try { where = buildLeadFilters(user, sp); }
  catch (error) { return NextResponse.json({ error: error instanceof LeadFilterError ? error.message : 'Invalid filters' }, { status: 400 }); }

  const limit = Math.min(Math.max(parseInt(sp.get('limit') || '50', 10) || 50, 1), 500);
  const offset = Math.max(parseInt(sp.get('offset') || '0', 10) || 0, 0);

  const [leads, total] = await Promise.all([
    db.crmLead.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, leadCode: true, customerName: true, mobile: true, email: true,
        dealerId: true, brandId: true, modelId: true, enquiryCategoryId: true, enquiryTypeId: true,
        department: true, assignedUserId: true, priority: true, status: true, createdBy: true, createdAt: true,
        dealer: { select: { name: true, code: true, brand: true } },
        brand: { select: { name: true } },
        model: { select: { name: true } },
        enquiryType: { select: { name: true } },
        assignedUser: { select: { name: true } },
        createdByUser: { select: { name: true } },
      },
    }),
    db.crmLead.count({ where }),
  ]);

  const out = leads.map((l: any) => ({
    id: l.id, lead_code: l.leadCode, customer_name: l.customerName, mobile: l.mobile, email: l.email, location: l.location, source: l.source,
    dealer_id: l.dealerId, brand_id: l.brandId, model_id: l.modelId, enquiry_category_id: l.enquiryCategoryId, enquiry_type_id: l.enquiryTypeId,
    department: l.department, assigned_user_id: l.assignedUserId, priority: l.priority, status: l.status, created_by: l.createdBy, created_at: l.createdAt,
    dealer_name: l.dealer?.name || null, dealer_code: l.dealer?.code || null, dealer_brand: l.dealer?.brand || null, referral_customer_name: l.referralCustomerName,
    brand_name: l.brand?.name || null, model_name: l.model?.name || null,
    enquiry_type_name: l.enquiryType?.name || null,
    assigned_user_name: l.assignedUser?.name || null, created_by_name: l.createdByUser?.name || null,
  }));
  return NextResponse.json({ leads: out, total, limit, offset });
}

// POST /api/leads — create + assign a lead
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!canCreateLead(user)) return NextResponse.json({ error: 'Only operators/admins can create leads' }, { status: 403 });

  const b = await req.json();
  if (!String(b.customer_name || '').trim() || !String(b.mobile || '').trim() || !b.dealer_id || !b.model_id || !String(b.location || '').trim() || !String(b.source || '').trim() || !b.enquiry_category_id || !b.enquiry_type_id) {
    return NextResponse.json({ error: 'customer_name, mobile, dealer_id, model_id, location, source, enquiry_category_id, enquiry_type_id are required' }, { status: 400 });
  }
  const customerName = String(b.customer_name).trim();
  if (!/^[A-Za-z .'-]{2,100}$/.test(customerName)) return NextResponse.json({ error: 'customer_name must contain text only' }, { status: 422 });
  const assignedUserIds = Array.isArray(b.assigned_user_ids) ? b.assigned_user_ids.map((id: any) => parseInt(id, 10)).filter(Number.isInteger) : [];
  if (!b.assigned_user_id && assignedUserIds.length === 0) return NextResponse.json({ error: 'At least one assigned user is required' }, { status: 400 });
  const primaryAssigneeId = parseInt(b.assigned_user_id || assignedUserIds[0], 10);
  const mobile = normalizeMobile(b.mobile);
  if (!/^[6-9]\d{9}$/.test(mobile)) return NextResponse.json({ error: 'mobile must contain exactly 10 digits and start with 6-9' }, { status: 422 });
  b.mobile = mobile;
  b.customer_name = customerName;
  if (b.source && !(LEAD_SOURCES as readonly string[]).includes(b.source)) return NextResponse.json({ error: 'Invalid source' }, { status: 422 });
  if (b.source === 'Reference' && !String(b.referral_customer_name || '').trim()) return NextResponse.json({ error: 'reference_customer_name is required when source is Reference' }, { status: 422 });
  if (!['Low', 'Medium', 'High', 'Critical'].includes(b.priority)) b.priority = 'Medium';

  const validation = await validateLeadCascade({
    dealerId: parseInt(b.dealer_id, 10),
    brandId: b.brand_id ? parseInt(b.brand_id, 10) : null,
    modelId: b.model_id ? parseInt(b.model_id, 10) : null,
    enquiryTypeId: parseInt(b.enquiry_type_id, 10),
    assignedUserId: primaryAssigneeId,
    operator: user,
  });
  if (!validation.valid) {
    return NextResponse.json({ error: 'Cascade validation failed', details: validation.errors }, { status: 400 });
  }
  const department = validation.derivedDepartment!;

  const dealerId = parseInt(b.dealer_id, 10);
  const terminalStatuses = ['converted', 'closed', 'lost', 'recycled'];
  const optionalValue = (value: unknown) => {
    const normalized = String(value ?? '').trim();
    return normalized || null;
  };
  const submittedNextFollowup = b.next_followup_date ? new Date(b.next_followup_date) : null;
  const requestedAssigneeIds = [...new Set(assignedUserIds.length ? assignedUserIds : [primaryAssigneeId])];

  // Do not reopen or duplicate a customer while an equivalent dealer lead is active.
  const activeDuplicate = await db.crmLead.findFirst({
    where: { dealerId, mobile, status: { notIn: terminalStatuses } },
    select: { leadCode: true },
  });
  if (activeDuplicate) {
    return NextResponse.json({ error: `An open lead with this mobile number already exists (${activeDuplicate.leadCode})` }, { status: 409 });
  }

  // Closed leads are also protected when every submitted lead field matches.
  const exactCandidates = await db.crmLead.findMany({
    where: {
      customerName,
      mobile,
      secondaryNumber: optionalValue(b.secondary_number),
      email: optionalValue(b.email),
      location: optionalValue(b.location),
      source: optionalValue(b.source),
      referralCustomerName: b.source === 'Reference' ? optionalValue(b.referral_customer_name) : null,
      dealerId,
      brandId: b.brand_id ? parseInt(b.brand_id, 10) : null,
      modelId: b.model_id ? parseInt(b.model_id, 10) : null,
      variant: optionalValue(b.variant),
      registrationNumber: optionalValue(b.registration_number),
      enquiryCategoryId: parseInt(b.enquiry_category_id, 10),
      enquiryTypeId: parseInt(b.enquiry_type_id, 10),
      department,
      priority: b.priority,
      initialRemarks: optionalValue(b.initial_remarks),
      nextFollowupDate: submittedNextFollowup,
    },
    select: { id: true, leadCode: true, assignedUserId: true },
  });
  const exactDuplicate = await (async () => {
    for (const candidate of exactCandidates) {
      const storedAssignees = await getLeadAssignees(candidate.id).catch(() => []);
      const candidateAssigneeIds = storedAssignees.length
        ? storedAssignees.map((assignee) => assignee.id)
        : (candidate.assignedUserId ? [candidate.assignedUserId] : []);
      if (candidateAssigneeIds.length === requestedAssigneeIds.length && candidateAssigneeIds.every((id) => requestedAssigneeIds.includes(id))) {
        return candidate;
      }
    }
    return null;
  })();
  if (exactDuplicate) {
    return NextResponse.json({ error: `An identical lead already exists (${exactDuplicate.leadCode})` }, { status: 409 });
  }

  const outcome = await db.$transaction(async (tx) => {
    const now = new Date();
    const ym = String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, '0');
    const maxLead = await tx.crmLead.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
    const nextId = (maxLead?.id || 0) + 1;
    const leadCode = `LD-${ym}-${String(nextId).padStart(5, '0')}`;
    const lead = await tx.crmLead.create({
      data: {
        leadCode, customerName: b.customer_name, mobile,
        secondaryNumber: b.secondary_number || null, email: b.email || null, location: b.location || null, source: b.source || null, referralCustomerName: b.source === 'Reference' ? String(b.referral_customer_name).trim() : null,
        dealerId, brandId: b.brand_id ? parseInt(b.brand_id, 10) : null,
        modelId: b.model_id ? parseInt(b.model_id, 10) : null, variant: b.variant || null, registrationNumber: b.registration_number || null,
        enquiryCategoryId: parseInt(b.enquiry_category_id, 10), enquiryTypeId: parseInt(b.enquiry_type_id, 10),
      department, assignedUserId: primaryAssigneeId, priority: b.priority,
        status: 'new', initialRemarks: b.initial_remarks || null,
        nextFollowupDate: b.next_followup_date ? new Date(b.next_followup_date) : null,
        createdBy: user.id,
      },
      select: { id: true },
    });
    return { leadId: lead.id, leadCode };
  }, { maxWait: 15000, timeout: 30000 });

  // Write activities after the lead transaction commits so a slow database cannot
  // invalidate the transaction while recording the audit trail.
  await Promise.all([
    db.crmLeadActivity.create({ data: { leadId: outcome.leadId!, userId: user.id, action: 'created', details: { message: `Lead created and assigned to user #${primaryAssigneeId}`, priority: b.priority } } }),
    db.crmLeadActivity.create({ data: { leadId: outcome.leadId!, userId: user.id, action: 'assigned', details: { assigned_to: assignedUserIds.length ? assignedUserIds : [primaryAssigneeId], department } } }),
    setLeadAssignees(outcome.leadId!, assignedUserIds.length ? assignedUserIds : [primaryAssigneeId]),
  ]);
  try {
    await sendPushToLeadUsers(outcome.leadId!, user.id, { title: 'New CRM Lead', body: 'A new lead was assigned to your team.' });
  } catch (error) {
    console.error('Push delivery failed after lead creation:', error);
  }

  // Send lead email only for Complain /Concern without delaying the form response.
  void (async () => {
    const [enquiryType, recipients, dealer, category, brand, model] = await Promise.all([
      db.crmEnquiryType.findUnique({ where: { id: parseInt(b.enquiry_type_id, 10) }, select: { name: true } }),
      db.crmUser.findMany({ where: { id: { in: assignedUserIds.length ? assignedUserIds : [primaryAssigneeId] }, active: true }, select: { name: true, email: true } }),
      db.crmDealer.findUnique({ where: { id: dealerId }, select: { name: true } }),
      db.crmEnquiryCategory.findUnique({ where: { id: parseInt(b.enquiry_category_id, 10) }, select: { name: true } }),
      b.brand_id ? db.crmBrand.findUnique({ where: { id: parseInt(b.brand_id, 10) }, select: { name: true } }) : Promise.resolve(null),
      b.model_id ? db.crmModel.findUnique({ where: { id: parseInt(b.model_id, 10) }, select: { name: true } }) : Promise.resolve(null),
    ]);
    if (!enquiryType?.name?.trim().toLowerCase().startsWith('complain')) return;
    const loginUserEmail = String(user.email || '').trim().toLowerCase();
    const recipientEmails = [...new Set([
      ...recipients.map((recipient) => String(recipient.email || '').trim().toLowerCase()),
      loginUserEmail,
    ].filter(Boolean))];
    await sendLeadAssignmentEmail({
      recipients: recipientEmails,
      leadCode: outcome.leadCode!,
      dealerName: dealer?.name,
      department,
      assignedBy: user.name,
      enquiryType: enquiryType?.name,
      fields: {
        'Customer name': b.customer_name,
        'Mobile': b.mobile,
        'Secondary number': b.secondary_number,
        'Customer email': b.email,
        'Location': b.location,
        'Source': b.source,
        'Reference customer': b.referral_customer_name,
        'Brand': brand?.name || b.brand_id,
        'Model': model?.name || b.model_id,
        'Variant': b.variant,
        'Registration number': b.registration_number,
        'Enquiry category': category?.name,
        'Enquiry type': enquiryType?.name,
        'Priority': b.priority,
        'Assigned users': recipients.map((recipient) => recipient.name).join(', '),
        'Initial remarks': b.initial_remarks,
        'Next follow-up date': b.next_followup_date,
      },
    });
  })().catch((error) => console.error('Lead email delivery failed:', error));

  return NextResponse.json({ lead: { id: outcome.leadId, lead_code: outcome.leadCode }, message: 'Lead created and assigned' }, { status: 201 });
}
