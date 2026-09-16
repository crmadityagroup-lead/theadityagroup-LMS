// Removes the retired operator role without deleting user history or lead ownership.
// Run without --apply to review the affected rows first.
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config({ override: true });

const db = new PrismaClient();
const legacy = await db.crmUser.findMany({
  where: { role: 'operator' },
  select: { id: true, name: true, email: true, active: true, dealerId: true },
  orderBy: { id: 'asc' },
});

console.log(`Found ${legacy.length} legacy operator user(s).`);
for (const user of legacy) console.log(`  ${user.id}: ${user.name} <${user.email}> active=${user.active} dealer=${user.dealerId ?? 'all'}`);

if (process.argv.includes('--apply') && legacy.length > 0) {
  await db.crmUser.updateMany({
    where: { role: 'operator' },
    data: { role: 'data_operator_1', active: false, recycledAt: new Date() },
  });
  console.log('Migrated legacy operators to inactive Data Operator 1 records. Review and restore only the accounts still needed.');
} else if (legacy.length > 0) {
  console.log('Dry run only. Re-run with --apply to remove the legacy role assignments.');
}

await db.$disconnect();
