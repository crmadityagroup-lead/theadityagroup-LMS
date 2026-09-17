import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { buildLeadFilters, LeadFilterError } from '@/lib/lead-filters';

export const runtime = 'nodejs';

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const ROWS_PER_PAGE = 16;

function pdfText(value: unknown, maxLength = 24) {
  return String(value ?? '-')
    .replace(/[\\()]/g, '\\$&')
    .replace(/[^\x20-\x7e]/g, '?')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, maxLength);
}

function pdfLine(text: string, x: number, y: number, size = 8, bold = false) {
  return `BT /F${bold ? 2 : 1} ${size} Tf ${x} ${y} Td (${text}) Tj ET\n`;
}

function createPdf(pages: string[]) {
  const pageObjects = pages.map((_, index) => 3 + index * 2);
  const contentObjects = pages.map((_, index) => 4 + index * 2);
  const objects: Buffer[] = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>', 'ascii'),
    Buffer.from(`<< /Type /Pages /Kids [${pageObjects.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`, 'ascii'),
  ];

  pages.forEach((content, index) => {
    objects.push(Buffer.from(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >> /Contents ${contentObjects[index]} 0 R >>`,
      'ascii',
    ));
    const stream = Buffer.from(content, 'ascii');
    objects.push(Buffer.concat([
      Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, 'ascii'),
      stream,
      Buffer.from('\nendstream', 'ascii'),
    ]));
  });

  const header = Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'binary');
  const chunks: Buffer[] = [header];
  const offsets = [0];
  let offset = header.length;
  objects.forEach((object, index) => {
    const objectHeader = Buffer.from(`${index + 1} 0 obj\n`, 'ascii');
    const objectFooter = Buffer.from('\nendobj\n', 'ascii');
    offsets.push(offset);
    chunks.push(objectHeader, object, objectFooter);
    offset += objectHeader.length + object.length + objectFooter.length;
  });

  const xrefOffset = offset;
  const xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((value) => `${String(value).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  chunks.push(Buffer.from(xref, 'ascii'));
  return Buffer.concat(chunks);
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response('Not authenticated', { status: 401 });
  if (user.role === 'department_user') return new Response('Reports are not available for Department Users', { status: 403 });

  let where;
  try {
    where = buildLeadFilters(user, req.nextUrl.searchParams);
  } catch (error) {
    return new Response(error instanceof LeadFilterError ? error.message : 'Invalid filters', { status: 400 });
  }

  const leads = await db.crmLead.findMany({
    where,
    take: 500,
    orderBy: { createdAt: 'desc' },
    select: { leadCode: true, customerName: true, mobile: true, status: true, priority: true, department: true, createdAt: true, dealer: { select: { name: true } } },
  });

  const columns = [
    ['Lead Code', 36], ['Customer', 106], ['Mobile', 251], ['Dealer', 336],
    ['Department', 461], ['Priority', 569], ['Status', 639], ['Created', 724],
  ] as const;
  const totalPages = Math.max(1, Math.ceil(leads.length / ROWS_PER_PAGE));
  const pages = Array.from({ length: totalPages }, (_, pageIndex) => {
    const pageLeads = leads.slice(pageIndex * ROWS_PER_PAGE, (pageIndex + 1) * ROWS_PER_PAGE);
    let content = '0.847 0.608 0.153 rg 0 579 842 16 re f\n';
    content += '0.067 0.067 0.067 rg\n';
    content += pdfLine('Aditya Group CRM', 28, 546, 20, true);
    content += pdfLine('Leads Report', 28, 522, 14);
    content += pdfLine(`Generated ${pdfText(new Date().toLocaleString('en-IN'), 70)}  |  ${leads.length} leads`, 28, 505, 8);
    content += '0.067 0.067 0.067 rg 28 468 786 24 re f\n';
    content += '1 1 1 rg\n';
    columns.forEach(([label, x]) => { content += pdfLine(label, x, 477, 8, true); });
    pageLeads.forEach((lead, index) => {
      const y = 447 - index * 22;
      if (index % 2 === 0) content += `0.969 0.957 0.929 rg 28 ${y - 5} 786 21 re f\n`;
      content += '0.133 0.133 0.133 rg\n';
      const values = [lead.leadCode, lead.customerName, lead.mobile, lead.dealer?.name, lead.department, lead.priority, lead.status, lead.createdAt.toLocaleDateString('en-IN')];
      values.forEach((value, columnIndex) => { content += pdfLine(pdfText(value), columns[columnIndex][1], y, 8); });
    });
    content += pdfLine(`Aditya Group CRM  |  Page ${pageIndex + 1} of ${totalPages}`, 640, 22, 8);
    return content;
  });

  const pdf = createPdf(pages);
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="crm-report-${Date.now()}.pdf"`,
    },
  });
}
