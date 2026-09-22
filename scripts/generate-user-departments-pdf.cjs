const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const outputPath = path.join(__dirname, '..', 'reports', 'aditya-motors-user-departments.pdf');
const enquiryTypes = ['Query/Enquiry', 'Complain /Concern'];
const users = [
  { name: 'Kabita', email: 'crm@adityamotors.com', role: 'Dept User', dealer: 'Aditya Motors', departments: ['Service', 'Spare Parts', 'Bodyshop'], phone: '—' },
  { name: 'Kaberi Nayak', email: 'cxmsales@adityamotors.com', role: 'Dept User', dealer: 'Aditya Motors', departments: ['Sales (Personal)', 'Sales (Commercial)', 'Finance', 'Accessories', 'Insurance', 'Used Car'], phone: '—' },
  { name: 'Prabir', email: 'agmjajpur@adityamotors.com', role: 'Dept User', dealer: 'Aditya Motors', departments: ['Sales (Personal)'], phone: '—' },
  { name: 'Ranjan', email: 'bdmcommercial@adityamotors.com', role: 'Dept User', dealer: 'Aditya Motors', departments: ['Sales (Commercial)'], phone: '—' },
  { name: 'Ajit', email: 'bdm3@adityamotors.com', role: 'Dept User', dealer: 'Aditya Motors', departments: ['Sales (Personal)'], phone: '—' },
  { name: 'Pramod', email: 'agm2@adityamotors.com', role: 'Dept User', dealer: 'Aditya Motors', departments: ['Sales (Personal)'], phone: '—' },
  { name: 'Surendra', email: 'agm1@adityamotors.com', role: 'Dept User', dealer: 'Aditya Motors', departments: ['Sales (Personal)'], phone: '—' },
  { name: 'Utkalika', email: 'digital@adityamotors.com', role: 'Dealer Admin', dealer: 'Aditya Motors', departments: [], phone: '7873999400' },
  { name: 'Anasuya', email: 'am.cre6@gmail.com', role: 'Data Operator 2', dealer: 'Aditya Motors', departments: [], phone: '7873999523' },
  { name: 'Nivedita', email: 'am.cre4@gmail.com', role: 'Data Operator 2', dealer: 'Aditya Motors', departments: [], phone: '7873999340' },
  { name: 'Minati', email: 'am.cre3@gmail.com', role: 'Data Operator 2', dealer: 'Aditya Motors', departments: [], phone: '7873999925' },
  { name: 'Sibaprasad', email: 'care@theadityagroup.com', role: 'Admin', dealer: 'Group', departments: [], phone: '7873999500' },
];

function enquiryTypeText(departments) {
  return departments.length
    ? departments.map((department) => `${department}: ${enquiryTypes.join(', ')}`).join('\n')
    : '—';
}

const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 28 });
doc.pipe(fs.createWriteStream(outputPath));
doc.fontSize(16).fillColor('#1F2937').text('Aditya Motors — User Department & Enquiry Type Matrix');
doc.moveDown(0.25).fontSize(8).fillColor('#64748B').text('Prepared from the supplied user list. Dept Users receive the two standard enquiry types for each assigned department.');
doc.moveDown(1);

const columns = [
  ['#', 20], ['User / Email', 145], ['Role', 75], ['Dealer', 85], ['Departments', 155], ['Enquiry Types', 240], ['Phone', 70],
];
const left = doc.page.margins.left;
const right = doc.page.width - doc.page.margins.right;
const headerHeight = 24;

function drawHeader(y) {
  let x = left;
  doc.fillColor('#7C5C1E').rect(left, y, right - left, headerHeight).fill();
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#FFFFFF');
  for (const [label, width] of columns) {
    doc.text(label, x + 4, y + 8, { width: width - 8 });
    x += width;
  }
  return y + headerHeight;
}

let y = drawHeader(doc.y);
doc.font('Helvetica').fontSize(7).fillColor('#1F2937');
for (const [index, user] of users.entries()) {
  const cells = [
    String(index + 1), `${user.name}\n${user.email}`, user.role, user.dealer,
    user.departments.length ? user.departments.join('\n') : '—', enquiryTypeText(user.departments), user.phone,
  ];
  const heights = cells.map((cell, cellIndex) => doc.heightOfString(cell, { width: columns[cellIndex][1] - 8, lineGap: 1 }));
  const rowHeight = Math.max(30, ...heights.map((height) => height + 10));
  if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    y = drawHeader(doc.page.margins.top);
    doc.font('Helvetica').fontSize(7).fillColor('#1F2937');
  }
  doc.fillColor(index % 2 ? '#F8FAFC' : '#FFFFFF').rect(left, y, right - left, rowHeight).fill();
  doc.strokeColor('#D1D5DB').lineWidth(0.3).rect(left, y, right - left, rowHeight).stroke();
  let x = left;
  for (const [cellIndex, [, width]] of columns.entries()) {
    doc.fillColor('#1F2937').text(cells[cellIndex], x + 4, y + 5, { width: width - 8, lineGap: 1 });
    if (cellIndex > 0) doc.strokeColor('#E5E7EB').moveTo(x, y).lineTo(x, y + rowHeight).stroke();
    x += width;
  }
  y += rowHeight;
}

doc.end();
doc.on('end', () => console.log(outputPath));
