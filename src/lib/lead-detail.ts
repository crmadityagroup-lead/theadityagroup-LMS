import { db } from '@/lib/db';
import { getLeadAssignees } from '@/lib/lead-assignees';

export async function fetchLeadDetail(id: number) {
  const l = await db.crmLead.findUnique({
    where: { id },
    select: {
      id: true, leadCode: true, customerName: true, mobile: true, secondaryNumber: true, email: true, location: true, source: true, referralCustomerName: true,
      dealerId: true, brandId: true, modelId: true, variant: true, registrationNumber: true,
      enquiryCategoryId: true, enquiryTypeId: true, department: true, assignedUserId: true,
      priority: true, status: true, initialRemarks: true, nextFollowupDate: true, createdBy: true,
      createdAt: true, updatedAt: true, closedAt: true,
      dealer: { select: { name: true, code: true, brand: true } },
      brand: { select: { name: true } },
      model: { select: { name: true } },
      enquiryCategory: { select: { name: true } },
      enquiryType: { select: { name: true } },
      assignedUser: { select: { name: true, email: true, phone: true } },
      createdByUser: { select: { name: true, phone: true } },
    },
  });
  if (!l) return null;
  const assignedUsers = await getLeadAssignees(id);
  return {
    id: l.id, lead_code: l.leadCode, customer_name: l.customerName, mobile: l.mobile, secondary_number: l.secondaryNumber,
    email: l.email, location: l.location, source: l.source, referral_customer_name: l.referralCustomerName,
    dealer_id: l.dealerId, brand_id: l.brandId, model_id: l.modelId, variant: l.variant, registration_number: l.registrationNumber,
    enquiry_category_id: l.enquiryCategoryId, enquiry_type_id: l.enquiryTypeId, department: l.department, assigned_user_id: l.assignedUserId,
    priority: l.priority, status: l.status, initial_remarks: l.initialRemarks, next_followup_date: l.nextFollowupDate, created_by: l.createdBy,
    created_at: l.createdAt, updated_at: l.updatedAt, closed_at: l.closedAt,
    dealer_name: l.dealer?.name || null, dealer_code: l.dealer?.code || null, dealer_brand: l.dealer?.brand || null,
    brand_name: l.brand?.name || null, model_name: l.model?.name || null,
    enquiry_category_name: l.enquiryCategory?.name || null, enquiry_type_name: l.enquiryType?.name || null,
    assigned_user_name: l.assignedUser?.name || null, assigned_user_email: l.assignedUser?.email || null, assigned_user_phone: l.assignedUser?.phone || null,
    assigned_users: assignedUsers,
    created_by_name: l.createdByUser?.name || null, created_by_phone: l.createdByUser?.phone || null,
  };
}
