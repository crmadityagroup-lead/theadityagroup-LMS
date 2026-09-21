// Cascade validation + helpers for the dealer→brand→model→enquiry→department→user chain.
import { db } from './db';
import { visibleDealerIds } from './auth';
import type { AuthUser } from './auth';

export async function getOperatorDealers(user: AuthUser) {
  const allDealersRoles = ['super_admin', 'admin', 'data_operator_1'];
  const singleDealerRoles = ['admin_2', 'data_operator_2', 'department_user'];
  if (allDealersRoles.includes(user.role)) {
    if (user.role === 'data_operator_1' && user.dealer_id) {
      return db.crmDealer.findMany({ where: { id: user.dealer_id, active: true }, select: { id: true, name: true, code: true, brand: true } });
    }
    return db.crmDealer.findMany({ where: { active: true }, select: { id: true, name: true, code: true, brand: true }, orderBy: { id: 'asc' } });
  }
  if (singleDealerRoles.includes(user.role)) {
    if (!user.dealer_id) return [];
    return db.crmDealer.findMany({ where: { id: user.dealer_id, active: true }, select: { id: true, name: true, code: true, brand: true } });
  }
  return [];
}

export async function getDepartmentForEnquiryType(enquiryTypeId: number) {
  const row = await db.crmEnquiryType.findUnique({ where: { id: enquiryTypeId }, select: { department: true } });
  return row?.department || null;
}

export async function getEligibleUsers({ dealerId, department, enquiryTypeId }: { dealerId: number; department: string; enquiryTypeId: number }) {
  return db.crmUser.findMany({
    where: {
      active: true,
      role: 'department_user',
      dealerId,
      department,
      enquiryTypes: { some: { enquiryTypeId } },
    },
    select: { id: true, name: true, email: true, phone: true, department: true, role: true },
    orderBy: { name: 'asc' },
  });
}

// Full cascade validation for lead creation/assignment
export async function validateLeadCascade({ dealerId, brandId, modelId, enquiryTypeId, assignedUserId, operator }:
  { dealerId: number; brandId?: number | null; modelId?: number | null; enquiryTypeId: number; assignedUserId?: number; operator: AuthUser }) {
  const errors: string[] = [];

  const dealer = await db.crmDealer.findFirst({ where: { id: dealerId, active: true }, select: { id: true, brand: true } });
  if (!dealer) {
    errors.push('Invalid or inactive dealer');
    return { valid: false, errors, derivedDepartment: null };
  }

  const opDealers = await getOperatorDealers(operator);
  if (!opDealers.find(d => d.id === dealerId)) {
    errors.push('Operator does not have access to this dealer');
  }

  if (brandId) {
    const brand = await db.crmBrand.findFirst({ where: { id: brandId, active: true }, select: { id: true, name: true, dealerId: true } });
    if (!brand) {
      errors.push('Invalid brand');
    } else {
      if (brand.dealerId !== dealerId) errors.push('Brand does not belong to the selected dealer');
      else if (brand.name !== dealer.brand) errors.push(`Brand must be ${dealer.brand} for this dealer`);
    }
    if (modelId) {
      const model = await db.crmModel.findFirst({ where: { id: modelId, active: true }, select: { id: true, name: true, brandId: true } });
      if (!model) errors.push('Invalid model');
      else if (model.brandId !== brandId) errors.push('Model does not belong to the selected brand');
    }
  }

  const et = await db.crmEnquiryType.findUnique({ where: { id: enquiryTypeId }, select: { id: true, name: true, categoryId: true, department: true } });
  if (!et) {
    errors.push('Invalid enquiry type');
    return { valid: false, errors, derivedDepartment: null };
  }
  const derivedDepartment = et.department;

  if (assignedUserId) {
    const au = await db.crmUser.findUnique({ where: { id: assignedUserId }, select: { id: true, name: true, role: true, dealerId: true, department: true, active: true } });
    if (!au) {
      errors.push('Assigned user not found');
    } else {
      if (!au.active) errors.push('Assigned user is not active');
      if (au.role !== 'department_user') errors.push('Assigned user must be a department user');
      if (au.dealerId !== dealerId) errors.push('Assigned user does not belong to the selected dealer');
      if (au.department !== derivedDepartment) errors.push(`Assigned user must belong to the ${derivedDepartment} department`);
      const perm = await db.crmUserEnquiryType.findFirst({ where: { userId: au.id, enquiryTypeId } });
      if (!perm) errors.push('Assigned user is not permitted for this enquiry type');
    }
  }

  return { valid: errors.length === 0, errors, derivedDepartment };
}
