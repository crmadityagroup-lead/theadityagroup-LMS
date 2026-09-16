// DB helper for testing — queries Supabase Postgres directly via Prisma.
// Usage: node scripts/get-otp.mjs <email>
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config({ override: true });

const db = new PrismaClient();
const email = process.argv[2];
if (!email) { console.error('Usage: node scripts/get-otp.mjs <email>'); process.exit(1); }

const otp = await db.crmOtpCode.findFirst({
  where: { email, used: false, expiresAt: { gt: new Date() } },
  orderBy: { id: 'desc' },
  select: { code: true },
});
console.log(otp?.code || 'NONE');
await db.$disconnect();
