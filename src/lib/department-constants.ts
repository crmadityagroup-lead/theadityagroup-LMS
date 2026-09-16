export const DEPARTMENTS = [
  'Sales (Personal)',
  'Sales (Commercial)',
  'Service',
  'Spare Parts',
  'Finance',
  'Accessories',
  'Insurance',
  'Bodyshop',
  'Used Car',
] as const;

export const ENQUIRY_TYPES = ['Query/Enquiry', 'Complain /Concern'] as const;

const ALIASES: Record<string, string> = {
  Sales: 'Sales (Personal)',
  'Sale Commercial': 'Sales (Commercial)',
  'Sales Commerce': 'Sales (Commercial)',
  'Parts & Accessories': 'Spare Parts',
  'Customer Experience': 'Bodyshop',
  'Used Sales': 'Used Car',
  'Used Manager': 'Used Car',
  'Finance & Insurance': 'Finance',
  Registration: 'Accessories',
  'Emergency Breakdown': 'Service',
};

export function canonicalDepartment(value: string | null | undefined) {
  return value ? ALIASES[value] || value : value || null;
}

export function departmentAliases(value: string) {
  return Object.entries(ALIASES).filter(([, current]) => current === value).map(([legacy]) => legacy).concat(value);
}
