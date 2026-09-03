const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const t = await prisma.taskBlocker.findMany({ include: { blockingTask: true, task: true }});
  console.log(JSON.stringify(t, null, 2));
}
main().finally(() => prisma.$disconnect());
