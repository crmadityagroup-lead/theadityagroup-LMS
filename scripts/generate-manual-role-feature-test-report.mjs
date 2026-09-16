import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';

const outputDir = path.resolve('reports');
fs.mkdirSync(outputDir, { recursive: true });
const output = path.join(outputDir, 'aditya-group-crm-manual-role-feature-test-report.pdf');
const doc = new PDFDocument({ size: 'A4', margin: 42, bufferPages: true });
const stream = fs.createWriteStream(output);
doc.pipe(stream);

const checks = [
  ['Admin Login History hidden in navigation', 'PASS', 'Removed from Admin navigation and direct route fallback now returns Dashboard.'],
  ['Admin Login History API authorization', 'PASS', 'API now permits only Super Admin and returns 403 for other roles.'],
  ['TypeScript validation', 'PASS', 'npx tsc --noEmit completed without errors.'],
  ['ESLint validation', 'BLOCKED', 'The installed eslint-config-next entry could not be resolved by ESLint 9 in this environment.'],
  ['Production build', 'BLOCKED', 'next build started but produced no progress and was stopped after hanging in the local environment.'],
  ['Role user creation and cleanup', 'BLOCKED', 'Database test stopped before user creation because PostgreSQL TLS failed: no credentials available in the security package.'],
  ['OTP and authenticated API flow', 'BLOCKED', 'Requires the same unavailable PostgreSQL connection and a running application server.'],
  ['Push notification delivery', 'BLOCKED', 'Requires a running server, working database, browser permission, and VAPID keys. No VAPID keys are configured in the active .env.'],
  ['Manual desktop/mobile browser flow', 'BLOCKED', 'No application server was available after the database environment failed; no browser result is claimed.'],
];

const roles = [
  ['Super Admin', 'Dashboard, Leads, Models, Users, Reports, Performance, Login History, Recycle Bin, Theme, Backup & Restore'],
  ['Admin', 'Dashboard, Leads, Reports, Performance, Recycle Bin'],
  ['Data Operator 1', 'Dashboard, Leads, Add Entry, Reports'],
  ['Data Operator 2', 'Dashboard, Leads, Add Entry, Reports'],
  ['Department User', 'Dashboard, Leads'],
];

const departments = [
  'Sales (Personal)', 'Sales (Commercial)', 'Service', 'Spare Parts', 'Accessories',
  'Finance', 'Insurance', 'Bodyshop', 'Used Manager / Used Car', 'Emergency Breakdown',
];

function title(text, subtitle) {
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#111111').text(text, 42, 46);
  doc.font('Helvetica').fontSize(9).fillColor('#666666').text(subtitle, 42, 72, { width: 511 });
}
function pageIfNeeded(y, height = 60) {
  if (y + height <= 755) return y;
  doc.addPage();
  return 54;
}
function badge(status, x, y) {
  const color = status === 'PASS' ? '#16803c' : '#9a6700';
  doc.fillColor(color).roundedRect(x, y, 62, 17, 4).fill();
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#ffffff').text(status, x, y + 5, { width: 62, align: 'center' });
}
function footer() {
  const pages = doc.bufferedPageRange();
  for (let page = pages.start; page < pages.start + pages.count; page += 1) {
    doc.switchToPage(page);
    doc.font('Helvetica').fontSize(7).fillColor('#777777').text(`Aditya Group CRM | Manual Role Feature Test | Page ${page + 1} of ${pages.count}`, 42, 785, { width: 511, align: 'right' });
  }
}

doc.fillColor('#d89b27').rect(0, 0, 595, 18).fill();
doc.font('Helvetica-Bold').fontSize(22).fillColor('#111111').text('Aditya Group CRM', 42, 50);
doc.font('Helvetica').fontSize(15).fillColor('#555555').text('Manual Role, Department and Notification Test Report', 42, 80);
doc.fontSize(9).fillColor('#666666').text(`Generated ${new Date().toLocaleDateString('en-IN')}`, 42, 106);
doc.font('Helvetica-Bold').fontSize(12).fillColor('#111111').text('Executive Summary', 42, 150);
doc.font('Helvetica').fontSize(10).fillColor('#333333').text('The requested Admin Login History restriction was implemented and validated by TypeScript. The full human/API run could not complete because the configured PostgreSQL connection rejected TLS credentials. This report separates verified code checks from environment-blocked tests and does not mark blocked flows as passed.', 42, 172, { width: 511, lineGap: 5 });
doc.font('Helvetica-Bold').fontSize(12).fillColor('#111111').text('Release status', 42, 262);
doc.font('Helvetica-Bold').fontSize(14).fillColor('#9a6700').text('BLOCKED FOR FULL E2E SIGN-OFF', 42, 284);
doc.font('Helvetica').fontSize(10).fillColor('#333333').text('The application still needs a working database TLS configuration and a running server before real user creation, lead lifecycle, browser notification, push notification, and manual mobile/desktop checks can be completed.', 42, 310, { width: 511, lineGap: 5 });

doc.addPage();
title('Test Results', 'Verified checks and blocked checks from this run.');
let y = 110;
for (const [name, status, evidence] of checks) {
  y = pageIfNeeded(y, 62);
  badge(status, 42, y);
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111111').text(name, 118, y + 1, { width: 430 });
  doc.font('Helvetica').fontSize(8.5).fillColor('#555555').text(evidence, 118, y + 20, { width: 430, lineGap: 3 });
  y += 59;
}

doc.addPage();
title('Role and Dashboard Test Map', 'Tabs to verify manually after the database and server are available.');
y = 110;
for (const [role, tabs] of roles) {
  y = pageIfNeeded(y, 58);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111').text(role, 42, y);
  doc.font('Helvetica').fontSize(9).fillColor('#444444').text(tabs, 175, y, { width: 378, lineGap: 3 });
  y += Math.max(38, doc.heightOfString(tabs, { width: 378, lineGap: 3 }) + 16);
}
doc.font('Helvetica-Bold').fontSize(11).fillColor('#111111').text('Role test actions', 42, y + 10);
y += 34;
for (const line of [
  'Super Admin: create one temporary user for every role, verify every tab, then recycle and permanently remove the temporary users.',
  'Admin: verify Login History is absent from the sidebar, direct route, and API response.',
  'Data Operators: create a lead, assign it to a department user, edit only their own created lead, and verify reports are scoped.',
  'Department User: open the assigned lead and submit required status, remark, and next follow-up update.',
  'All roles: verify dealer isolation, department isolation, search scope, notifications, and responsive tables.',
]) {
  y = pageIfNeeded(y, 44);
  doc.font('Helvetica').fontSize(9).fillColor('#444444').text(`- ${line}`, 52, y, { width: 490, lineGap: 3 });
  y += 33;
}

doc.addPage();
title('Department Test Matrix', 'Each department must be tested through assignment, update, notification, and reporting.');
y = 110;
for (const department of departments) {
  y = pageIfNeeded(y, 44);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111').text(department, 42, y);
  doc.font('Helvetica').fontSize(9).fillColor('#555555').text('Lead assignment -> department form -> required status -> remark/follow-up -> notification -> dashboard/report verification', 190, y, { width: 350, lineGap: 3 });
  y += 37;
}

doc.addPage();
title('Notification and Push Test Plan', 'Expected two-way behavior for the next environment-enabled run.');
y = 110;
for (const [name, expected] of [
  ['Assignment', 'Assigned user, Admin, and Super Admin receive an alert. The actor does not receive a duplicate self-alert.'],
  ['Status update', 'Managing Data Operator, Admin, and Super Admin receive the status change.'],
  ['Remark', 'Managing Data Operator, Admin, and Super Admin receive the remark details.'],
  ['Cross-tab', 'A second open CRM tab receives the notification and updates its title with the unread count.'],
  ['Browser push', 'Allow permission, subscribe with VAPID keys, send an event, verify notification while another tab is active or the CRM tab is hidden.'],
]) {
  y = pageIfNeeded(y, 70);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111').text(name, 42, y);
  doc.font('Helvetica').fontSize(9).fillColor('#444444').text(expected, 160, y, { width: 393, lineGap: 3 });
  y += 58;
}

footer();
doc.end();
stream.on('finish', () => console.log(output));
