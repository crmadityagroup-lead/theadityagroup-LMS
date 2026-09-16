// Find users by role for testing.
// Usage: node scripts/find-user.mjs <role>
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config({ override: true });

const db = new PrismaClient();
const role = process.argv[2] || 'department_user';

const users = await db.crmUser.findMany({
  where: { role, active: true, recycledAt: null },
  select: { id: true, name: true, email: true, role: true, dealerId: true, department: true },
  take: 1,
});
console.log(JSON.stringify(users[0] || {}));
await db.$disconnect();
