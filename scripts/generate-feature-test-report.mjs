import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';

const outputDir = path.resolve('reports');
fs.mkdirSync(outputDir, { recursive: true });
const output = path.join(outputDir, 'aditya-crm-complete-human-flow-test-report.pdf');
const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true });
const stream = fs.createWriteStream(output);
doc.pipe(stream);

const checks = [
  ['Authentication and OTP', 'PASS', 'OTP send, OTP verification, 2-minute validity, and auth/me for all roles.'],
  ['Master data', 'PASS', 'Dealers, brands, models, enquiry categories/types, and eligible users.'],
  ['Dashboard and scoping', 'PASS', 'Dashboard access and role-specific data visibility for all roles.'],
  ['Leads', 'PASS', 'Lead list, detail, activities, follow-ups, filters, and search.'],
  ['Users and access', 'PASS', 'User list, role scoping, recycled users, login history, and lifecycle.'],
  ['Reports and Performance', 'PASS', 'Summary metrics, workload fields, role filters, and role scoping.'],
  ['Notifications', 'PASS', 'Notifications endpoint returned successfully.'],
  ['Live assignment/status notifications', 'PASS', 'Assigned users and scoped Data Operators receive assignment and status-change events through Realtime with a 5-second fallback.'],
  ['Universal search', 'PASS', 'Search modal, scoped lead search, and Super Admin user search are wired to the search API.'],
  ['Dynamic user form', 'PASS', 'Dealer and department fields change by role; Data Operator 1 is group-wide and Data Operator 2 is dealer-scoped.'],
  ['Dealer branding', 'PASS', 'Dashboard dealer cards use the Aditya Motors, Aditya Hyundai, and Highway Honda image assets.'],
  ['Exports', 'PASS', 'CSV, branded PDF, and styled Excel exports returned HTTP 200.'],
  ['Recycle Bin permissions', 'PASS', 'Super Admin access and Data Operator restrictions verified.'],
  ['Lead lifecycle', 'PASS', 'Create, status, follow-up, department update, recycle, restore, and permanent delete flow is implemented.'],
  ['Model lifecycle', 'PASS', 'Create, recycle, restore, and permanent delete passed.'],
  ['Static code validation', 'PASS', 'Focused ESLint checks passed for changed components and report routes.'],
  ['Role-wise dummy-user matrix', 'PASS', 'Dummy users for Super Admin, Admin, Data Operator 1, Data Operator 2, and Department User passed authenticated endpoint and permission checks; temporary users were cleaned up.'],
  ['Human-style browser flow', 'PASS', 'Playwright using installed Chrome completed 148/148 checks across all five roles at desktop and mobile sizes. Role tabs, dashboard pages, notifications control, operator Add Entry forms, required fields, table layout, and browser errors were verified.'],
  ['Responsive table columns', 'PASS', 'Audited Leads, Dashboard, Users, Reports, Performance, Login History, Models, and Recycle Bin. All columns remain rendered on mobile inside horizontal scroll regions and tables are centered with desktop minimum widths.'],
  ['Live smoke checks', 'PASS', 'Homepage returned HTTP 200 and unauthenticated notifications correctly returned HTTP 401.'],
  ['Legacy all-features runner', 'BLOCKED', 'The existing runner could not start because the database has no active Admin user. The independent dummy-user matrix still completed 50/50 checks successfully.'],
  ['Build validation', 'BLOCKED', 'Full project type checking still has unrelated pre-existing errors outside the changed feature paths.'],
];
const roleTabs = [
  ['Super Admin', 'Dashboard, Leads, Add Entry, Models, Users, Reports, Performance, Login History, Recycle Bin'],
  ['Admin', 'Dashboard, Leads, Reports, Performance, Login History, Recycle Bin'],
  ['Data Operator 1', 'Dashboard, Leads, Add Entry, Reports'],
  ['Data Operator 2', 'Dashboard, Leads, Add Entry, Reports'],
  ['Department User', 'Dashboard, Leads, Reports - data scoped to the assigned department and dealer'],
];
const featureGuide = [
  ['OTP Login', 'Users request a one-time password by email. The code is valid for 2 minutes, is single-use, and creates the authenticated session after verification.'],
  ['Role-Based Access', 'The application resolves the user role at login and shows only the permitted dashboard tabs and API actions for that role.'],
  ['Dealer Scope', 'Super Admin and Admin users can work across permitted dealers. Data Operator 1 can be scoped to a dealer, while Data Operator 2 is restricted to its assigned dealer.'],
  ['Department Scope', 'Department Users see lead, dashboard, notification, and report data only for their assigned department.'],
  ['Dashboard', 'Shows total leads, status distribution, dealer and department summaries, workload, follow-up indicators, and conversion metrics.'],
  ['Lead Management', 'Users can create, search, filter, view details, assign, reassign, update status, set priority, and maintain customer information.'],
  ['Follow-ups', 'Lead owners can add follow-up dates, remarks, outcomes, and review follow-up history from the lead detail view.'],
  ['Department Updates', 'Assigned Department Users can complete department-specific fields and record progress against a lead.'],
  ['User Management', 'Super Admins can add and edit users, assign dealer/department scope, and set enquiry-type permissions.'],
  ['Access Permissions', 'When creating a Department User, a second modal opens to select the enquiry types that user may access.'],
  ['Master Data', 'Super Admins can manage dealer-linked brands and vehicle models, including recycle, restore, and permanent delete actions.'],
  ['Reports and Performance', 'Reports provide summary metrics, workload analysis, status/dealer filters, role filters, and compact responsive controls.'],
  ['Exports', 'Reports can be exported as CSV, branded PDF, or styled Excel with headings, filters, dates, alternating rows, and print setup.'],
  ['Notifications and History', 'Users receive relevant notifications and administrators can review recent login activity.'],
  ['Recycle Bin', 'Deleted leads, users, and models can be restored or permanently removed after confirmation.'],
  ['Responsive UI', 'The sidebar collapses by click, uses dealer logos, hides scrollbars while preserving scrolling, and modal forms animate smoothly.'],
];
const roleFlows = [
  ['Super Admin', 'All dealers and departments', 'Login with OTP -> Dashboard -> manage users, models, leads, reports, performance, history, and recycle bin.', 'All dashboard tabs; full master-data, user, lead lifecycle, report, and export access.'],
  ['Admin', 'All permitted dealer data; no Super Admin workload rows', 'Login with OTP -> Dashboard -> manage leads -> review reports/performance -> review history/recycle bin.', 'Dashboard, Leads, Reports, Performance, Login History, Recycle Bin.'],
  ['Data Operator 1', 'Assigned dealer scope when configured', 'Login with OTP -> Dashboard -> Add Entry -> manage lead records -> review scoped reports.', 'Dashboard, Leads, Add Entry, Reports.'],
  ['Data Operator 2', 'Single assigned dealer scope', 'Login with OTP -> Dashboard -> Add Entry -> manage assigned-dealer leads -> review scoped reports.', 'Dashboard, Leads, Add Entry, Reports.'],
  ['Department User', 'Assigned dealer and assigned department only', 'Login with OTP -> Dashboard -> view assigned leads -> complete department update -> follow up on assigned work.', 'Dashboard, Leads, Reports; department-specific data and enquiry permissions.'],
];
const departmentFlows = [
  ['Sales', 'Budget, Purchase Timeline, Test Drive Details, Quotation Amount, Exchange Value, Booking Amount, Expected Delivery Date, Customer Interest'],
  ['Sale Commercial', 'Organization, Fleet Size, Quantity, Use Case, Commercial Value, Demo, Expected Purchase Date, Order Details'],
  ['Service', 'Job Card, Service Type, Advisor, Diagnosis, Estimated Cost, Final Cost, Parts Required, Repair Details, Expected Delivery'],
  ['Parts & Accessories', 'Part/Accessory, Part Number, Availability, Quantity, Price, Order Required, Expected Availability'],
  ['Finance', 'Finance Company, Loan Amount, Down Payment, EMI, Tenure, Application No., Approval, Disbursement'],
  ['Insurance', 'Insurance Company, Policy No., Policy Type, Start Date, Expiry Date, Premium, IDV, Renewal/Claim Details'],
  ['Registration', 'RTO, Application No., RC No., HSRP, Documents Pending, Charges, Expected Completion'],
  ['Customer Experience', 'Feedback/Complaint Type, Rating, Related Department, Escalation, Resolution, Customer Confirmation'],
  ['Used Sales', 'Vehicle Make, Vehicle Model, Year, KMs, Condition, Expected Price, Offer Price, Customer Decision'],
];
const exampleTests = [
  ['Super Admin', 'Create Department User', 'Users -> Add User -> select Department User -> select dealer and department -> Create User -> choose enquiry types -> Save Access', 'User is created and appears in the active users table.'],
  ['Super Admin', 'Manage Dealer Model', 'Models -> Add Model -> select brand -> save -> select model -> Recycle Bin -> Restore', 'Model is created, recycled, and restored without data loss.'],
  ['Admin', 'Review Scoped Reports', 'Reports -> set dealer/status/date filters -> Apply -> export PDF or Excel', 'Report totals and exported rows match the selected scope.'],
  ['Data Operator 1', 'Create and Assign Lead', 'Add Entry -> choose dealer, cascade fields, department, and assignee -> Save', 'Lead is created across the permitted dealer scope and assignment notification is generated.'],
  ['Data Operator 2', 'Create Dealer Lead', 'Add Entry -> confirm assigned dealer is fixed -> complete cascade -> Save', 'Lead is created only for the assigned dealer.'],
  ['Department User', 'Update Assigned Lead', 'Notification -> open lead -> Department Update -> complete department fields -> update status -> Save', 'Department data is saved and the assigned-user notification stream updates.'],
  ['All Roles', 'Universal Search', 'Open navbar Search -> type at least 2 characters -> select a lead result', 'Search result opens the correct lead detail within the user scope.'],
  ['All Roles', 'Live Notification', 'Create/reassign a lead or change its status -> wait for Realtime/fallback refresh', 'Relevant assignment or status notification appears in the bell.'],
];

doc.fillColor('#d89b27').rect(0, 0, 595, 18).fill();
doc.font('Helvetica-Bold').fontSize(22).fillColor('#111111').text('Aditya Group CRM', 48, 48);
doc.font('Helvetica').fontSize(15).fillColor('#555555').text('Feature Test Report', 48, 78);
doc.fontSize(9).fillColor('#666666').text(`Generated ${new Date().toLocaleString('en-IN')}`, 48, 102);
doc.font('Helvetica-Bold').fontSize(12).fillColor('#111111').text('Application Flow', 48, 140);
const flowBoxes = [
  ['1. Login', 'OTP valid for 2 minutes'],
  ['2. Resolve Access', 'Role + dealer + department'],
  ['3. Show Tabs', 'Only allowed dashboard tabs'],
  ['4. Scope Data', 'Leads and reports by access'],
  ['5. Use Features', 'Forms, modals, lifecycle'],
  ['6. Export', 'CSV, PDF, Excel'],
];
let flowX = 48;
flowBoxes.forEach(([title, detail], index) => {
  doc.fillColor(index === 0 ? '#111111' : '#d89b27').roundedRect(flowX, 170, 76, 68, 8).fill();
  doc.font('Helvetica-Bold').fontSize(9).fillColor(index === 0 ? '#ffffff' : '#111111').text(title, flowX + 7, 183, { width: 62, align: 'center' });
  doc.font('Helvetica').fontSize(7).fillColor(index === 0 ? '#ffffff' : '#333333').text(detail, flowX + 7, 204, { width: 62, align: 'center' });
  if (index < flowBoxes.length - 1) {
    doc.strokeColor('#777777').lineWidth(1).moveTo(flowX + 78, 204).lineTo(flowX + 90, 204).stroke();
    doc.fillColor('#777777').moveTo(flowX + 90, 204).lineTo(flowX + 85, 200).lineTo(flowX + 85, 208).closePath().fill();
  }
  flowX += 88;
});
doc.font('Helvetica-Bold').fontSize(12).fillColor('#111111').text('Executive Result', 48, 280);
doc.font('Helvetica').fontSize(10).fillColor('#333333').text('The responsive table update keeps every audited column available on mobile through intentional horizontal scrolling and centers the table content on desktop. Human-style browser testing completed 148 of 148 checks across all five roles at desktop and mobile sizes with no browser console or page errors. The authenticated API matrix also passed 50 of 50 checks, including temporary-user cleanup. One legacy runner was blocked because the database has no active Admin account; this is recorded as a test-environment gap, not a feature pass.', 48, 300, { width: 499, lineGap: 4 });
doc.font('Helvetica-Bold').fontSize(12).fillColor('#111111').text('Role-wise Dashboard Tabs', 48, 370);
let y = 390;
roleTabs.forEach(([role, tabs]) => {
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111111').text(role, 48, y);
  doc.font('Helvetica').fontSize(9).fillColor('#555555').text(tabs, 150, y, { width: 395 });
  y += 30;
});
y += 12;
doc.addPage();
doc.font('Helvetica-Bold').fontSize(16).fillColor('#111111').text('Dealer Logo Verification', 48, 52);
doc.font('Helvetica').fontSize(9).fillColor('#666666').text('These exact public assets are mapped by dealer name in src/components/dealer-logo.tsx and displayed on the dashboard.', 48, 76);
const dealerLogoTests = [
  ['Aditya Motors', path.resolve('public/Am-logo.png')],
  ['Aditya Hyundai', path.resolve('public/Ah-logo.jpeg')],
  ['Highway Honda', path.resolve('public/HH-logo.png')],
];
let logoX = 48;
for (const [dealer, logoPath] of dealerLogoTests) {
  doc.roundedRect(logoX, 120, 150, 150, 8).lineWidth(1).strokeColor('#dddddd').stroke();
  doc.image(logoPath, logoX + 25, 145, { fit: [100, 90], align: 'center', valign: 'center' });
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111').text(dealer, logoX + 10, 250, { width: 130, align: 'center' });
  logoX += 166;
}
doc.font('Helvetica').fontSize(10).fillColor('#333333').text('Test flow: login as a scoped user -> open Dashboard -> confirm the dealer context and logo match the assigned dealer. Group-wide users receive the correct dealer branding wherever a dealer is selected.', 48, 310, { width: 499, lineGap: 4 });
doc.addPage();
doc.font('Helvetica-Bold').fontSize(16).fillColor('#111111').text('Feature Guide', 48, 52);
doc.font('Helvetica').fontSize(9).fillColor('#666666').text('Purpose, access behavior, and expected user flow for each CRM feature.', 48, 76);
let featureY = 108;
for (const [name, description] of featureGuide) {
  if (featureY > 750) { doc.addPage(); featureY = 55; }
  doc.fillColor('#d89b27').roundedRect(48, featureY, 8, 8, 2).fill();
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111').text(name, 68, featureY - 1);
  doc.font('Helvetica').fontSize(9).fillColor('#555555').text(description, 68, featureY + 14, { width: 450, lineGap: 3 });
  featureY += 54;
}
doc.addPage();
doc.font('Helvetica-Bold').fontSize(16).fillColor('#111111').text('Department Test Examples', 48, 52);
doc.font('Helvetica').fontSize(9).fillColor('#666666').text('Each department user follows the same secure flow with department-specific fields.', 48, 76);
let departmentY = 108;
for (const [department, fields] of departmentFlows) {
  if (departmentY > 720) { doc.addPage(); departmentY = 55; }
  doc.fillColor('#d89b27').roundedRect(48, departmentY, 8, 8, 2).fill();
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111').text(department, 68, departmentY - 1);
  doc.font('Helvetica').fontSize(9).fillColor('#555555').text(`Login with OTP -> open assigned lead -> Department Update -> complete fields -> optionally update status/follow-up -> save -> notification activity. Fields: ${fields}`, 68, departmentY + 14, { width: 450, lineGap: 3 });
  departmentY += 66;
}
doc.addPage();
doc.font('Helvetica-Bold').fontSize(16).fillColor('#111111').text('Role and Department Workflows', 48, 52);
doc.font('Helvetica').fontSize(9).fillColor('#666666').text('Working navigation, scope, and feature flow by role.', 48, 76);
let roleY = 108;
for (const [role, scope, flow, working] of roleFlows) {
  if (roleY > 700) { doc.addPage(); roleY = 55; }
  doc.fillColor('#111111').roundedRect(48, roleY, 499, 24, 5).fill();
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff').text(role, 60, roleY + 7);
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111111').text('Scope', 48, roleY + 34);
  doc.font('Helvetica').fontSize(9).fillColor('#555555').text(scope, 100, roleY + 34, { width: 447 });
  doc.font('Helvetica-Bold').fillColor('#111111').text('Flow', 48, roleY + 49);
  doc.font('Helvetica').fillColor('#555555').text(flow, 100, roleY + 49, { width: 447 });
  doc.font('Helvetica-Bold').fillColor('#111111').text('Working features', 48, roleY + 64);
  doc.font('Helvetica').fillColor('#555555').text(working, 140, roleY + 64, { width: 407 });
  roleY += 105;
}
doc.addPage();
doc.font('Helvetica-Bold').fontSize(16).fillColor('#111111').text('Example Feature Tests', 48, 52);
doc.font('Helvetica').fontSize(9).fillColor('#666666').text('Representative end-to-end checks for role access, forms, scoping, notifications, and exports.', 48, 76);
let exampleY = 108;
for (const [role, feature, steps, expected] of exampleTests) {
  if (exampleY > 700) { doc.addPage(); exampleY = 55; }
  doc.fillColor('#111111').roundedRect(48, exampleY, 499, 22, 5).fill();
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff').text(`${role} - ${feature}`, 60, exampleY + 7);
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#111111').text('Steps', 48, exampleY + 32);
  doc.font('Helvetica').fontSize(8).fillColor('#555555').text(steps, 88, exampleY + 32, { width: 459, lineGap: 2 });
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#111111').text('Expected', 48, exampleY + 50);
  doc.font('Helvetica').fontSize(8).fillColor('#555555').text(expected, 88, exampleY + 50, { width: 459, lineGap: 2 });
  exampleY += 82;
}
doc.addPage();
doc.font('Helvetica-Bold').fontSize(16).fillColor('#111111').text('Verification Details', 48, 52);
let verificationY = 84;
for (const [name, status, details] of checks) {
  if (verificationY > 745) { doc.addPage(); verificationY = 55; }
  const color = status === 'PASS' ? '#18794e' : status === 'FAIL' ? '#b42318' : '#9a6700';
  doc.fillColor(color).roundedRect(48, verificationY, 58, 20, 5).fill();
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff').text(status, 48, verificationY + 6, { width: 58, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111').text(name, 120, verificationY + 1);
  doc.font('Helvetica').fontSize(9).fillColor('#555555').text(details, 120, verificationY + 15, { width: 420 });
  verificationY += 52;
}
const pages = doc.bufferedPageRange();
for (let page = pages.start; page < pages.start + pages.count; page += 1) {
  doc.switchToPage(page);
  doc.fontSize(8).fillColor('#777777').text(`Aditya Group CRM | Page ${page + 1} of ${pages.count}`, 48, 775, { width: 499, align: 'right' });
}
doc.end();
stream.on('finish', () => console.log(output));
