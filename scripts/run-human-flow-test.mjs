import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { chromium } from 'playwright';

dotenv.config({ override: true });

const db = new PrismaClient();
const base = 'http://127.0.0.1:3000';
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const secret = process.env.JWT_SECRET;
const roleTabs = {
  super_admin: ['Dashboard', 'Leads', 'Models', 'Users', 'Reports', 'Performance', 'Login History', 'Recycle Bin', 'Theme'],
  admin: ['Dashboard', 'Leads', 'Reports', 'Performance', 'Login History', 'Recycle Bin'],
  data_operator_1: ['Dashboard', 'Leads', 'Add Entry', 'Reports'],
  data_operator_2: ['Dashboard', 'Leads', 'Add Entry', 'Reports'],
  department_user: ['Dashboard', 'Leads', 'Reports'],
};
const userShape = { id: true, name: true, email: true, role: true, dealerId: true, department: true };
const results = [];
const temporary = [];

function tokenFor(user) {
  return jwt.sign({
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    dealer_id: user.dealerId ?? null,
    department: user.department ?? null,
  }, secret, { expiresIn: '1h' });
}

function check(name, pass, note = '') {
  results.push({ name, pass, note });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}${note ? ` | ${note}` : ''}`);
}

async function api(method, path, token, body) {
  const response = await fetch(base + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await response.json(); } catch { /* empty response */ }
  return { status: response.status, data };
}

async function runRole(browser, role, user) {
  const token = tokenFor(user);
  for (const mode of ['desktop', 'mobile']) {
    const context = await browser.newContext({
      viewport: mode === 'desktop' ? { width: 1440, height: 900 } : { width: 390, height: 844 },
      deviceScaleFactor: 1,
    });
    await context.addCookies([{ name: 'crm_token', value: token, url: base, httpOnly: true, secure: false, sameSite: 'Lax' }]);
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    try {
      await page.goto(`${base}/?qa=${role}-${mode}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(5000);
      const bodyText = await page.locator('body').innerText();
      check(`${role} ${mode} dashboard renders`, bodyText.includes('Dashboard') || bodyText.includes('Welcome back'), bodyText.slice(0, 90).replace(/\n/g, ' '));
      check(`${role} ${mode} notification control`, await page.locator('button:has(svg.lucide-bell)').count() > 0);

      for (const tab of roleTabs[role]) {
        if (mode === 'mobile') {
          const menuButton = page.locator('header button').first();
          if (await menuButton.count() > 0) await menuButton.click();
        }
        const button = page.getByRole('button', { name: tab, exact: true }).first();
        const visible = await button.count() > 0;
        check(`${role} ${mode} tab ${tab}`, visible);
        if (!visible) continue;
        await button.click();
        await page.waitForTimeout(350);
        check(`${role} ${mode} ${tab} content`, (await page.locator('body').innerText()).length > 80);
        const tables = page.locator('table');
        if (await tables.count() > 0) {
          const tableState = await tables.evaluateAll((items) => items.map((table) => ({
            scrollable: table.scrollWidth >= table.clientWidth,
            centered: Math.abs((table.getBoundingClientRect().left + table.getBoundingClientRect().right) / 2 - window.innerWidth / 2) < 180,
          })));
          check(`${role} ${mode} ${tab} table layout`, mode === 'mobile'
            ? tableState.every((item) => item.scrollable)
            : tableState.every((item) => item.centered), JSON.stringify(tableState));
        }
      }

      if (role.startsWith('data_operator')) {
        if (mode === 'mobile') {
          const menuButton = page.locator('header button').first();
          if (await menuButton.count() > 0) await menuButton.click();
        }
        const add = page.getByRole('button', { name: 'Add Entry', exact: true }).first();
        if (await add.count() > 0) {
          await add.click();
          await page.waitForTimeout(400);
          const required = await page.locator('input[required], button[aria-required="true"]').count();
          check(`${role} ${mode} Add Entry form`, await page.locator('input').count() > 4, `inputs=${await page.locator('input').count()}`);
          check(`${role} ${mode} Add Entry required validation`, required > 0, `required=${required}`);
        }
      }
      check(`${role} ${mode} browser errors`, consoleErrors.length === 0 && pageErrors.length === 0, [...consoleErrors, ...pageErrors].slice(0, 2).join(' || '));
    } catch (error) {
      check(`${role} ${mode} browser flow`, false, error.message);
    } finally {
      await context.close();
    }
  }
}

const root = await db.crmUser.findFirst({ where: { role: 'super_admin', active: true }, select: userShape });
if (!root || !secret) throw new Error('Active Super Admin and JWT_SECRET are required for the human flow test');
const rootToken = tokenFor(root);
const browser = await chromium.launch({ headless: true, executablePath: chromePath });

try {
  for (const role of Object.keys(roleTabs)) {
    let user = await db.crmUser.findFirst({ where: { role, active: true }, select: userShape });
    if (!user) {
      const created = await api('POST', '/api/users', rootToken, {
        name: `Human QA ${role}`,
        email: `human.qa.${role}.${Date.now()}@test.invalid`,
        role,
        dealer_id: ['data_operator_1', 'data_operator_2', 'department_user'].includes(role) ? 1 : null,
        department: role === 'department_user' ? 'Sales' : null,
      });
      check(`${role} temporary user creation`, created.status === 201, `status=${created.status}`);
      if (created.data?.id) {
        user = await db.crmUser.findUnique({ where: { id: created.data.id }, select: userShape });
        temporary.push(user);
      }
    }
    if (user) await runRole(browser, role, user);
    else check(`${role} browser flow`, false, 'no active user available');
  }
} finally {
  await browser.close();
  for (const user of temporary) {
    await api('DELETE', `/api/users/${user.id}`, rootToken);
    await api('DELETE', `/api/users/${user.id}/permanent`, rootToken);
  }
  await db.$disconnect();
}

const passed = results.filter((result) => result.pass).length;
const failed = results.length - passed;
console.log(`TOTAL=${results.length} PASS=${passed} FAIL=${failed}`);
process.exit(failed ? 1 : 0);
