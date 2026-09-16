// Comprehensive feature test — signs JWTs for all roles, tests every API endpoint.
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config({ override: true });

const db = new PrismaClient();
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET must be provided by the isolated QA environment');
const JWT_SECRET = process.env.JWT_SECRET;
const BASE = 'http://127.0.0.1:3000';

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name, dealer_id: user.dealerId ?? null, department: user.department ?? null },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function api(method, path, token, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(60000) };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const ct = res.headers.get('content-type') || '';
  let data = null;
  if (ct.includes('application/json')) data = await res.json();
  else if (ct.includes('text/')) data = await res.text();
  else { try { data = await res.json(); } catch {} }
  return { status: res.status, data };
}

const results = [];
function check(name, status, pass, note = '') {
  const icon = pass ? '✓' : '✗';
  results.push({ name, pass, note });
  console.log(`  ${icon} [${status}] ${name}${note ? ' — ' + note : ''}`);
}

// ============================================================
console.log('\n=== SETUP: Find users for each role ===');
const superAdmin = await db.crmUser.findFirst({ where: { role: 'super_admin', active: true }, select: { id: true, name: true, email: true, role: true, dealerId: true, department: true } });
const admin = await db.crmUser.findFirst({ where: { role: 'admin', active: true }, select: { id: true, name: true, email: true, role: true, dealerId: true, department: true } });
const operator = await db.crmUser.findFirst({ where: { role: { in: ['data_operator_1', 'data_operator_2'] }, active: true }, select: { id: true, name: true, email: true, role: true, dealerId: true, department: true } });
const deptUser = await db.crmUser.findFirst({ where: { role: 'department_user', active: true }, select: { id: true, name: true, email: true, role: true, dealerId: true, department: true } });
console.log(`  super_admin: ${superAdmin?.email} (id=${superAdmin?.id})`);
console.log(`  admin: ${admin?.email} (id=${admin?.id})`);
console.log(`  data operator: ${operator?.email} (id=${operator?.id}, role=${operator?.role})`);
console.log(`  dept_user: ${deptUser?.email} (id=${deptUser?.id})`);

const superToken = signToken(superAdmin);
const adminToken = signToken(admin);
const opToken = signToken(operator);
const duToken = signToken(deptUser);

// ============================================================
console.log('\n=== TEST 1: Auth — /auth/me with JWT (all roles) ===');
for (const [role, token] of [['super_admin', superToken], ['admin', adminToken], ['data_operator', opToken], ['dept_user', duToken]]) {
  const r = await api('GET', '/api/auth/me', token);
  check(`${role} /auth/me`, r.status, r.status === 200, `role=${r.data?.user?.role}`);
}

// ============================================================
console.log('\n=== TEST 3: Master data endpoints ===');
const dealersR = await api('GET', '/api/master/dealers', superToken);
check('GET /master/dealers', dealersR.status, dealersR.status === 200, `${dealersR.data?.dealers?.length || 0} dealers`);
const allDealersR = await api('GET', '/api/master/all-dealers', superToken);
check('GET /master/all-dealers', allDealersR.status, allDealersR.status === 200, `${allDealersR.data?.dealers?.length || 0} dealers`);
const catsR = await api('GET', '/api/master/enquiry-categories', superToken);
check('GET /master/enquiry-categories', catsR.status, catsR.status === 200, `${catsR.data?.categories?.length || 0} categories`);
const firstCatId = catsR.data?.categories?.[0]?.id;
const typesR = await api('GET', `/api/master/enquiry-types?category_id=${firstCatId}`, superToken);
check('GET /master/enquiry-types', typesR.status, typesR.status === 200, `${typesR.data?.enquiry_types?.length || 0} types`);
const firstDealerId = dealersR.data?.dealers?.[0]?.id;
const brandsR = await api('GET', `/api/master/brands?dealer_id=${firstDealerId}`, superToken);
check('GET /master/brands', brandsR.status, brandsR.status === 200, `${brandsR.data?.brands?.length || 0} brands`);
const firstBrandId = brandsR.data?.brands?.[0]?.id;
const modelsR = await api('GET', `/api/master/models?brand_id=${firstBrandId}`, superToken);
check('GET /master/models', modelsR.status, modelsR.status === 200, `${modelsR.data?.models?.length || 0} models`);
const allModelsR = await api('GET', '/api/master/all-models', superToken);
check('GET /master/all-models (super only)', allModelsR.status, allModelsR.status === 200, `${allModelsR.data?.models?.length || 0} models`);
const allModelsAdmin = await api('GET', '/api/master/all-models', adminToken);
check('GET /master/all-models blocked for admin', allModelsAdmin.status, allModelsAdmin.status === 403, `403 (correct)`);
const recycledModelsR = await api('GET', '/api/master/models/recycled/list', superToken);
check('GET /master/models/recycled/list', recycledModelsR.status, recycledModelsR.status === 200, `${recycledModelsR.data?.models?.length || 0} recycled`);

// ============================================================
console.log('\n=== TEST 4: Dashboard endpoint (all roles) ===');
for (const [role, token] of [['super', superToken], ['admin', adminToken], ['data_operator', opToken], ['dept_user', duToken]]) {
  const r = await api('GET', '/api/dashboard', token);
  check(`${role} /dashboard`, r.status, r.status === 200, `total=${r.data?.total}`);
}

// ============================================================
console.log('\n=== TEST 5: Leads list + detail ===');
const leadsListR = await api('GET', '/api/leads?limit=5', superToken);
check('GET /leads', leadsListR.status, leadsListR.status === 200, `${leadsListR.data?.leads?.length || 0} leads, total=${leadsListR.data?.total}`);
const firstLeadId = leadsListR.data?.leads?.[0]?.id;
if (firstLeadId) {
  const leadDetailR = await api('GET', `/api/leads/${firstLeadId}`, superToken);
  check('GET /leads/:id', leadDetailR.status, leadDetailR.status === 200, `lead_code=${leadDetailR.data?.lead?.lead_code}`);
  check('lead has activities', leadDetailR.status, Array.isArray(leadDetailR.data?.activities), `${leadDetailR.data?.activities?.length} activities`);
  check('lead has followups', leadDetailR.status, Array.isArray(leadDetailR.data?.followups), `${leadDetailR.data?.followups?.length} followups`);
  check('lead has dept_updates', leadDetailR.status, Array.isArray(leadDetailR.data?.department_updates), `${leadDetailR.data?.department_updates?.length} dept updates`);
}

// ============================================================
console.log('\n=== TEST 6: Leads filters ===');
const recycledLeadsR = await api('GET', '/api/leads?status=recycled&limit=5', superToken);
check('GET /leads?status=recycled', recycledLeadsR.status, recycledLeadsR.status === 200, `${recycledLeadsR.data?.leads?.length} recycled`);
const searchLeadsR = await api('GET', '/api/leads?search=test&limit=5', superToken);
check('GET /leads?search=test', searchLeadsR.status, searchLeadsR.status === 200, `${searchLeadsR.data?.leads?.length} results`);

// ============================================================
console.log('\n=== TEST 7: Users endpoints ===');
const usersR = await api('GET', '/api/users', superToken);
check('GET /users (super)', usersR.status, usersR.status === 200, `${usersR.data?.users?.length} users`);
const usersAdminR = await api('GET', '/api/users', adminToken);
check('GET /users (admin)', usersAdminR.status, usersAdminR.status === 200, `${usersAdminR.data?.users?.length} users`);
const usersOpR = await api('GET', '/api/users', opToken);
check('GET /users (operator)', usersOpR.status, usersOpR.status === 200, `${usersOpR.data?.users?.length} users (scoped)`);
const usersDuR = await api('GET', '/api/users', duToken);
check('GET /users (dept_user sees only self)', usersDuR.status, usersDuR.status === 200, `${usersDuR.data?.users?.length} user(s)`);

const recycledUsersR = await api('GET', '/api/users/recycled/list', superToken);
check('GET /users/recycled/list (super)', recycledUsersR.status, recycledUsersR.status === 200, `${recycledUsersR.data?.users?.length} recycled`);
const recycledUsersAdminR = await api('GET', '/api/users/recycled/list', adminToken);
check('GET /users/recycled/list blocked for admin', recycledUsersAdminR.status, recycledUsersAdminR.status === 403, '403 (correct — super only)');

const loginHistoryR = await api('GET', '/api/users/login-history/all', superToken);
check('GET /users/login-history/all (super)', loginHistoryR.status, loginHistoryR.status === 200, `${loginHistoryR.data?.history?.length} records`);
const loginHistoryAdminR = await api('GET', '/api/users/login-history/all', adminToken);
check('GET /users/login-history/all (admin)', loginHistoryAdminR.status, loginHistoryAdminR.status === 200, `${loginHistoryAdminR.data?.history?.length} records`);

// ============================================================
console.log('\n=== TEST 8: Reports + Performance ===');
const reportsR = await api('GET', '/api/reports/summary', superToken);
check('GET /reports/summary (super)', reportsR.status, reportsR.status === 200, `total=${reportsR.data?.total}, workload=${reportsR.data?.user_workload?.length}`);
check('reports has viewer_role', reportsR.status, !!reportsR.data?.viewer_role, `viewer_role=${reportsR.data?.viewer_role}`);
check('workload has user_email field', reportsR.status, !!reportsR.data?.user_workload?.[0]?.user_email, `email=${reportsR.data?.user_workload?.[0]?.user_email}`);
check('workload has role field', reportsR.status, !!reportsR.data?.user_workload?.[0]?.role, `role=${reportsR.data?.user_workload?.[0]?.role}`);

const reportsAdminR = await api('GET', '/api/reports/summary', adminToken);
const adminHasSuper = (reportsAdminR.data?.user_workload || []).some(r => r.role === 'super_admin');
check('admin workload excludes super_admin', reportsAdminR.status, !adminHasSuper, adminHasSuper ? 'BUG: contains super_admin' : 'correct');

const reportsAdminFilterR = await api('GET', '/api/reports/summary?role=super_admin', adminToken);
check('admin role=super_admin filter returns 0', reportsAdminFilterR.status, (reportsAdminFilterR.data?.user_workload || []).length === 0, `${reportsAdminFilterR.data?.user_workload?.length} rows (should be 0)`);

// ============================================================
console.log('\n=== TEST 9: Search ===');
const searchR = await api('GET', '/api/search?q=test', superToken);
check('GET /search?q=test (super)', searchR.status, searchR.status === 200, `${searchR.data?.leads?.length} leads, ${searchR.data?.users?.length} users`);

// ============================================================
console.log('\n=== TEST 10: Notifications ===');
const notifR = await api('GET', '/api/notifications', superToken);
check('GET /notifications', notifR.status, notifR.status === 200, `${notifR.data?.notifications?.length} notifications`);

// ============================================================
console.log('\n=== TEST 11: Exports (CSV, PDF, Excel) ===');
const csvR = await api('GET', '/api/reports/export', superToken);
check('GET /reports/export (CSV)', csvR.status, csvR.status === 200, `content-type=${csvR.data?.slice(0, 30) || '...'}`);
const pdfR = await api('GET', '/api/reports/export-pdf', superToken);
check('GET /reports/export-pdf', pdfR.status, pdfR.status === 200, `content-length=${String(pdfR.data || '').length}`);
const excelR = await api('GET', '/api/reports/export-excel', superToken);
check('GET /reports/export-excel', excelR.status, excelR.status === 200, `content-length=${String(excelR.data || '').length}`);

// ============================================================
console.log('\n=== TEST 12: Recycle Bin scoping ===');
// operator should NOT have access to recycle bin endpoints
const recycledLeadsOpR = await api('GET', '/api/leads?status=recycled', opToken);
check('operator GET /leads?status=recycled', recycledLeadsOpR.status, recycledLeadsOpR.status === 200, `${recycledLeadsOpR.data?.leads?.length} leads (scoped)`);
const recycledUsersOpR = await api('GET', '/api/users/recycled/list', opToken);
check('operator GET /users/recycled/list blocked', recycledUsersOpR.status, recycledUsersOpR.status === 403, '403 (correct)');

// ============================================================
console.log('\n=== TEST 13: Lead lifecycle (create → status → recycle → restore → permanent delete) ===');
// Find a valid cascade by looking for an eligible user first (dealer_id=1, Sales dept, enquiry_type_id=1)
const cascadeDealerId = 1;
const cascadeDept = 'Sales';
const cascadeTypeId = 1;
const eligibleUsersR = await api('GET', `/api/master/eligible-users?dealer_id=${cascadeDealerId}&department=${encodeURIComponent(cascadeDept)}&enquiry_type_id=${cascadeTypeId}`, superToken);
const eligibleUser = eligibleUsersR.data?.users?.[0];
if (eligibleUser) {
  // Find the brand + model for this dealer
  const cascadeBrandsR = await api('GET', `/api/master/brands?dealer_id=${cascadeDealerId}`, superToken);
  const cascadeBrand = cascadeBrandsR.data?.brands?.[0];
  const cascadeModelsR = cascadeBrand ? await api('GET', `/api/master/models?brand_id=${cascadeBrand.id}`, superToken) : null;
  const cascadeModel = cascadeModelsR?.data?.models?.[0];
  // Find the category for this enquiry type
  const cascadeType = (await api('GET', '/api/master/enquiry-types?category_id=1', superToken)).data?.enquiry_types?.find(t => t.id === cascadeTypeId);
  const cascadeCatId = cascadeType?.categoryId || 1;
  if (cascadeBrand && cascadeModel && cascadeType) {
    const createR = await api('POST', '/api/leads', superToken, {
      customer_name: 'Test Lifecycle', mobile: '9876543210', dealer_id: cascadeDealerId, brand_id: cascadeBrand.id, model_id: cascadeModel.id,
      enquiry_category_id: cascadeCatId, enquiry_type_id: cascadeTypeId, assigned_user_id: eligibleUser.id, priority: 'Medium',
    });
    check('POST /leads (create)', createR.status, createR.status === 201, `lead_code=${createR.data?.lead?.lead_code}`);
    const newLeadId = createR.data?.lead?.id;
    if (newLeadId) {
      // Change status
      const statusR = await api('PATCH', `/api/leads/${newLeadId}`, superToken, { status: 'in_progress' });
      check('PATCH /leads/:id (status → in_progress)', statusR.status, statusR.status === 200);
      // Add followup
      const fuR = await api('POST', `/api/leads/${newLeadId}/followups`, superToken, { remarks: 'Test followup', next_followup_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10) });
      check('POST /leads/:id/followups', fuR.status, fuR.status === 201);
      // Recycle
      const delR = await api('DELETE', `/api/leads/${newLeadId}`, superToken);
      check('DELETE /leads/:id (recycle)', delR.status, delR.status === 200);
      // Restore
      const restR = await api('POST', `/api/leads/${newLeadId}/restore`, superToken);
      check('POST /leads/:id/restore', restR.status, restR.status === 200);
      // Recycle again then permanent delete
      await api('DELETE', `/api/leads/${newLeadId}`, superToken);
      const permR = await api('DELETE', `/api/leads/${newLeadId}/permanent`, superToken);
      check('DELETE /leads/:id/permanent', permR.status, permR.status === 200, permR.data?.message);
    }
  } else {
    check('cascade brand/model found', 200, false, `brand=${!!cascadeBrand}, model=${!!cascadeModel}, type=${!!cascadeType}`);
  }
} else {
  check('eligible user found', 200, false, 'no eligible user for cascade');
}

// ============================================================
console.log('\n=== TEST 14: User lifecycle (create → edit → recycle → restore → permanent delete) ===');
const testEmail = `test.lifecycle.${Date.now()}@test.com`;
const createUserR = await api('POST', '/api/users', superToken, {
  name: 'Test Lifecycle User', email: testEmail, role: 'department_user', department: 'Sales', dealer_id: cascadeDealerId,
});
check('POST /users (create)', createUserR.status, createUserR.status === 201, `id=${createUserR.data?.id}`);
const newUserId = createUserR.data?.id;
if (newUserId) {
  const editR = await api('PATCH', `/api/users/${newUserId}`, superToken, { name: 'Test Lifecycle User Edited', phone: '1234567890' });
  check('PATCH /users/:id (edit)', editR.status, editR.status === 200);
  const getUserR = await api('GET', `/api/users/${newUserId}`, superToken);
  check('GET /users/:id', getUserR.status, getUserR.status === 200, `name=${getUserR.data?.user?.name}`);
  const recycleUserR = await api('DELETE', `/api/users/${newUserId}`, superToken);
  check('DELETE /users/:id (recycle)', recycleUserR.status, recycleUserR.status === 200);
  const restoreUserR = await api('POST', `/api/users/${newUserId}/restore`, superToken);
  check('POST /users/:id/restore', restoreUserR.status, restoreUserR.status === 200);
  // Recycle again then permanent delete
  await api('DELETE', `/api/users/${newUserId}`, superToken);
  const permUserR = await api('DELETE', `/api/users/${newUserId}/permanent`, superToken);
  check('DELETE /users/:id/permanent', permUserR.status, permUserR.status === 200, permUserR.data?.message);
}

// ============================================================
console.log('\n=== TEST 15: Model lifecycle (create → recycle → restore → permanent delete) ===');
const cascadeBrandId15 = 1; // Use a known brand_id
const createModelR = await api('POST', '/api/master/models', superToken, { name: `TestModel${Date.now()}`, brand_id: cascadeBrandId15 });
check('POST /master/models (create)', createModelR.status, createModelR.status === 201, `id=${createModelR.data?.model?.id}`);
const newModelId = createModelR.data?.model?.id;
if (newModelId) {
  const recycleModelR = await api('DELETE', `/api/master/models/${newModelId}`, superToken);
  check('DELETE /master/models/:id (recycle)', recycleModelR.status, recycleModelR.status === 200);
  const restoreModelR = await api('POST', `/api/master/models/${newModelId}/restore`, superToken);
  check('POST /master/models/:id/restore', restoreModelR.status, restoreModelR.status === 200);
  // Recycle again then permanent delete
  await api('DELETE', `/api/master/models/${newModelId}`, superToken);
  const permModelR = await api('DELETE', `/api/master/models/${newModelId}/permanent`, superToken);
  check('DELETE /master/models/:id/permanent', permModelR.status, permModelR.status === 200, permModelR.data?.message);
}

// ============================================================
console.log('\n=== SUMMARY ===');
const pass = results.filter(r => r.pass).length;
const fail = results.filter(r => !r.pass).length;
console.log(`TOTAL: ${results.length}, PASS: ${pass}, FAIL: ${fail}`);
if (fail > 0) {
  console.log('\nFAILURES:');
  results.filter(r => !r.pass).forEach(r => console.log(`  ✗ ${r.name} — ${r.note}`));
}
await db.$disconnect();
process.exit(fail > 0 ? 1 : 0);
