import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1),
  // Deliberately no `role` field here. Self-service signup always creates a MEMBER —
  // see docs/decisions.md: "Manager accounts are provisioned (seeded or promoted by an
  // existing manager), never self-selected at signup, because letting any signup choose
  // MANAGER would defeat the entire point of role-based access control in goal 1."
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createProjectSchema = z.object({
  key: z.string().min(2).max(10).toUpperCase(),
  name: z.string().min(1),
  description: z.string().optional().default(""),
  ownerId: z.string().min(1),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  ownerId: z.string().optional(),
});

export const createTaskSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional().default(""),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional().default("MEDIUM"),
  dueDate: z.string().datetime().optional().nullable(),
  blockingTaskIds: z.array(z.string()).optional().default([]),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueDate: z.string().datetime().optional().nullable(),
  blockingTaskIds: z.array(z.string()).optional(),
});

export const statusChangeSchema = z.object({
  targetStatus: z.enum(["BACKLOG", "IN_PROGRESS", "IN_REVIEW", "DONE", "BLOCKED", "UNBLOCK"]),
});

export const bulkActionSchema = z.object({
  taskIds: z.array(z.string()).min(1),
  action: z.enum(["STATUS", "ASSIGNEE", "DUE_DATE"]),
  value: z.any(), // interpreted based on `action`
});

export const commentSchema = z.object({
  text: z.string().min(1),
});
