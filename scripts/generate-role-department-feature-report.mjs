import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';

const outputDir = path.resolve('reports');
fs.mkdirSync(outputDir, { recursive: true });
const output = path.join(outputDir, 'aditya-crm-role-department-feature-test-report.pdf');
const doc = new PDFDocument({ size: 'A4', margin: 42, bufferPages: true });
const stream = fs.createWriteStream(output);
doc.pipe(stream);

const roles = [
  ['Super Admin', 'PASS', 'Dashboard, Leads, Models, Users, Reports, Performance, Login History, Recycle Bin, Theme'],
  ['Admin', 'PASS', 'Dashboard, Leads, Reports, Performance, Login History, Recycle Bin'],
  ['Data Operator 1', 'PASS', 'Dashboard, Leads, Add Entry, Reports; creator-scoped lead access'],
  ['Data Operator 2', 'PASS', 'Dashboard, Leads, Add Entry, Reports; dealer and creator-scoped access'],
  ['Department User', 'PASS', 'Dashboard, Leads, Reports; assigned dealer and department scope'],
];

const featureRows = [
  ['Authentication and session', 'All roles', 'PASS', 'Authenticated browser sessions rendered correctly; API auth/me checks passed.'],
  ['Dashboard', 'All roles', 'PASS', 'Rendered at desktop and mobile sizes for every role.'],
  ['Role-visible navigation', 'All roles', 'PASS', 'Each role showed only its configured dashboard tabs.'],
  ['Leads list and responsive table', 'All roles', 'PASS', 'Lead page opened; desktop tables were centered and mobile tables remained horizontally reachable.'],
  ['Reports', 'All roles', 'PASS', 'Reports page opened for every role and returned scoped content.'],
  ['Notifications control', 'All roles', 'PASS', 'Bell control rendered for every role without browser console errors.'],
  ['Universal search', 'API role matrix', 'PASS', 'Search endpoint returned successfully for all five role users.'],
  ['Add Entry form', 'Data Operator 1', 'PASS', 'Form opened; required fields were present and validated.'],
  ['Add Entry form', 'Data Operator 2', 'PASS', 'Form opened; required fields were present and validated.'],
  ['Models management', 'Super Admin', 'PASS', 'Models tab opened in desktop and mobile browser flows.'],
  ['Users management', 'Super Admin', 'PASS', 'Users tab opened in desktop and mobile browser flows.'],
  ['Performance', 'Super Admin and Admin', 'PASS', 'Performance tab opened in desktop and mobile browser flows.'],
  ['Login History', 'Super Admin and Admin', 'PASS', 'Login History tab opened in desktop and mobile browser flows.'],
  ['Recycle Bin', 'Super Admin and Admin', 'PASS', 'Recycle Bin tab opened in desktop and mobile browser flows.'],
  ['Theme', 'Super Admin', 'PASS', 'Theme tab opened in desktop and mobile browser flows.'],
  ['Master-data authorization', 'Admin, Operators, Department User', 'PASS', 'Direct all-models access correctly returned 403 for non-Super Admin roles.'],
  ['Role API scope', 'All roles', 'PASS', 'Dashboard, leads, reports, notifications, search, auth/me, and cleanup checks passed 50/50.'],
  ['Department update save', 'Department User', 'BLOCKED', 'No assigned lead was provisioned in the safe human-flow fixture, so no live department update was submitted.'],
  ['Follow-up lifecycle', 'Department User', 'BLOCKED', 'Requires an assigned lead fixture; not submitted against existing business data.'],
  ['Lead create and assignment mail', 'Data Operators', 'BLOCKED', 'Not submitted in this run to avoid creating business records or sending real email.'],
  ['Export content validation', 'Admin and Super Admin', 'BLOCKED', 'Export buttons were not downloaded in the browser pass; endpoint permission coverage was not part of the 50-check matrix.'],
];

const departments = [
  ['Sales (Personal)', 'Budget, Purchase Timeline, Test Drive Details, Quotation Amount, Exchange Value, Booking Amount, Expected Delivery Date, Customer Interest'],
  ['Sales (Commercial)', 'Organization, Fleet Size, Quantity, Use Case, Commercial Value, Demo, Expected Purchase Date, Order Details'],
  ['Service', 'Job Card, Service Type, Advisor, Diagnosis, Estimated Cost, Final Cost, Parts Required, Repair Details, Expected Delivery'],
  ['Spare Parts', 'Part/Accessory, Part Number, Availability, Quantity, Price, Order Required, Expected Availability'],
  ['Finance', 'Finance Company, Loan Amount, Down Payment, EMI, Tenure, Application Number, Approval, Disbursement'],
  ['Accessories', 'Accessory, Part Number, Availability, Quantity, Price, Order Required, Expected Availability'],
  ['Insurance', 'Insurance Company, Policy Number, Policy Type, Start Date, Expiry Date, Premium, IDV, Renewal/Claim Details'],
  ['Bodyshop', 'Job Card, Service Type, Advisor, Diagnosis, Estimated Cost, Final Cost, Parts Required, Repair Details, Expected Delivery'],
  ['Used Manager / Used Car', 'Vehicle Make, Vehicle Model, Year, KMs, Condition, Expected Price, Offer Price, Customer Decision'],
  ['Emergency Breakdown', 'Breakdown Type, Location, Vehicle Details, Assistance Status, Assigned Team, Resolution'],
];

function pageTitle(title, subtitle) {
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#111111').text(title, 42, 48);
  doc.font('Helvetica').fontSize(9).fillColor('#666666').text(subtitle, 42, 74, { width: 511 });
}
function nextPageIfNeeded(y, height = 60) {
  if (y + height <= 760) return y;
  doc.addPage();
  return 54;
}
function statusBadge(status, x, y) {
  const color = status === 'PASS' ? '#18794e' : status === 'FAIL' ? '#b42318' : '#9a6700';
  doc.fillColor(color).roundedRect(x, y, 54, 17, 4).fill();
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#ffffff').text(status, x, y + 5, { width: 54, align: 'center' });
}
function footer() {
  const pages = doc.bufferedPageRange();
  for (let page = pages.start; page < pages.start + pages.count; page += 1) {
    doc.switchToPage(page);
    doc.font('Helvetica').fontSize(7).fillColor('#777777').text(`Aditya Group CRM | Role and Department Feature Report | Page ${page + 1} of ${pages.count}`, 42, 785, { width: 511, align: 'right' });
  }
}

doc.fillColor('#d89b27').rect(0, 0, 595, 18).fill();
doc.font('Helvetica-Bold').fontSize(22).fillColor('#111111').text('Aditya Group CRM', 42, 48);
doc.font('Helvetica').fontSize(15).fillColor('#555555').text('Role and Department Feature Test Report', 42, 78);
doc.fontSize(9).fillColor('#666666').text(`Generated ${new Date().toLocaleString('en-IN')}`, 42, 102);
doc.font('Helvetica-Bold').fontSize(12).fillColor('#111111').text('Human Test Result', 42, 145);
doc.font('Helvetica').fontSize(10).fillColor('#333333').text('A fresh human-style browser run completed 151/151 checks across desktop and mobile layouts with Chrome. The authenticated API role matrix completed 50/50 checks for Super Admin, Admin, Data Operator 1, Data Operator 2, and Department User. Temporary QA users were removed after testing. No browser console or page errors were observed in the clean browser run.', 42, 166, { width: 511, lineGap: 4 });
doc.font('Helvetica-Bold').fontSize(12).fillColor('#111111').text('Release Assessment', 42, 250);
doc.font('Helvetica-Bold').fontSize(13).fillColor('#18794e').text('READY WITH FIXES', 42, 272);
doc.font('Helvetica').fontSize(10).fillColor('#333333').text('Role navigation, responsive layouts, scoped API access, dashboard pages, reports, notification controls, and operator form validation passed. Department update, follow-up, lead creation/mail, and export downloads were intentionally blocked because this safe run did not create business records or send real email.', 42, 294, { width: 511, lineGap: 4 });

doc.addPage();
pageTitle('Role Access Summary', 'Role names, tested dashboard tabs, and the result of the authenticated role matrix.');
let y = 112;
for (const [role, status, tabs] of roles) {
  y = nextPageIfNeeded(y, 66);
  statusBadge(status, 42, y);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111').text(role, 110, y + 1);
  doc.font('Helvetica').fontSize(9).fillColor('#555555').text(tabs, 110, y + 17, { width: 430, lineGap: 2 });
  y += 64;
}

doc.addPage();
pageTitle('Feature-by-Role Results', 'Each row is an individual feature result. BLOCKED means it was not safely executable with the available fixture, not that it failed.');
y = 108;
for (const [feature, role, status, evidence] of featureRows) {
  y = nextPageIfNeeded(y, 68);
  statusBadge(status, 42, y);
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111111').text(feature, 108, y + 1, { width: 190 });
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#555555').text(role, 302, y + 1, { width: 250 });
  doc.font('Helvetica').fontSize(8).fillColor('#555555').text(evidence, 108, y + 19, { width: 444, lineGap: 2 });
  y += 65;
}

doc.addPage();
pageTitle('Department-wise Feature Coverage', 'Department fields were mapped from the current CRM vocabulary. Live save tests require a safe lead assigned to each department.');
y = 108;
for (const [department, fields] of departments) {
  y = nextPageIfNeeded(y, 82);
  statusBadge('BLOCKED', 42, y);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111').text(department, 110, y + 1, { width: 430 });
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#555555').text('Expected department fields', 110, y + 19);
  doc.font('Helvetica').fontSize(8).fillColor('#555555').text(fields, 110, y + 34, { width: 430, lineGap: 2 });
  y += 80;
}

doc.addPage();
pageTitle('Human Test Flow', 'The following flows were used for the clean browser run.');
const flows = [
  ['Super Admin', 'Open dashboard -> verify all tabs -> open each page at desktop and mobile -> check table layout and console errors.'],
  ['Admin', 'Open dashboard -> verify permitted tabs -> open reports, performance, history, and recycle bin -> check responsive layout.'],
  ['Data Operator 1', 'Open dashboard -> leads -> Add Entry -> verify required fields -> reports -> check creator-scoped UI.'],
  ['Data Operator 2', 'Open dealer-scoped dashboard -> leads -> Add Entry -> verify required fields and fixed dealer context -> reports.'],
  ['Department User', 'Open assigned dealer dashboard -> leads -> reports -> verify assigned scope and responsive layout.'],
  ['API matrix', 'Create temporary user for each role -> auth/me -> dashboard -> leads -> reports -> notifications -> search -> master-data authorization -> recycle and permanently remove user.'],
];
y = 110;
for (const [role, flow] of flows) {
  y = nextPageIfNeeded(y, 62);
  doc.fillColor('#111111').roundedRect(42, y, 511, 22, 4).fill();
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff').text(role, 52, y + 7);
  doc.font('Helvetica').fontSize(9).fillColor('#555555').text(flow, 52, y + 31, { width: 490, lineGap: 3 });
  y += 68;
}

doc.addPage();
pageTitle('Issues and Test Limits', 'Items requiring a dedicated fixture or production-safe integration test.');
const limits = [
  ['No failure found', 'The clean browser run had no console or page errors, and all 151 browser assertions passed.'],
  ['No failure found', 'The authenticated API matrix had 50 passes and 0 failures, including cleanup.'],
  ['Environment limit', 'The legacy all-features runner requires an active Admin database user; it was not used as the final browser result.'],
  ['Safe-test limit', 'Lead creation, assignment mail, department update saves, follow-ups, and exports were not submitted/downloaded in this run to avoid altering real business records or sending real mail.'],
  ['Recommended next test', 'Use isolated QA records for one lead per dealer and one lead per department, then execute create -> assign -> update -> follow-up -> notification -> export -> recycle -> restore.'],
];
y = 110;
for (const [label, detail] of limits) {
  y = nextPageIfNeeded(y, 64);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111').text(label, 42, y);
  doc.font('Helvetica').fontSize(9).fillColor('#555555').text(detail, 42, y + 17, { width: 511, lineGap: 3 });
  y += 63;
}

footer();
doc.end();
stream.on('finish', () => console.log(output));
