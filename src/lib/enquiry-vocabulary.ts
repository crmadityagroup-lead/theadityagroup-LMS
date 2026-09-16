import { DEPARTMENTS, ENQUIRY_TYPES } from '@/lib/department-constants';

const LEGACY_CATEGORY_LABELS: Record<string, string> = {
  Sales: 'Sales (Personal)',
  'Sale Commercial': 'Sales (Commercial)',
  'Parts & Accessories': 'Spare Parts',
  'Finance & Insurance': 'Finance',
  Registration: 'Accessories',
  'Customer Experience': 'Bodyshop',
  'Used Sales': 'Used Car',
  'Used Manager': 'Used Car',
};

export function normalizeEnquiryCategories(items: any[]) {
  return items.map((item) => ({ ...item, name: LEGACY_CATEGORY_LABELS[item.name] || item.name }))
    .filter((item) => DEPARTMENTS.includes(item.name))
    .filter((item, index, all) => all.findIndex((candidate) => candidate.name === item.name) === index)
    .sort((a, b) => DEPARTMENTS.indexOf(a.name) - DEPARTMENTS.indexOf(b.name));
}

export function normalizeEnquiryTypes(items: any[]) {
  return items.map((item) => ({ ...item, name: /complain|complaint|concern/i.test(item.name) ? ENQUIRY_TYPES[1] : ENQUIRY_TYPES[0] }))
    .filter((item, index, all) => all.findIndex((candidate) => candidate.categoryId === item.categoryId && candidate.name === item.name) === index);
}
