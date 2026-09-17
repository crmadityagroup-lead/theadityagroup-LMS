import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const file = (await request.formData()).get('avatar');
  if (!(file instanceof File) || !ALLOWED_TYPES.has(file.type) || file.size === 0 || file.size > MAX_AVATAR_SIZE) {
    return NextResponse.json({ error: 'Upload a JPG, PNG, or WebP image smaller than 2 MB.' }, { status: 400 });
  }
  const avatarData = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString('base64')}`;
  await db.$executeRaw(Prisma.sql`UPDATE crm_users SET avatar_data = ${avatarData} WHERE id = ${user.id}`);
  return NextResponse.json({ avatar_data: avatarData });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  await db.$executeRaw(Prisma.sql`UPDATE crm_users SET avatar_data = NULL WHERE id = ${user.id}`);
  return NextResponse.json({ avatar_data: null });
}
