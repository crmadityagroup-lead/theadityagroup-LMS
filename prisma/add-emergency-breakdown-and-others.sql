INSERT INTO crm_enquiry_categories (name)
VALUES ('Emergency Breakdown'), ('Others')
ON CONFLICT (name) DO NOTHING;

INSERT INTO crm_enquiry_types (name, category_id, department)
SELECT enquiry_type.name, category.id, category.name
FROM crm_enquiry_categories AS category
CROSS JOIN (VALUES ('Query/Enquiry'), ('Complain /Concern')) AS enquiry_type(name)
WHERE category.name IN ('Emergency Breakdown', 'Others')
ON CONFLICT (name, category_id) DO UPDATE SET department = EXCLUDED.department;
