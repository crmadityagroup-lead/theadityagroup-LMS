import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { sendGoogleFormConfirmationEmail } from '@/lib/mail';

export const runtime = 'nodejs';

const VIEW_ROLES = ['super_admin', 'admin', 'admin_2', 'data_operator_1', 'data_operator_2'];

function hasValidSecret(req: NextRequest) {
  const configured = process.env.FORM_SYNC_SECRET || '';
  const supplied = req.headers.get('authorization') || '';
  const expected = `Bearer ${configured}`;
  if (!configured || supplied.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

function toJsonAnswer(value: unknown): Prisma.InputJsonValue {
  if (Array.isArray(value)) return value.map((item) => String(item ?? '').slice(0, 10_000));
  return String(value ?? '').slice(0, 10_000);
}

function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export async function POST(req: NextRequest) {
  if (!hasValidSecret(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const raw = await req.text();
  if (raw.length > 256_000) return NextResponse.json({ error: 'Submission is too large' }, { status: 413 });

  let body: any;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const expectedFormId = process.env.GOOGLE_FORM_ID || '';
  const formId = String(body?.form_id || '').trim();
  if (!expectedFormId || formId !== expectedFormId) {
    return NextResponse.json({ error: 'This Google Form is not configured' }, { status: 403 });
  }

  const responses = body?.responses;
  if (!Array.isArray(responses) || responses.length < 1 || responses.length > 100) {
    return NextResponse.json({ error: 'Send between 1 and 100 responses per request' }, { status: 400 });
  }

  const upserts = [];
  let emailsSaved = 0;
  const notificationCandidates: Array<{ formId: string; responseId: string; email: string; answers: Array<{ question: string; answer: unknown }> }> = [];
  for (const response of responses) {
    const responseId = String(response?.response_id || '').trim();
    const submittedAt = new Date(String(response?.submitted_at || ''));
    const answers = response?.answers;

    if (!responseId || responseId.length > 300 || Number.isNaN(submittedAt.getTime())) {
      return NextResponse.json({ error: 'Invalid Google Form response metadata' }, { status: 400 });
    }
    if (!Array.isArray(answers) || answers.length > 200) {
      return NextResponse.json({ error: 'Invalid Google Form answer list' }, { status: 400 });
    }

    const emailAnswer = answers.find((answer: any) => {
      const value = Array.isArray(answer?.answer) ? answer.answer[0] : answer?.answer;
      return /\b(e-?mail|email address)\b/i.test(String(answer?.question || '')) && isValidEmail(String(value || ''));
    });
    const answerEmail = emailAnswer
      ? String(Array.isArray(emailAnswer.answer) ? emailAnswer.answer[0] : emailAnswer.answer).trim().toLowerCase()
      : '';
    const suppliedEmail = String(response?.respondent_email || '').trim().toLowerCase();
    const respondentEmail = isValidEmail(suppliedEmail) ? suppliedEmail : answerEmail;
    if (respondentEmail) emailsSaved += 1;

    const cleanedAnswers = answers.map((answer: any) => ({
      question: String(answer?.question || '').trim().slice(0, 500),
      answer: toJsonAnswer(answer?.answer),
    }));
    if (cleanedAnswers.some((answer: { question: string }) => !answer.question)) {
      return NextResponse.json({ error: 'Every answer must include its question title' }, { status: 400 });
    }

    upserts.push(db.crmGoogleFormResponse.upsert({
      where: { formId_responseId: { formId, responseId } },
      create: {
        formId,
        responseId,
        submittedAt,
        respondentEmail: respondentEmail || null,
        answers: cleanedAnswers as Prisma.InputJsonValue,
      },
      update: {
        submittedAt,
        // An older Form-bound Apps Script may resend the response without this
        // field. Keep an email already stored until the updated script backfills it.
        ...(respondentEmail ? { respondentEmail } : {}),
        answers: cleanedAnswers as Prisma.InputJsonValue,
      },
    }));
    if (body?.notify_submitters === true && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(respondentEmail)) {
      notificationCandidates.push({ formId, responseId, email: respondentEmail, answers: cleanedAnswers });
    }
  }

  await db.$transaction(upserts);
  let emailsSent = 0;
  let emailsFailed = 0;
  let emailsAlreadySent = 0;
  const missingRespondentEmail = body?.notify_submitters === true
    ? responses.filter((response: any) => {
      const supplied = String(response?.respondent_email || '').trim();
      const fromAnswer = (Array.isArray(response?.answers) ? response.answers : []).some((answer: any) => {
        const value = Array.isArray(answer?.answer) ? answer.answer[0] : answer?.answer;
        return /\b(e-?mail|email address)\b/i.test(String(answer?.question || '')) && isValidEmail(String(value || ''));
      });
      return !isValidEmail(supplied) && !fromAnswer;
    }).length
    : 0;
  for (const candidate of notificationCandidates) {
    const response = await db.crmGoogleFormResponse.findUnique({
      where: { formId_responseId: { formId: candidate.formId, responseId: candidate.responseId } },
      select: { id: true, emailSentAt: true },
    });
    if (!response) continue;
    if (response.emailSentAt) {
      emailsAlreadySent += 1;
      continue;
    }
    const claimed = await db.crmGoogleFormResponse.updateMany({
      where: { id: response.id, emailSentAt: null },
      data: { emailSentAt: new Date() },
    });
    if (!claimed.count) {
      emailsAlreadySent += 1;
      continue;
    }
    try {
      await sendGoogleFormConfirmationEmail({ email: candidate.email, answers: candidate.answers });
      emailsSent += 1;
    } catch (error) {
      await db.crmGoogleFormResponse.updateMany({ where: { id: response.id }, data: { emailSentAt: null } });
      emailsFailed += 1;
      console.error('[google-form] confirmation email failed', error);
    }
  }
  return NextResponse.json({
    ok: true,
    synced: upserts.length,
    emails_saved: emailsSaved,
    emails_sent: emailsSent,
    emails_failed: emailsFailed,
    emails_already_sent: emailsAlreadySent,
    email_recipients_missing: missingRespondentEmail,
  });
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!VIEW_ROLES.includes(user.role)) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });

  const limit = Math.min(Math.max(Number.parseInt(req.nextUrl.searchParams.get('limit') || '100', 10) || 100, 1), 500);
  const offset = Math.max(Number.parseInt(req.nextUrl.searchParams.get('offset') || '0', 10) || 0, 0);
  const [responses, total] = await Promise.all([
    db.crmGoogleFormResponse.findMany({ orderBy: { submittedAt: 'desc' }, take: limit, skip: offset }),
    db.crmGoogleFormResponse.count(),
  ]);
  return NextResponse.json({ responses, total, limit, offset });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!['super_admin', 'admin', 'admin_2'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const ids = Array.isArray(body?.ids) ? [...new Set(body.ids.map(Number).filter((id: number) => Number.isSafeInteger(id) && id > 0))] : [];
  if (!ids.length || ids.length > 100) {
    return NextResponse.json({ error: 'Select between 1 and 100 responses to delete' }, { status: 400 });
  }
  const result = await db.crmGoogleFormResponse.deleteMany({ where: { id: { in: ids } } });
  return NextResponse.json({ ok: true, deleted: result.count });
}
