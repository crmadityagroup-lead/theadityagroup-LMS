import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const users = await db.crmUser.findMany({
  where: { email: { startsWith: 'dummy.', endsWith: '@test.invalid' } },
  select: { id: true, email: true },
});
for (const user of users) {
  await db.crmUserEnquiryType.deleteMany({ where: { userId: user.id } });
  await db.crmLoginHistory.deleteMany({ where: { userId: user.id } });
  await db.crmLeadActivity.updateMany({ where: { userId: user.id }, data: { userId: null } });
  await db.crmUser.delete({ where: { id: user.id } });
  console.log(`Removed ${user.email}`);
}
await db.$disconnect();
