import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config({ override: true });

const db = new PrismaClient();
const base = 'http://127.0.0.1:3000';
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET must be provided by the isolated QA environment');
const secret = process.env.JWT_SECRET;
const results = [];
const roles = ['super_admin', 'admin', 'data_operator_1', 'data_operator_2', 'department_user'];
function token(u) { return jwt.sign({ id: u.id, email: u.email, role: u.role, name: u.name, dealer_id: u.dealerId ?? null, department: u.department ?? null }, secret, { expiresIn: '1h' }); }
async function call(method, route, jwtToken, body) {
  const response = await fetch(`${base}${route}`, { method, headers: { Authorization: `Bearer ${jwtToken}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
  let data = null; try { data = await response.json(); } catch { /* empty response */ }
  return { status: response.status, data };
}
function check(name, response, pass, note = '') { results.push({ name, pass, note }); console.log(`${pass ? 'PASS' : 'FAIL'} | ${response.status} | ${name}${note ? ` | ${note}` : ''}`); }

const root = await db.crmUser.findFirst({ where: { role: 'super_admin', active: true }, select: { id: true, name: true, email: true, role: true, dealerId: true, department: true } });
const rootToken = token(root);
const created = [];
try {
  console.log('ROLE DUMMY USER MATRIX');
  for (const role of roles) {
    const email = `dummy.${role}.${Date.now()}@test.invalid`;
    const scoped = ['data_operator_1', 'data_operator_2', 'department_user'].includes(role);
    const createdResponse = await call('POST', '/api/users', rootToken, { name: `Dummy ${role}`, email, role, dealer_id: scoped ? 1 : null, department: role === 'department_user' ? 'Sales' : null });
    check(`${role}: create dummy user`, createdResponse, createdResponse.status === 201, `id=${createdResponse.data?.id || '-'}`);
    if (!createdResponse.data?.id) continue;
    const dbUser = await db.crmUser.findUnique({ where: { id: createdResponse.data.id }, select: { id: true, name: true, email: true, role: true, dealerId: true, department: true } });
    created.push(dbUser);
    const roleToken = token(dbUser);
    const me = await call('GET', '/api/auth/me', roleToken); check(`${role}: auth/me`, me, me.status === 200 && me.data?.user?.role === role);
    for (const endpoint of ['/api/dashboard', '/api/leads?limit=2', '/api/reports/summary', '/api/notifications', '/api/search?q=dummy']) {
      const response = await call('GET', endpoint, roleToken);
      check(`${role}: GET ${endpoint.split('?')[0]}`, response, response.status === 200);
    }
    const models = await call('GET', '/api/master/all-models', roleToken);
    check(`${role}: master model permission`, models, role === 'super_admin' ? models.status === 200 : models.status === 403);
  }
} finally {
  for (const dummy of created) {
    const recycled = await call('DELETE', `/api/users/${dummy.id}`, rootToken);
    check(`${dummy.role}: recycle dummy cleanup`, recycled, recycled.status === 200);
    const deleted = await call('DELETE', `/api/users/${dummy.id}/permanent`, rootToken);
    check(`${dummy.role}: permanent dummy cleanup`, deleted, deleted.status === 200);
  }
  await db.$disconnect();
}
const pass = results.filter((result) => result.pass).length;
const fail = results.length - pass;
console.log(`TOTAL: ${results.length}, PASS: ${pass}, FAIL: ${fail}`);
process.exit(fail ? 1 : 0);
