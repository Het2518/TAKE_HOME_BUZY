import { prisma } from "./prisma";

// Every mutation that should show up in a task's timeline goes through this one function.
// Centralizing writes here is what makes "nothing in the timeline can ever be edited or
// deleted" (goal 9) easy to guarantee — there is exactly one code path that inserts rows,
// and it is never called from an UPDATE or DELETE handler.
export async function writeTaskEvent({ taskId, userId, type, field, oldValue, newValue, commentText }, tx = prisma) {
  return tx.taskEvent.create({
    data: {
      taskId,
      userId,
      type,
      field: field ?? null,
      oldValue: oldValue != null ? String(oldValue) : null,
      newValue: newValue != null ? String(newValue) : null,
      commentText: commentText ?? null,
    },
  });
}
