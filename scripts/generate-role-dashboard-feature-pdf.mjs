import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';

const outputDir = path.resolve('reports');
fs.mkdirSync(outputDir, { recursive: true });
const output = path.join(outputDir, 'aditya-group-crm-role-dashboard-features.pdf');
const doc = new PDFDocument({ size: 'A4', margin: 42, bufferPages: true });
const stream = fs.createWriteStream(output);
doc.pipe(stream);

const roles = [
  ['Super Admin', 'Dashboard, Leads, Models, Users, Reports, Performance, Login History, Recycle Bin, Theme, Backup & Restore', 'All dealers, departments, users, master data, reports, settings, notifications, and system maintenance.'],
  ['Admin', 'Dashboard, Leads, Reports, Performance, Recycle Bin', 'Permitted dealer leads, assignments, updates, reports, performance, and recycle-bin operations. Login History is Super Admin only.'],
  ['Data Operator 1', 'Dashboard, Leads, Add Entry, Reports', 'Create and assign leads within configured scope, edit leads created by the operator, view scoped reports, and receive activity notifications.'],
  ['Data Operator 2', 'Dashboard, Leads, Add Entry, Reports', 'Create and assign leads within the assigned dealer, edit leads created by the operator, view dealer-scoped reports, and receive activity notifications.'],
  ['Department User', 'Dashboard, Leads', 'View assigned department leads and update status, remark, and next follow-up date. Reports and Add Entry are hidden.'],
];

const departments = [
  ['Sales (Personal)', 'Budget; Purchase Timeline; Test Drive Details; Quotation Amount; Exchange Value; Booking Amount; Expected Delivery Date; Customer Interest'],
  ['Sales (Commercial)', 'Organization; Fleet Size; Quantity; Use Case; Commercial Value; Demo; Expected Purchase Date; Order Details'],
  ['Service', 'Job Card; Service Type; Advisor; Diagnosis; Estimated Cost; Final Cost; Parts Required; Repair Details; Expected Delivery'],
  ['Spare Parts', 'Part/Accessory; Part Number; Availability; Quantity; Price; Order Required; Expected Availability'],
  ['Accessories', 'Part/Accessory; Part Number; Availability; Quantity; Price; Order Required; Expected Availability'],
  ['Finance', 'Finance Company; Loan Amount; Down Payment; EMI; Tenure; Application Number; Approval; Disbursement'],
  ['Insurance', 'Insurance Company; Policy Number; Policy Type; Start Date; Expiry Date; Premium; IDV; Renewal/Claim Details'],
  ['Bodyshop', 'Job Card; Service Type; Advisor; Diagnosis; Estimated Cost; Final Cost; Parts Required; Repair Details; Expected Delivery'],
  ['Used Manager / Used Car', 'Vehicle Make; Vehicle Model; Year; KMs; Condition; Expected Price; Offer Price; Customer Decision'],
  ['Emergency Breakdown', 'Job Card; Service Type; Advisor; Diagnosis; Estimated Cost; Final Cost; Repair Details; Expected Delivery'],
];

const features = [
  ['Authentication', 'OTP login, OTP expiry, protected session, logout, auth/me, inactive-user protection.'],
  ['Dashboard', 'KPI cards, lead totals, status charts, dealer charts, department charts, recent leads, filters, responsive layout.'],
  ['Leads', 'Search, status/priority/department filters, lead detail, assignment, multiple assignees, edit, status changes, follow-up, recycle.'],
  ['Add Entry', 'Dealer, brand, model, enquiry category, enquiry type, department resolution, eligible users, customer data, validation, assignment.'],
  ['Reports', 'Dealer, department, user, status, priority, date and source filters with CSV, Excel, and PDF export.'],
  ['Performance', 'User workload, lead status distribution, conversion and activity metrics for authorized roles.'],
  ['Login History', 'Login records and session activity for Super Admin only.'],
  ['Recycle Bin', 'Recycle, restore, and permanent deletion controls for authorized administrators.'],
  ['Users', 'Super Admin user creation, role, dealer, department, enquiry-type access, edit, recycle, restore, and permissions.'],
  ['Models', 'Super Admin dealer/brand/model management, add, edit, recycle, and dealer validation.'],
  ['Theme', 'Super Admin application color palette and theme configuration.'],
  ['Backup & Restore', 'Super Admin database backup and restore controls.'],
  ['Universal Search', 'Search leads and CRM records while respecting the signed-in user scope.'],
  ['Notifications', 'Assignment, status, remark, follow-up activity, in-app bell, browser notification, cross-tab updates, and tab unread count.'],
  ['Security scope', 'Dealer isolation, department isolation, role authorization, protected APIs, and server-side validation.'],
];

const workflows = [
  ['Lead creation', 'Data Operator -> Add Entry -> select dealer/brand/model -> select category/type -> resolve department -> assign users -> create lead.'],
  ['Department update', 'Department User -> Leads -> assigned lead -> Department Update -> required status -> remark -> next follow-up -> Save Update.'],
  ['Assignment notification', 'Assignment creates notifications for assigned users, Admin, and Super Admin. The actor is excluded from duplicate self-alerts.'],
  ['Status and remark notification', 'Status or remark updates notify the managing Data Operator, Admin, and Super Admin.'],
  ['Reporting', 'Authorized user -> Reports -> apply scope filters -> view charts/tables -> export PDF, Excel, or CSV.'],
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
function footer() {
  const pages = doc.bufferedPageRange();
  for (let page = pages.start; page < pages.start + pages.count; page += 1) {
    doc.switchToPage(page);
    doc.font('Helvetica').fontSize(7).fillColor('#777777').text(`Aditya Group CRM | Role and Dashboard Feature Guide | Page ${page + 1} of ${pages.count}`, 42, 785, { width: 511, align: 'right' });
  }
}
function item(label, text, y, color = '#111111') {
  doc.font('Helvetica-Bold').fontSize(10).fillColor(color).text(label, 42, y, { width: 160 });
  doc.font('Helvetica').fontSize(9).fillColor('#444444').text(text, 210, y, { width: 343, lineGap: 3 });
  return y + Math.max(28, doc.heightOfString(text, { width: 343, lineGap: 3 }) + 12);
}

doc.fillColor('#d89b27').rect(0, 0, 595, 18).fill();
doc.font('Helvetica-Bold').fontSize(23).fillColor('#111111').text('Aditya Group CRM', 42, 50);
doc.font('Helvetica').fontSize(15).fillColor('#555555').text('Role-wise and Department-wise Feature Guide', 42, 82);
doc.fontSize(9).fillColor('#666666').text(`Generated ${new Date().toLocaleDateString('en-IN')}`, 42, 108);
doc.font('Helvetica-Bold').fontSize(12).fillColor('#111111').text('Report Summary', 42, 152);
doc.font('Helvetica').fontSize(10).fillColor('#333333').text('This document lists the current dashboard tabs, role permissions, department-specific fields, lead lifecycle, notification behavior, and reporting features of the Aditya Group CRM. Access is controlled by role, dealer, department, and assigned lead scope.', 42, 174, { width: 511, lineGap: 5 });
doc.font('Helvetica-Bold').fontSize(12).fillColor('#111111').text('Dealers', 42, 256);
doc.font('Helvetica').fontSize(10).fillColor('#333333').text('Aditya Motors | Aditya Hyundai | Highway Honda', 42, 278, { width: 511 });
doc.font('Helvetica-Bold').fontSize(12).fillColor('#111111').text('Core flow', 42, 322);
doc.font('Helvetica').fontSize(10).fillColor('#333333').text('Login -> Dashboard -> Leads -> Add Entry or assigned work -> Notifications -> Follow-up -> Reports -> Export -> Recycle or Restore', 42, 344, { width: 511, lineGap: 4 });

doc.addPage();
title('Dashboard Tabs by Role', 'These are the tabs currently configured in the application navigation.');
let y = 112;
for (const [role, tabs, access] of roles) {
  y = pageIfNeeded(y, 78);
  doc.fillColor('#111111').roundedRect(42, y, 511, 22, 4).fill();
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff').text(role, 52, y + 7);
  y += 31;
  y = item('Tabs', tabs, y, '#1d4ed8');
  y = item('Access', access, y, '#444444') + 8;
}

doc.addPage();
title('Feature Catalogue', 'Functional features available across the CRM.');
y = 110;
for (const [feature, description] of features) {
  y = pageIfNeeded(y, 48);
  y = item(feature, description, y, '#111111');
}

doc.addPage();
title('Department-wise Features', 'Department Users see fields for their assigned department.');
y = 110;
for (const [department, fields] of departments) {
  y = pageIfNeeded(y, 76);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111').text(department, 42, y, { width: 511 });
  y += 17;
  doc.font('Helvetica').fontSize(9).fillColor('#444444').text(fields, 42, y, { width: 511, lineGap: 3 });
  y += Math.max(35, doc.heightOfString(fields, { width: 511, lineGap: 3 }) + 16);
}

doc.addPage();
title('Workflows and Notifications', 'Role-aware business flows used by the CRM.');
y = 112;
for (const [name, flow] of workflows) {
  y = pageIfNeeded(y, 70);
  y = item(name, flow, y, '#111111') + 8;
}
doc.font('Helvetica-Bold').fontSize(12).fillColor('#111111').text('Permission rules', 42, y + 8);
y += 32;
for (const rule of [
  'Super Admin has full system access across dealers, departments, users, models, reports, theme, and backups.',
  'Admin manages permitted lead data, reports, performance, history, and recycle-bin operations.',
  'Data Operators create leads and can edit leads they created; they cannot recycle leads.',
  'Department Users work only with assigned department leads and can update status, remarks, and follow-up dates.',
  'Exports, search, notifications, and APIs must respect dealer and department scope.',
]) {
  y = pageIfNeeded(y, 42);
  doc.font('Helvetica').fontSize(9).fillColor('#444444').text(`- ${rule}`, 52, y, { width: 490, lineGap: 3 });
  y += 30;
}

footer();
doc.end();
stream.on('finish', () => console.log(output));
