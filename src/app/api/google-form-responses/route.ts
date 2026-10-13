import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

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
        answers: cleanedAnswers as Prisma.InputJsonValue,
      },
      update: {
        submittedAt,
        answers: cleanedAnswers as Prisma.InputJsonValue,
      },
    }));
  }

  await db.$transaction(upserts);
  return NextResponse.json({ ok: true, synced: upserts.length });
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
