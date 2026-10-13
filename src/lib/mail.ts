// Gmail SMTP transporter for sending OTP emails.
import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;
let backupTransporter: nodemailer.Transporter | null = null;

function smtpSecure(port: number, configuredValue?: string) {
  if (configuredValue?.trim()) return configuredValue.trim().toLowerCase() === 'true';
  return port === 465;
}

function getTransporter() {
  if (transporter) return transporter;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: smtpSecure(port, process.env.SMTP_SECURE),
    pool: true,
    maxConnections: 3,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

function getBackupTransporter() {
  if (backupTransporter) return backupTransporter;
  if (!process.env.SMTP_BACKUP_USER || !process.env.SMTP_BACKUP_PASS) return null;
  const port = parseInt(process.env.SMTP_BACKUP_PORT || process.env.SMTP_PORT || '587', 10);
  backupTransporter = nodemailer.createTransport({
    host: process.env.SMTP_BACKUP_HOST || process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: smtpSecure(port, process.env.SMTP_BACKUP_SECURE || process.env.SMTP_SECURE),
    pool: true,
    maxConnections: 2,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
    auth: { user: process.env.SMTP_BACKUP_USER, pass: process.env.SMTP_BACKUP_PASS },
  });
  return backupTransporter;
}

type MailMessage = Parameters<nodemailer.Transporter['sendMail']>[0];

async function sendMailWithFallback(message: MailMessage) {
  try {
    await getTransporter().sendMail(message);
  } catch (primaryError) {
    const backup = getBackupTransporter();
    if (!backup) throw primaryError;
    const backupFrom = process.env.SMTP_BACKUP_FROM || `CRM <${process.env.SMTP_BACKUP_USER}>`;
    console.error('Primary SMTP failed; retrying with backup SMTP mailbox.', primaryError);
    await backup.sendMail(Object.assign({}, message, { from: backupFrom }));
  }
}

export async function sendOtpEmail(email: string, code: string, name: string) {
  const from = process.env.SMTP_FROM || `CRM <${process.env.SMTP_USER}>`;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
      <div style="background:#0a0a0a;color:#fff;padding:24px 28px">
        <div style="font-size:18px;font-weight:700;letter-spacing:0.3px">Aditya Group CRM</div>
        <div style="font-size:12px;color:#a1a1aa;margin-top:4px">Sign-in verification</div>
      </div>
      <div style="padding:28px">
        <p style="margin:0 0 4px;font-size:15px;color:#0a0a0a">Hi ${name},</p>
        <p style="margin:0 0 20px;font-size:14px;color:#52525b">Use this one-time code to sign in to your CRM account:</p>
        <div style="text-align:center;background:#fafaf9;border:1px dashed #d4af37;border-radius:10px;padding:22px 12px;margin:0 0 18px">
          <div style="font-size:38px;font-weight:800;letter-spacing:14px;color:#0a0a0a">${code}</div>
        </div>
        <p style="margin:0;font-size:12px;color:#71717a">This code expires in 2 minutes. If you did not request this, you can safely ignore this email.</p>
      </div>
      <div style="background:#fafaf9;padding:14px 28px;font-size:11px;color:#a1a1aa;text-align:center;border-top:1px solid #e5e7eb">
        © 2026 Aditya Group. All Rights Reserved.
      </div>
    </div>
  `;

  await sendMailWithFallback({
    from,
    to: email,
    subject: `Your CRM login OTP: ${code}`,
    html,
  });
}

export async function sendGoogleFormConfirmationEmail(options: {
  email: string;
  answers: Array<{ question: string; answer: unknown }>;
}) {
  const from = process.env.SMTP_FROM || `Aditya Group <${process.env.SMTP_USER}>`;
  const escapeHtml = (value: unknown) => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  const rows = options.answers.map(({ question, answer }) => {
    const text = Array.isArray(answer) ? answer.join(', ') : String(answer ?? '');
    return `<tr><td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;color:#71717a">${escapeHtml(question)}</td><td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;color:#18181b">${escapeHtml(text || '—')}</td></tr>`;
  }).join('');
  await sendMailWithFallback({
    from,
    to: options.email,
    subject: 'We received your enquiry',
    html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#18181b"><h2>Thank you for contacting Aditya Group</h2><p>We received your form submission and our team will get in touch with you.</p><table style="width:100%;border-collapse:collapse">${rows}</table></div>`,
  });
}

export async function sendLeadAssignmentEmail(options: {
  recipients: string[];
  leadCode: string;
  dealerName?: string | null;
  department?: string | null;
  assignedBy: string;
  enquiryType?: string | null;
  fields?: Record<string, unknown>;
}) {
  const from = process.env.SMTP_FROM || `CRM <${process.env.SMTP_USER}>`;
  const recipients = [...new Set(options.recipients.map((email) => String(email || '').trim().toLowerCase()).filter(Boolean))];
  if (recipients.length === 0) return;
  const escapeHtml = (value: unknown) => String(value ?? '—')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  const fieldRows = Object.entries(options.fields || {})
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(([label, value]) => `<tr><td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;color:#71717a;width:38%">${escapeHtml(label)}</td><td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;color:#18181b">${escapeHtml(value)}</td></tr>`)
    .join('');
  if (options.fields) {
    const detailedSubject = `${options.enquiryType || 'Lead'} submitted: ${options.leadCode}`;
    const detailedHtml = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#fff"><div style="background:#0a0a0a;color:#fff;padding:20px 24px;font-size:18px;font-weight:700">Aditya Group CRM</div><div style="padding:24px;color:#18181b"><h2>Lead Submitted</h2><p>A ${escapeHtml(options.enquiryType || 'lead')} has been submitted and assigned.</p><table style="width:100%;border-collapse:collapse">${fieldRows}</table></div><div style="padding:14px 24px;background:#fafaf9;border-top:1px solid #e5e7eb;font-size:11px;color:#71717a;text-align:center">(c) 2026 Aditya Group. All Rights Reserved.</div></div>`;
    await sendMailWithFallback({ from, to: recipients.join(', '), subject: detailedSubject, html: detailedHtml });
    return;
  }
  const subject = `Complaint/Concern lead assigned: ${options.leadCode}`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#fff">
    <div style="background:#0a0a0a;color:#fff;padding:20px 24px;font-size:18px;font-weight:700">Aditya Group CRM</div>
    <div style="padding:24px;color:#18181b">
      <h2 style="margin:0 0 16px;font-size:20px">Complaint/Concern Lead Assigned</h2>
      <p style="margin:0 0 16px;color:#52525b">A complaint/concern enquiry has been assigned and requires attention.</p>
      <p style="margin:6px 0"><strong>Lead:</strong> ${options.leadCode}</p>
      <p style="margin:6px 0"><strong>Dealer:</strong> ${options.dealerName || '—'}</p>
      <p style="margin:6px 0"><strong>Department:</strong> ${options.department || '—'}</p>
      <p style="margin:6px 0"><strong>Assigned by:</strong> ${options.assignedBy}</p>
    </div>
    <div style="padding:14px 24px;background:#fafaf9;border-top:1px solid #e5e7eb;font-size:11px;color:#71717a;text-align:center">© 2026 Aditya Group. All Rights Reserved.</div>
  </div>`;
  await sendMailWithFallback({ from, to: recipients.join(', '), subject, html });
}

export async function sendComplaintEscalationEmail(options: {
  leadCode: string;
  recipients: string[];
  fields: Record<string, unknown>;
}) {
  const from = process.env.SMTP_FROM || `CRM <${process.env.SMTP_USER}>`;
  const recipients = [...new Set(options.recipients.map((email) => String(email || '').trim().toLowerCase()).filter(Boolean))];
  if (recipients.length === 0) return;
  const escapeHtml = (value: unknown) => String(value ?? '—')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  const rows = Object.entries(options.fields)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(([label, value]) => `<tr><td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;color:#71717a;width:38%">${escapeHtml(label)}</td><td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;color:#18181b">${escapeHtml(value)}</td></tr>`)
    .join('');
  const html = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#fff"><div style="background:#b91c1c;color:#fff;padding:20px 24px;font-size:18px;font-weight:700">Complaint / Concern Escalation</div><div style="padding:24px;color:#18181b"><p style="margin:0 0 16px;color:#52525b">This complaint/concern has remained open for at least two days and requires attention.</p><table style="width:100%;border-collapse:collapse">${rows}</table></div><div style="padding:14px 24px;background:#fafaf9;border-top:1px solid #e5e7eb;font-size:11px;color:#71717a;text-align:center">© 2026 Aditya Group. All Rights Reserved.</div></div>`;
  await sendMailWithFallback({
    from,
    to: recipients.join(', '),
    subject: `Open complaint/concern escalation: ${options.leadCode}`,
    html,
  });
}

export async function sendOpenEnquiryEscalationEmail(options: {
  leadCode: string;
  recipients: string[];
  fields: Record<string, unknown>;
}) {
  const from = process.env.SMTP_FROM || `CRM <${process.env.SMTP_USER}>`;
  const recipients = [...new Set(options.recipients.map((email) => String(email || '').trim().toLowerCase()).filter(Boolean))];
  if (recipients.length === 0) return;
  const escapeHtml = (value: unknown) => String(value ?? '—')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  const rows = Object.entries(options.fields)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(([label, value]) => `<tr><td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;color:#71717a;width:38%">${escapeHtml(label)}</td><td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;color:#18181b">${escapeHtml(value)}</td></tr>`)
    .join('');
  const html = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#fff"><div style="background:#b91c1c;color:#fff;padding:20px 24px;font-size:18px;font-weight:700">Open Enquiry Escalation</div><div style="padding:24px;color:#18181b"><p style="margin:0 0 16px;color:#52525b">This enquiry has remained open for more than 48 hours and requires attention.</p><table style="width:100%;border-collapse:collapse">${rows}</table></div><div style="padding:14px 24px;background:#fafaf9;border-top:1px solid #e5e7eb;font-size:11px;color:#71717a;text-align:center">© 2026 Aditya Group. All Rights Reserved.</div></div>`;
  await sendMailWithFallback({ from, to: recipients.join(', '), subject: `Open enquiry escalation (48 hours): ${options.leadCode}`, html });
}
