UPDATE crm_users
SET departments = array_append(departments, 'Emergency Breakdown')
WHERE email = 'crm@adityamotors.com'
  AND NOT ('Emergency Breakdown' = ANY(departments));
