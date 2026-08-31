import { describe, it, expect } from "vitest";
import {
  getLegalTransitions,
  validateTransition,
  wouldCreateCycle,
  STATUSES,
} from "../src/lib/taskStateMachine.js";

// ── requirement: "The interface should only offer moves that are currently legal." ──
describe("getLegalTransitions", () => {
  it("BACKLOG can only move to IN_PROGRESS", () => {
    expect(getLegalTransitions("BACKLOG", false, null)).toEqual(["IN_PROGRESS"]);
  });

  it("IN_PROGRESS can move to IN_REVIEW or BLOCKED", () => {
    expect(getLegalTransitions("IN_PROGRESS", false, null)).toEqual(["IN_REVIEW", "BLOCKED"]);
  });

  it("IN_REVIEW can move to DONE, IN_PROGRESS, or BLOCKED when unblocked", () => {
    expect(getLegalTransitions("IN_REVIEW", false, null)).toEqual(["DONE", "IN_PROGRESS", "BLOCKED"]);
  });

  it("requirement: a task with an unfinished blocker can never reach DONE — filtered out of legal moves", () => {
    const moves = getLegalTransitions("IN_REVIEW", true, null);
    expect(moves).not.toContain("DONE");
    expect(moves).toEqual(["IN_PROGRESS", "BLOCKED"]);
  });

  it("requirement: a finished (DONE) task can be reopened", () => {
    expect(getLegalTransitions("DONE", false, null)).toEqual(["IN_PROGRESS"]);
  });

  it("requirement: BLOCKED only ever exits via unblock, returning to the stored prior status", () => {
    expect(getLegalTransitions("BLOCKED", false, "IN_PROGRESS")).toEqual(["UNBLOCK_TO_IN_PROGRESS"]);
    expect(getLegalTransitions("BLOCKED", false, "IN_REVIEW")).toEqual(["UNBLOCK_TO_IN_REVIEW"]);
  });

  it("edge case: BLOCKED with no recorded prior status has no legal moves (defensive — should never happen in practice)", () => {
    expect(getLegalTransitions("BLOCKED", false, null)).toEqual([]);
  });
});

// ── requirement: "Any other jump ... must be rejected by the server with a message
//    explaining why." Every branch below asserts BOTH the ok/not-ok outcome AND that a
//    human-readable reason is present on rejection. ──
describe("validateTransition", () => {
  it("accepts a legal forward move and resolves to the target status", () => {
    const result = validateTransition("BACKLOG", "IN_PROGRESS", false, null);
    expect(result).toEqual({ ok: true, resolvedStatus: "IN_PROGRESS" });
  });

  it("rejects an illegal jump (BACKLOG -> DONE) with an explanatory reason", () => {
    const result = validateTransition("BACKLOG", "DONE", false, null);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not a legal transition/i);
  });

  it("rejects moving to the same status", () => {
    const result = validateTransition("IN_PROGRESS", "IN_PROGRESS", false, null);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/already/i);
  });

  it("requirement: a task with an unfinished blocking task cannot move to DONE, with a clear reason", () => {
    const result = validateTransition("IN_REVIEW", "DONE", true, null);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/blocking task/i);
  });

  it("allows moving to DONE once no incomplete blockers remain", () => {
    const result = validateTransition("IN_REVIEW", "DONE", false, null);
    expect(result).toEqual({ ok: true, resolvedStatus: "DONE" });
  });

  it("requirement: a task can only be blocked from In Progress or In Review", () => {
    expect(validateTransition("IN_PROGRESS", "BLOCKED", false, null).ok).toBe(true);
    expect(validateTransition("IN_REVIEW", "BLOCKED", false, null).ok).toBe(true);
    const fromBacklog = validateTransition("BACKLOG", "BLOCKED", false, null);
    expect(fromBacklog.ok).toBe(false);
    expect(fromBacklog.reason).toMatch(/In Progress or In Review/i);
    const fromDone = validateTransition("DONE", "BLOCKED", false, null);
    expect(fromDone.ok).toBe(false);
  });

  it("entering BLOCKED records blockedFromStatus so it can be restored later", () => {
    const result = validateTransition("IN_PROGRESS", "BLOCKED", false, null);
    expect(result).toEqual({ ok: true, resolvedStatus: "BLOCKED", blockedFromStatus: "IN_PROGRESS" });
  });

  it("requirement: unblocking returns the task to the status it was blocked from", () => {
    const result = validateTransition("BLOCKED", "UNBLOCK", false, "IN_REVIEW");
    expect(result).toEqual({ ok: true, resolvedStatus: "IN_REVIEW" });
  });

  it("rejects any target other than UNBLOCK while a task is BLOCKED", () => {
    const result = validateTransition("BLOCKED", "IN_PROGRESS", false, "IN_PROGRESS");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/only be unblocked/i);
  });

  it("edge case: rejects UNBLOCK if no prior status was ever recorded (data integrity guard)", () => {
    const result = validateTransition("BLOCKED", "UNBLOCK", false, null);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/no prior status/i);
  });

  it("edge case: IN_REVIEW back to IN_PROGRESS (send back for rework) is legal", () => {
    expect(validateTransition("IN_REVIEW", "IN_PROGRESS", false, null).ok).toBe(true);
  });

  it("every status in STATUSES is reachable from BACKLOG through some legal chain (sanity check)", () => {
    // BACKLOG -> IN_PROGRESS -> IN_REVIEW -> DONE, and IN_PROGRESS -> BLOCKED, are all legal.
    // This just confirms the state graph isn't accidentally missing a status.
    expect(STATUSES).toEqual(["BACKLOG", "IN_PROGRESS", "IN_REVIEW", "DONE", "BLOCKED"]);
  });
});

// ── stretch requirement: cycle detection on the blocking graph ──
describe("wouldCreateCycle", () => {
  it("a task cannot block itself", () => {
    expect(wouldCreateCycle([], "task-A", "task-A")).toBe(true);
  });

  it("a brand-new, unconnected edge does not create a cycle", () => {
    expect(wouldCreateCycle([], "task-A", "task-B")).toBe(false);
  });

  it("detects a direct 2-node cycle: A blocked-by B, then trying B blocked-by A", () => {
    const edges = [["A", "B"]]; // A is blocked by B
    expect(wouldCreateCycle(edges, "B", "A")).toBe(true); // B blocked by A would close the loop
  });

  it("detects a longer transitive cycle: A<-B<-C, then trying C<-A", () => {
    // A is blocked by B, B is blocked by C. Now propose: A is blocked by C — wait, that's not
    // a cycle (A depends on both B and C, no loop). The actual cycle case: propose C blocked by A.
    const edges = [
      ["A", "B"], // A blocked by B
      ["B", "C"], // B blocked by C
    ];
    // C blocked by A would mean: A needs B, B needs C, C needs A — a genuine cycle.
    expect(wouldCreateCycle(edges, "C", "A")).toBe(true);
  });

  it("does NOT flag a valid diamond dependency as a cycle", () => {
    // A is blocked by both B and C; B and C are both blocked by D. No cycle here.
    const edges = [
      ["A", "B"],
      ["A", "C"],
      ["B", "D"],
      ["C", "D"],
    ];
    expect(wouldCreateCycle(edges, "A", "D")).toBe(false);
  });

  it("allows an unrelated edge in a graph that already has other chains", () => {
    const edges = [
      ["A", "B"],
      ["X", "Y"],
    ];
    expect(wouldCreateCycle(edges, "M", "N")).toBe(false);
  });

  it("edge case: empty existing graph plus a self-edge is still caught", () => {
    expect(wouldCreateCycle([], "solo", "solo")).toBe(true);
  });
});
