import type { Prisma } from '@prisma/client';
import type { AuthUser } from './auth';
import { ROLES, seesOnlyCreatedLeads, visibleDealerIds, visibleDepartment } from './auth';
import { LEAD_SOURCES } from './lead-constants';

export const LEAD_STATUSES = ['new', 'in_progress', 'follow_up', 'converted', 'closed', 'lost', 'recycled'] as const;
export const LEAD_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;
export { LEAD_SOURCES } from './lead-constants';

export class LeadFilterError extends Error {}

function intParam(params: URLSearchParams, key: string) {
  const value = params.get(key);
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new LeadFilterError(`Invalid ${key}`);
  return parsed;
}

function dateParam(params: URLSearchParams, key: string) {
  const value = params.get(key);
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new LeadFilterError(`Invalid ${key}`);
  return parsed;
}

export function buildLeadFilters(user: AuthUser, params: URLSearchParams): Prisma.CrmLeadWhereInput {
  const and: Prisma.CrmLeadWhereInput[] = [];
  const dealerIds = visibleDealerIds(user);
  if (dealerIds !== null) {
    if (dealerIds.length === 0) and.push({ id: -1 });
    else and.push({ dealerId: { in: dealerIds } });
  }
  const department = visibleDepartment(user);
  if (department !== null) and.push({ department });
  if (user.role === ROLES.DEPT_USER) and.push({ assignedUserId: user.id });
  if (seesOnlyCreatedLeads(user)) and.push({ createdBy: user.id });

  const dealerId = intParam(params, 'dealer_id');
  const brandId = intParam(params, 'brand_id');
  const modelId = intParam(params, 'model_id');
  const enquiryCategoryId = intParam(params, 'enquiry_category_id');
  const enquiryTypeId = intParam(params, 'enquiry_type_id');
  const assignedUserId = intParam(params, 'assigned_user_id');
  if (dealerId !== undefined) and.push({ dealerId });
  if (brandId !== undefined) and.push({ brandId });
  if (modelId !== undefined) and.push({ modelId });
  if (enquiryCategoryId !== undefined) and.push({ enquiryCategoryId });
  if (enquiryTypeId !== undefined) and.push({ enquiryTypeId });
  if (assignedUserId !== undefined) and.push({ assignedUserId });

  const status = params.get('status');
  if (status) {
    if (!(LEAD_STATUSES as readonly string[]).includes(status)) throw new LeadFilterError('Invalid status');
    and.push({ status });
  } else {
    // Recycled leads are only visible through the Recycle Bin.
    and.push({ status: { not: 'recycled' } });
  }
  const priority = params.get('priority');
  if (priority) {
    if (!(LEAD_PRIORITIES as readonly string[]).includes(priority)) throw new LeadFilterError('Invalid priority');
    and.push({ priority });
  }
  for (const key of ['source', 'department'] as const) {
    const value = params.get(key);
    if (value) and.push({ [key]: value });
  }
  const from = dateParam(params, 'from_date');
  const to = dateParam(params, 'to_date');
  if (from && to && from > to) throw new LeadFilterError('from_date must be before to_date');
  if (from) and.push({ createdAt: { gte: from } });
  if (to) and.push({ createdAt: { lte: to } });

  const search = params.get('search')?.trim();
  const where: Prisma.CrmLeadWhereInput = { AND: and };
  if (search) {
    where.OR = [
      { leadCode: { contains: search, mode: 'insensitive' } },
      { customerName: { contains: search, mode: 'insensitive' } },
      { mobile: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }
  return where;
}

export function normalizeMobile(value: unknown) {
  return String(value ?? '').replace(/\D/g, '');
}
