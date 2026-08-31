// Seeds enough demo data to show the system doing something real, per the brief's
// hosting requirement ("seeded with enough demo data ... not an empty shell").
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 10);

  const manager = await prisma.user.upsert({
    where: { email: "manager@demo.com" },
    update: {},
    create: { email: "manager@demo.com", name: "Morgan Manager", role: "MANAGER", passwordHash },
  });

  const alice = await prisma.user.upsert({
    where: { email: "alice@demo.com" },
    update: {},
    create: { email: "alice@demo.com", name: "Alice Member", role: "MEMBER", passwordHash },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@demo.com" },
    update: {},
    create: { email: "bob@demo.com", name: "Bob Member", role: "MEMBER", passwordHash },
  });

  const project = await prisma.project.upsert({
    where: { key: "ACME" },
    update: {},
    create: {
      key: "ACME",
      name: "Acme Corp Website Revamp",
      description: "Full redesign and rebuild of the Acme Corp marketing site.",
      ownerId: manager.id,
      members: {
        create: [{ userId: manager.id }, { userId: alice.id }, { userId: bob.id }],
      },
    },
  });

  const project2 = await prisma.project.upsert({
    where: { key: "PORT" },
    update: {},
    create: {
      key: "PORT",
      name: "Client Portal MVP",
      description: "Internal client-facing portal, phase 1.",
      ownerId: manager.id,
      members: { create: [{ userId: manager.id }, { userId: alice.id }] },
    },
  });

  const now = new Date();
  const inDays = (n) => new Date(now.getTime() + n * 86400000);

  const t1 = await prisma.task.create({
    data: {
      projectId: project.id,
      title: "Set up design system tokens",
      description: "Colors, spacing, typography scale.",
      priority: "HIGH",
      status: "DONE",
      dueDate: inDays(-10),
      dueDateUpdatedAt: now,
      assignees: { create: [{ userId: alice.id }] },
    },
  });

  const t2 = await prisma.task.create({
    data: {
      projectId: project.id,
      title: "Build homepage hero section",
      description: "Depends on design tokens.",
      priority: "HIGH",
      status: "IN_PROGRESS",
      dueDate: inDays(-2), // overdue on purpose, to populate alerts
      dueDateUpdatedAt: now,
      assignees: { create: [{ userId: bob.id }] },
      blockedBy: { create: [{ blockingTaskId: t1.id }] },
    },
  });

  await prisma.task.create({
    data: {
      projectId: project.id,
      title: "Write footer copy",
      priority: "LOW",
      status: "BACKLOG",
      dueDate: inDays(5),
      dueDateUpdatedAt: now,
    },
  });

  await prisma.task.create({
    data: {
      projectId: project.id,
      title: "QA pass on mobile breakpoints",
      priority: "MEDIUM",
      status: "IN_REVIEW",
      dueDate: inDays(3),
      dueDateUpdatedAt: now,
      assignees: { create: [{ userId: alice.id }, { userId: bob.id }] },
    },
  });

  await prisma.task.create({
    data: {
      projectId: project2.id,
      title: "Design login flow",
      priority: "URGENT",
      status: "BLOCKED",
      blockedFromStatus: "IN_PROGRESS",
      dueDate: inDays(1),
      dueDateUpdatedAt: now,
      assignees: { create: [{ userId: alice.id }] },
    },
  });

  // A couple of timeline events for demo richness.
  await prisma.taskEvent.create({
    data: { taskId: t1.id, userId: manager.id, type: "CREATED" },
  });
  await prisma.taskEvent.create({
    data: {
      taskId: t1.id,
      userId: alice.id,
      type: "STATUS_CHANGE",
      field: "status",
      oldValue: "IN_PROGRESS",
      newValue: "DONE",
    },
  });
  await prisma.taskEvent.create({
    data: { taskId: t2.id, userId: bob.id, type: "COMMENT", commentText: "Blocked until tokens ship." },
  });

  console.log("Seed complete.");
  console.log("Manager login: manager@demo.com / Password123!");
  console.log("Member logins: alice@demo.com / bob@demo.com / Password123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
