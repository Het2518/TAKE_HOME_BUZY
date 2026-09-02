import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { requireAuth, withErrorHandling } from "@/lib/permissions";

// Build an HTML digest for a user's overdue assigned tasks.
function buildDigestHtml(user, tasks) {
  const rows = tasks
    .map(
      (t) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee">${t.project.key}</td>
        <td style="padding:8px;border-bottom:1px solid #eee"><strong>${t.title}</strong></td>
        <td style="padding:8px;border-bottom:1px solid #eee;color:#e53e3e">${
          t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"
        }</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${t.status.replace("_", " ")}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#2d3748">Overdue Task Digest</h2>
  <p>Hi ${user.name},</p>
  <p>You have <strong>${tasks.length}</strong> overdue task${tasks.length !== 1 ? "s" : ""} assigned to you:</p>
  <table style="width:100%;border-collapse:collapse">
    <thead>
      <tr style="background:#f7fafc">
        <th style="padding:8px;text-align:left">Project</th>
        <th style="padding:8px;text-align:left">Task</th>
        <th style="padding:8px;text-align:left">Due Date</th>
        <th style="padding:8px;text-align:left">Status</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="margin-top:24px;color:#718096;font-size:13px">
    This digest was sent by your Project Tracker. Log in to update task statuses.
  </p>
</body>
</html>`;
}

// GET /api/digest — returns the digest data (for preview in the browser)
export const GET = withErrorHandling(async () => {
  const session = await requireAuth();
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true },
  });

  const tasks = await prisma.task.findMany({
    where: {
      status: { not: "DONE" },
      dueDate: { lt: new Date() },
      assignees: { some: { userId: session.userId } },
    },
    include: { project: { select: { key: true, name: true } } },
    orderBy: { dueDate: "asc" },
  });

  return NextResponse.json({
    user,
    taskCount: tasks.length,
    tasks,
    html: buildDigestHtml(user, tasks),
  });
});

// POST /api/digest/send — actually sends the email via Nodemailer (SMTP)
// Requires these environment variables:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
// For Gmail: SMTP_HOST=smtp.gmail.com SMTP_PORT=587 SMTP_USER=your@gmail.com SMTP_PASS=<app-password>
export const POST = withErrorHandling(async () => {
  const session = await requireAuth();

  // Check SMTP config exists
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return NextResponse.json(
      {
        error:
          "SMTP not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM to your environment variables.",
        configured: false,
      },
      { status: 503 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true },
  });

  const tasks = await prisma.task.findMany({
    where: {
      status: { not: "DONE" },
      dueDate: { lt: new Date() },
      assignees: { some: { userId: session.userId } },
    },
    include: { project: { select: { key: true, name: true } } },
    orderBy: { dueDate: "asc" },
  });

  if (tasks.length === 0) {
    return NextResponse.json({ ok: true, message: "No overdue tasks — nothing to send." });
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT || "587", 10),
    secure: parseInt(SMTP_PORT || "587", 10) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  await transporter.sendMail({
    from: SMTP_FROM || SMTP_USER,
    to: user.email,
    subject: `[Project Tracker] ${tasks.length} overdue task${tasks.length !== 1 ? "s" : ""} assigned to you`,
    html: buildDigestHtml(user, tasks),
  });

  return NextResponse.json({ ok: true, sent: true, to: user.email, taskCount: tasks.length });
});


