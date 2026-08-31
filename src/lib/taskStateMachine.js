// The task lifecycle rules, in one place, as pure functions.
// Both the API route (to reject illegal moves) and the frontend (to only render legal
// buttons) call getLegalTransitions() so the rule can never drift out of sync between them.
// See docs/decisions.md for why this was centralized instead of duplicated.

export const STATUSES = ["BACKLOG", "IN_PROGRESS", "IN_REVIEW", "DONE", "BLOCKED"];

// Normal forward/back moves, independent of blocking rules.
const BASE_TRANSITIONS = {
  BACKLOG: ["IN_PROGRESS"],
  IN_PROGRESS: ["IN_REVIEW", "BLOCKED"],
  IN_REVIEW: ["DONE", "IN_PROGRESS", "BLOCKED"], // IN_REVIEW -> IN_PROGRESS allows sending work back
  DONE: ["IN_PROGRESS"], // reopening a finished task
  BLOCKED: [], // BLOCKED only ever exits via explicit "unblock", not a normal transition
};

/**
 * Returns the list of statuses `currentStatus` may legally move to right now.
 * @param {string} currentStatus
 * @param {boolean} hasIncompleteBlockers - true if any blocking task is not yet DONE
 * @param {string|null} blockedFromStatus - only relevant when currentStatus === "BLOCKED"
 */
export function getLegalTransitions(currentStatus, hasIncompleteBlockers, blockedFromStatus) {
  if (currentStatus === "BLOCKED") {
    // Unblocking is the only legal move, and it returns to the stored prior status.
    return blockedFromStatus ? [`UNBLOCK_TO_${blockedFromStatus}`] : [];
  }

  let legal = [...(BASE_TRANSITIONS[currentStatus] || [])];

  // A task with an unfinished blocker can never reach DONE — filtered out here so the
  // UI and the API agree on what's legal without duplicating this check.
  if (hasIncompleteBlockers) {
    legal = legal.filter((s) => s !== "DONE");
  }

  return legal;
}

/**
 * Validates a requested transition. Returns { ok: true } or { ok: false, reason }.
 * This is the function the API route calls before writing anything to the DB.
 */
/**
 * STRETCH GOAL: cycle detection for the blocking graph.
 * Given the full set of existing TaskBlocker edges (as [taskId, blockingTaskId] pairs) plus
 * a proposed new edge, returns true if adding that edge would create a cycle — i.e. task A
 * blocking task B, which (through some chain) already blocks task A.
 * Implemented as a DFS from the proposed blockingTaskId, walking "what blocks this" edges,
 * checking whether we ever reach back to taskId.
 */
export function wouldCreateCycle(existingEdges, newTaskId, newBlockingTaskId) {
  if (newTaskId === newBlockingTaskId) return true; // a task can't block itself

  // Build adjacency: for a given task, which tasks does it block (i.e. task -> tasks that depend on it)?
  const blocksMap = new Map(); // blockingTaskId -> [taskId, taskId, ...]
  for (const [taskId, blockingTaskId] of existingEdges) {
    if (!blocksMap.has(blockingTaskId)) blocksMap.set(blockingTaskId, []);
    blocksMap.get(blockingTaskId).push(taskId);
  }
  // Also include the proposed edge itself in the graph we're checking.
  if (!blocksMap.has(newBlockingTaskId)) blocksMap.set(newBlockingTaskId, []);
  blocksMap.get(newBlockingTaskId).push(newTaskId);

  // DFS from newTaskId: if we can walk forward through "blocks" edges and reach
  // newBlockingTaskId, then newBlockingTaskId depends (transitively) on newTaskId,
  // and making newBlockingTaskId a blocker of newTaskId would close a cycle.
  const visited = new Set();
  const stack = [...(blocksMap.get(newTaskId) || [])];
  while (stack.length) {
    const current = stack.pop();
    if (current === newBlockingTaskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    stack.push(...(blocksMap.get(current) || []));
  }
  return false;
}

export function validateTransition(currentStatus, targetStatus, hasIncompleteBlockers, blockedFromStatus) {
  if (targetStatus === currentStatus) {
    return { ok: false, reason: "Task is already in that status" };
  }

  if (currentStatus === "BLOCKED") {
    if (targetStatus !== "UNBLOCK") {
      return { ok: false, reason: "A blocked task can only be unblocked, not moved directly" };
    }
    if (!blockedFromStatus) {
      return { ok: false, reason: "No prior status recorded to unblock into" };
    }
    return { ok: true, resolvedStatus: blockedFromStatus };
  }

  if (targetStatus === "BLOCKED") {
    if (!["IN_PROGRESS", "IN_REVIEW"].includes(currentStatus)) {
      return { ok: false, reason: "A task can only be blocked from In Progress or In Review" };
    }
    return { ok: true, resolvedStatus: "BLOCKED", blockedFromStatus: currentStatus };
  }

  const legal = BASE_TRANSITIONS[currentStatus] || [];
  if (!legal.includes(targetStatus)) {
    return {
      ok: false,
      reason: `Cannot move from ${currentStatus} to ${targetStatus} — that is not a legal transition`,
    };
  }

  if (targetStatus === "DONE" && hasIncompleteBlockers) {
    return {
      ok: false,
      reason: "Cannot move to Done while a blocking task is not yet Done",
    };
  }

  return { ok: true, resolvedStatus: targetStatus };
}
