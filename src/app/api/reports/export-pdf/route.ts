import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { buildLeadFilters, LeadFilterError } from '@/lib/lead-filters';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response('Not authenticated', { status: 401 });
  if (user.role === 'department_user') return new Response('Reports are not available for Department Users', { status: 403 });
  const { default: PDFKit } = await import('pdfkit');
  let where;
  try { where = buildLeadFilters(user, req.nextUrl.searchParams); }
  catch (error) { return new Response(error instanceof LeadFilterError ? error.message : 'Invalid filters', { status: 400 }); }
  const leads = await db.crmLead.findMany({
    where, take: 500, orderBy: { createdAt: 'desc' },
    select: { leadCode: true, customerName: true, mobile: true, status: true, priority: true, department: true, createdAt: true, dealer: { select: { name: true } } },
  });

  let logo: Buffer | null = null;
  try { logo = readFileSync(join(process.cwd(), 'public', 'logo-light.png')); } catch { /* Keep report generation available if the asset is missing. */ }

  const doc = new (PDFKit as any)({ size: 'A4', layout: 'landscape', margin: 28, bufferPages: true, autoFirstPage: false });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  const pageWidth = 786;
  const columns = [
    ['Lead Code', 70], ['Customer', 150], ['Mobile', 85], ['Dealer', 130],
    ['Department', 110], ['Priority', 70], ['Status', 85], ['Created', 86],
  ] as const;
  const drawHeader = () => {
    doc.fillColor('#111111').rect(28, 114, pageWidth, 34).fill();
    let x = 36;
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
    columns.forEach(([label, width]) => { doc.text(label, x, 126, { width, ellipsis: true }); x += width; });
  };
  const statusCounts = leads.reduce<Record<string, number>>((counts, lead: any) => {
    counts[lead.status] = (counts[lead.status] || 0) + 1;
    return counts;
  }, {});
  const summary = Object.entries(statusCounts).map(([status, count]) => `${status.replace('_', ' ')}: ${count}`).join('  |  ');
  const drawRow = (lead: any, index: number, y: number) => {
    if (index % 2 === 0) doc.fillColor('#f7f4ed').rect(28, y - 5, pageWidth, 24).fill();
    const values = [lead.leadCode, lead.customerName, lead.mobile, lead.dealer?.name, lead.department, lead.priority, lead.status, lead.createdAt.toLocaleDateString('en-IN')];
    let x = 36;
    doc.font('Helvetica').fontSize(8).fillColor('#222222');
    values.forEach((value, index) => { doc.text(String(value || '-').slice(0, 24), x, y, { width: columns[index][1] - 8, ellipsis: true }); x += columns[index][1]; });
  };
  // Create the first page explicitly so PDFKit cannot leave an empty page
  // before the report content or append one after the final row.
  doc.addPage();
  doc.fillColor('#d89b27').rect(0, 0, 842, 16).fill();
  if (logo) doc.image(logo, 704, 24, { fit: [82, 58], align: 'right', valign: 'center' });
  doc.font('Helvetica-Bold').fontSize(20).fillColor('#111111').text('Aditya Group CRM', 28, 34);
  doc.font('Helvetica').fontSize(14).fillColor('#555555').text('Leads Report', 28, 59);
  const dealerScope = user.dealer_name || (user.dealer_id ? `Dealer #${user.dealer_id}` : 'All permitted dealers');
  doc.fontSize(9).fillColor('#666666').text(`Generated ${new Date().toLocaleString('en-IN')}  |  ${leads.length} leads  |  ${user.name} (${user.role})`, 28, 77, { lineBreak: false });
  doc.fontSize(9).fillColor('#111111').text(`Dealer: ${dealerScope}`, 28, 88, { lineBreak: false });
  doc.fontSize(8).fillColor('#444444').text(`Summary: ${summary || 'No leads matched the selected filters.'}`, 28, 101, { width: pageWidth, ellipsis: true, lineBreak: false });
  drawHeader();
  let y = 145;
  let rowIndex = 0;
  for (const lead of leads) {
    if (rowIndex > 0 && y + 24 > 545) { doc.addPage(); drawHeader(); y = 145; }
    drawRow(lead, rowIndex, y); y += 24; rowIndex += 1;
  }
  const pages = doc.bufferedPageRange();
  for (let page = pages.start; page < pages.start + pages.count; page += 1) {
    doc.switchToPage(page);
    doc.fontSize(8).fillColor('#777777').text(`Aditya Group CRM  |  Page ${page + 1} of ${pages.count}`, 28, 565, { align: 'right', width: pageWidth, lineBreak: false });
  }
  doc.end();
  const buffer = await done;
  return new Response(new Uint8Array(buffer), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="crm-report-${Date.now()}.pdf"` } });
}
