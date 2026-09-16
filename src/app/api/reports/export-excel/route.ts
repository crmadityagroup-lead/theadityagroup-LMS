import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { buildLeadFilters, LeadFilterError } from '@/lib/lead-filters';

// GET /api/reports/export-excel — Excel (.xlsx) export via ExcelJS
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response('Not authenticated', { status: 401 });
  if (user.role === 'department_user') return new Response('Reports are not available for Department Users', { status: 403 });

  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Aditya Group CRM';
  wb.title = 'Aditya Group CRM Leads Report';
  wb.subject = 'Leads report';
  const ws = wb.addWorksheet('Leads');
  ws.properties.defaultRowHeight = 22;
  ws.views = [{ state: 'frozen', ySplit: 3 }];
  ws.columns = [
    { header: 'Lead Code', key: 'leadCode', width: 18 },
    { header: 'Customer', key: 'customerName', width: 26 },
    { header: 'Mobile', key: 'mobile', width: 16 },
    { header: 'Email', key: 'email', width: 26 },
    { header: 'Source', key: 'source', width: 18 },
    { header: 'Reference Customer', key: 'referralCustomerName', width: 24 },
    { header: 'Dealer', key: 'dealer', width: 20 },
    { header: 'Brand', key: 'brand', width: 16 },
    { header: 'Model', key: 'model', width: 16 },
    { header: 'Enquiry Type', key: 'enquiryType', width: 22 },
    { header: 'Department', key: 'department', width: 18 },
    { header: 'Priority', key: 'priority', width: 10 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Assigned To', key: 'assignedUser', width: 22 },
    { header: 'Created At', key: 'createdAt', width: 22 },
  ];
  ws.insertRow(1, []);
  ws.insertRow(1, []);
  ws.mergeCells('A1:O1');
  ws.getCell('A1').value = 'ADITYA GROUP CRM - LEADS REPORT';
  ws.getCell('A1').font = { name: 'Aptos Display', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111111' } };
  ws.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 30;
  ws.mergeCells('A2:O2');
  ws.getCell('A2').value = `Generated ${new Date().toLocaleString('en-IN')} | CRM leads export`;
  ws.getCell('A2').font = { italic: true, color: { argb: 'FF666666' } };
  ws.getRow(2).height = 22;
  const header = ws.getRow(3);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD89B27' } };
  header.alignment = { vertical: 'middle', horizontal: 'left' };
  header.height = 24;
  header.eachCell((cell) => { cell.border = { bottom: { style: 'thin', color: { argb: 'FF111111' } } }; });
  ws.autoFilter = { from: 'A3', to: 'O3' };

  let where;
  try { where = buildLeadFilters(user, req.nextUrl.searchParams); }
  catch (error) { return new Response(error instanceof LeadFilterError ? error.message : 'Invalid filters', { status: 400 }); }

  const leads = await db.crmLead.findMany({
    where, take: 5000, orderBy: { createdAt: 'desc' },
    select: { leadCode: true, customerName: true, mobile: true, email: true, source: true, referralCustomerName: true, status: true, priority: true, department: true, createdAt: true, dealer: { select: { name: true } }, brand: { select: { name: true } }, model: { select: { name: true } }, enquiryType: { select: { name: true } }, assignedUser: { select: { name: true } } },
  });
  for (const l of leads as any[]) {
    ws.addRow({
      leadCode: l.leadCode, customerName: l.customerName, mobile: l.mobile, email: l.email || '',
      source: l.source || '', referralCustomerName: l.referralCustomerName || '', dealer: l.dealer?.name || '', brand: l.brand?.name || '', model: l.model?.name || '',
      enquiryType: l.enquiryType?.name || '', department: l.department, priority: l.priority, status: l.status,
      assignedUser: l.assignedUser?.name || '', createdAt: l.createdAt.toISOString(),
    });
  }

  ws.eachRow((row, rowNumber) => {
    if (rowNumber < 4) return;
    if (rowNumber % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F4ED' } };
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', wrapText: false };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } };
    });
    row.getCell(15).numFmt = 'dd-mmm-yyyy hh:mm';
  });
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  ws.headerFooter.oddFooter = '&LAditya Group CRM&CPage &P of &N&RConfidential';

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="crm-report-${Date.now()}.xlsx"`,
    },
  });
}
