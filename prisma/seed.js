// Seeds enough demo data to show the system doing something real, per the brief's
// hosting requirement ("seeded with enough demo data ... not an empty shell").
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 10);

  const usersData = [
    { email: "aarav@demo.com", name: "Aarav Sharma", role: "MANAGER" },
    { email: "vihaan@demo.com", name: "Vihaan Patel", role: "MEMBER" },
    { email: "aditya@demo.com", name: "Aditya Singh", role: "MEMBER" },
    { email: "sai@demo.com", name: "Sai Kumar", role: "MEMBER" },
    { email: "arjun@demo.com", name: "Arjun Reddy", role: "MANAGER" },
    { email: "reyansh@demo.com", name: "Reyansh Gupta", role: "MEMBER" },
    { email: "krishna@demo.com", name: "Krishna Iyer", role: "MEMBER" },
    { email: "ishaan@demo.com", name: "Ishaan Verma", role: "MEMBER" },
    { email: "ananya@demo.com", name: "Ananya Joshi", role: "MANAGER" },
    { email: "diya@demo.com", name: "Diya Rao", role: "MEMBER" },
    { email: "riya@demo.com", name: "Riya Nair", role: "MEMBER" },
    { email: "aadhya@demo.com", name: "Aadhya Desai", role: "MEMBER" },
    { email: "kavya@demo.com", name: "Kavya Menon", role: "MEMBER" },
    { email: "neha@demo.com", name: "Neha Kapoor", role: "MEMBER" },
    { email: "rohit@demo.com", name: "Rohit Mehra", role: "MANAGER" },
    { email: "siddharth@demo.com", name: "Siddharth Bhat", role: "MEMBER" }
  ];

  const dbUsers = {};
  for (const u of usersData) {
    dbUsers[u.email] = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash },
    });
  }

  // Map former variables to the newly created users to keep the rest of the script easy to read
  const manager = dbUsers["aarav@demo.com"];
  const alice = dbUsers["vihaan@demo.com"];
  const bob = dbUsers["aditya@demo.com"];

  const project1Members = [
    "aarav@demo.com", "vihaan@demo.com", "aditya@demo.com", "sai@demo.com",
    "arjun@demo.com", "reyansh@demo.com", "krishna@demo.com", "ishaan@demo.com"
  ];
  
  const project2Members = [
    "ananya@demo.com", "diya@demo.com", "riya@demo.com", "aadhya@demo.com",
    "rohit@demo.com", "kavya@demo.com", "neha@demo.com", "siddharth@demo.com"
  ];

  const project = await prisma.project.upsert({
    where: { key: "ACME" },
    update: {},
    create: {
      key: "ACME",
      name: "Acme Corp Website Revamp",
      description: "Full redesign and rebuild of the Acme Corp marketing site.",
      ownerId: manager.id,
      members: {
        create: project1Members.map(email => ({ userId: dbUsers[email].id })),
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
      ownerId: dbUsers["ananya@demo.com"].id,
      members: { 
        create: project2Members.map(email => ({ userId: dbUsers[email].id })) 
      },
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
      assignees: { create: [{ userId: bob.id }, { userId: dbUsers["sai@demo.com"].id }] },
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
      assignees: { create: [{ userId: dbUsers["ishaan@demo.com"].id }] }
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
      assignees: { create: [{ userId: alice.id }, { userId: bob.id }, { userId: dbUsers["arjun@demo.com"].id }] },
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
      assignees: { create: [{ userId: dbUsers["diya@demo.com"].id }, { userId: dbUsers["riya@demo.com"].id }] },
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
  console.log("Manager logins (e.g. aarav@demo.com, ananya@demo.com, arjun@demo.com) / Password123!");
  console.log("Member logins (e.g. vihaan@demo.com, aditya@demo.com, diya@demo.com) / Password123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
