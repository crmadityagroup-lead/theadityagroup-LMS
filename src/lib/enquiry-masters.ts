import { db } from '@/lib/db';
import { canonicalDepartment, DEPARTMENTS, ENQUIRY_TYPES } from '@/lib/department-constants';

let syncPromise: Promise<void> | null = null;

function targetTypeName(name: string) {
  return /complain|complaint|concern/i.test(name) ? ENQUIRY_TYPES[1] : ENQUIRY_TYPES[0];
}

export function syncEnquiryMasters() {
  if (!syncPromise) {
    syncPromise = (async () => {
      const categories = new Map<string, { id: number }>();
      const existingCategories = await db.crmEnquiryCategory.findMany({ where: { name: { in: [...DEPARTMENTS] } }, select: { id: true, name: true } });
      const existingTypes = await db.crmEnquiryType.count({ where: { name: { in: [...ENQUIRY_TYPES] }, category: { name: { in: [...DEPARTMENTS] } } } });
      if (existingCategories.length === DEPARTMENTS.length && existingTypes === DEPARTMENTS.length * ENQUIRY_TYPES.length) return;

      for (const name of DEPARTMENTS) {
        categories.set(name, await db.crmEnquiryCategory.upsert({ where: { name }, update: {}, create: { name }, select: { id: true } }));
      }

      await db.crmUser.updateMany({ where: { department: 'Used Manager' }, data: { department: 'Used Car' } });
      await db.crmLead.updateMany({ where: { department: 'Used Manager' }, data: { department: 'Used Car' } });

      const canonicalTypes = new Map<string, { id: number }>();
      for (const department of DEPARTMENTS) {
        const category = categories.get(department)!;
        for (const name of ENQUIRY_TYPES) {
          canonicalTypes.set(`${department}:${name}`, await db.crmEnquiryType.upsert({
            where: { name_categoryId: { name, categoryId: category.id } },
            update: { department }, create: { name, categoryId: category.id, department }, select: { id: true },
          }));
        }
      }

      const legacyTypes = await db.crmEnquiryType.findMany({ select: { id: true, name: true, department: true } });
      for (const legacy of legacyTypes) {
        const department = canonicalDepartment(legacy.department) || 'Sales (Personal)';
        const category = categories.get(department) || categories.get('Sales (Personal)')!;
        const name = targetTypeName(legacy.name);
        const target = canonicalTypes.get(`${categories.has(department) ? department : 'Sales (Personal)'}:${name}`)!;
        if (legacy.id === target.id) continue;
        await db.$executeRawUnsafe(`INSERT INTO crm_user_enquiry_types (user_id, enquiry_type_id) SELECT user_id, $1 FROM crm_user_enquiry_types WHERE enquiry_type_id = $2 ON CONFLICT (user_id, enquiry_type_id) DO NOTHING`, target.id, legacy.id);
        await db.$executeRawUnsafe('DELETE FROM crm_user_enquiry_types WHERE enquiry_type_id = $1', legacy.id);
        await db.crmLead.updateMany({ where: { enquiryTypeId: legacy.id }, data: { enquiryTypeId: target.id, enquiryCategoryId: category.id, department } });
        await db.crmEnquiryType.delete({ where: { id: legacy.id } });
      }
    })().catch((error) => { syncPromise = null; throw error; });
  }
  return syncPromise;
}
