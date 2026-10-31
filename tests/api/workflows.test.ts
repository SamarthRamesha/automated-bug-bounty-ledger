import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  isAdmin: vi.fn((s) => s.roles.includes("ADMIN")),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    vulnerabilityReport: { findFirst: vi.fn(), findUnique: vi.fn() },
    bountyPayout: { findMany: vi.fn() },
    auditLog: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/evidence", async (original) => {
  const actual = await original<typeof import("@/lib/evidence")>();
  return { ...actual, evidenceCollection: vi.fn() };
});
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { evidenceCollection } from "@/lib/evidence";
import { POST as submit } from "@/app/api/reports/[reportId]/patches/route";
import { PATCH as review } from "@/app/api/reports/[reportId]/patches/[patchId]/review/route";
import { POST as payout } from "@/app/api/reports/[reportId]/payouts/route";
import { GET as detail } from "@/app/api/reports/[reportId]/route";
import { GET as ledger } from "@/app/api/payouts/route";
import {
  GET as evidenceGet,
  POST as evidencePost,
} from "@/app/api/reports/[reportId]/evidence/route";
const id = "11111111-1111-4111-8111-111111111111",
  patchId = "22222222-2222-4222-8222-222222222222";
const researcher = {
  userId: id,
  email: "researcher@test.local",
  roles: ["RESEARCHER"] as ("RESEARCHER" | "ADMIN")[],
};
const admin = { ...researcher, roles: ["ADMIN"] as ("RESEARCHER" | "ADMIN")[] };
const context = { params: Promise.resolve({ reportId: id, patchId }) };
const request = (input: unknown) =>
  new Request("http://localhost/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSession).mockResolvedValue(null);
});
describe("workflow API boundaries", () => {
  it.each([submit, review, payout])(
    "requires login for privileged mutations",
    async (route) => {
      expect((await route(request({}), context)).status).toBe(401);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );
  it.each([submit, review, payout])(
    "forbids researcher privileged mutations",
    async (route) => {
      vi.mocked(getSession).mockResolvedValue(researcher);
      expect((await route(request({}), context)).status).toBe(403);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );
  it("validates UUID, malformed JSON and review notes before writing", async () => {
    vi.mocked(getSession).mockResolvedValue(admin);
    expect(
      (
        await submit(request({}), {
          params: Promise.resolve({ reportId: "bad" }),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await submit(
          new Request("http://localhost", { method: "POST", body: "{" }),
          context,
        )
      ).status,
    ).toBe(400);
    expect(
      (await review(request({ decision: "REJECTED" }), context)).status,
    ).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it("validates monetary precision and refuses client recipient fields", async () => {
    vi.mocked(getSession).mockResolvedValue(admin);
    expect(
      (
        await payout(
          request({ amount: "1.005", currency: "INR", reference: "x" }),
          context,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await payout(
          request({
            amount: "1",
            currency: "INR",
            reference: "x",
            recipientId: id,
          }),
          context,
        )
      ).status,
    ).toBe(400);
  });
  it("returns 404 for another researcher's report before touching MongoDB", async () => {
    vi.mocked(getSession).mockResolvedValue(researcher);
    vi.mocked(prisma.vulnerabilityReport.findFirst).mockResolvedValue(null);
    expect((await detail(request({}), context)).status).toBe(404);
    expect((await evidenceGet(request({}), context)).status).toBe(404);
    expect(evidenceCollection).not.toHaveBeenCalled();
    expect(prisma.vulnerabilityReport.findFirst).toHaveBeenCalledWith({
      where: { id, reporterId: researcher.userId },
    });
  });
  it("scopes researcher payout history through report ownership", async () => {
    vi.mocked(getSession).mockResolvedValue(researcher);
    vi.mocked(prisma.bountyPayout.findMany).mockResolvedValue([]);
    expect((await ledger()).status).toBe(200);
    expect(prisma.bountyPayout.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { report: { reporterId: id } } }),
    );
  });
  it("returns safe database conflict and failure responses", async () => {
    vi.mocked(getSession).mockResolvedValue(admin);
    vi.mocked(prisma.$transaction).mockRejectedValueOnce({
      code: "P2002",
      message: "private database details",
    });
    const conflict = await payout(
      request({ amount: "1", currency: "INR", reference: "x" }),
      context,
    );
    expect(conflict.status).toBe(409);
    expect(await conflict.text()).not.toContain("private");
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(
      new Error("secret database internals"),
    );
    const failed = await submit(
      request({
        summary: "A sufficiently long summary",
        reference: "v1",
        patchedAt: "2026-01-01T00:00:00Z",
      }),
      context,
    );
    expect(failed.status).toBe(500);
    expect(await failed.text()).not.toContain("secret");
  });
  it("returns retryable MongoDB failure with a durable audit intent", async () => {
    vi.mocked(getSession).mockResolvedValue(researcher);
    vi.mocked(prisma.vulnerabilityReport.findFirst).mockResolvedValue({
      id,
    } as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);
    vi.mocked(evidenceCollection).mockRejectedValue(
      new Error("private connection URI"),
    );
    const response = await evidencePost(
      request({
        reproduction: {
          steps: ["Observe demo"],
          expectedBehavior: "Safe",
          observedBehavior: "Unsafe",
        },
        affectedComponents: ["search"],
        technicalMetadata: {},
      }),
      context,
    );
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private");
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "EVIDENCE_REQUESTED" }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "EVIDENCE_WRITE_FAILED" }),
      }),
    );
  });
});

it("maps nested adapter constraint errors to safe conflicts", async () => {
  vi.mocked(getSession).mockResolvedValue(admin);
  vi.mocked(prisma.$transaction).mockRejectedValueOnce({
    code: "P2010",
    meta: { driverAdapterError: { cause: { originalCode: "23514" } } },
  });
  expect(
    (
      await payout(
        request({ amount: "10", currency: "USD", reference: "nested" }),
        context,
      )
    ).status,
  ).toBe(409);
});

it("reports saved evidence with pending audit and reconciles on retry", async () => {
  vi.mocked(getSession).mockResolvedValue(researcher);
  vi.mocked(prisma.vulnerabilityReport.findFirst).mockResolvedValue({
    id,
  } as never);
  const operation = "33333333-3333-4333-8333-333333333333";
  const evidence = { _id: operation, reportId: id };
  const updateOne = vi.fn().mockResolvedValue({}),
    findOne = vi.fn().mockResolvedValue(evidence);
  vi.mocked(evidenceCollection).mockResolvedValue({
    updateOne,
    findOne,
  } as never);
  vi.mocked(prisma.auditLog.create)
    .mockResolvedValueOnce({} as never)
    .mockRejectedValueOnce(new Error("audit temporarily unavailable"));
  const payload = {
    reproduction: {
      steps: ["Local check"],
      expectedBehavior: "safe",
      observedBehavior: "unsafe",
    },
    affectedComponents: ["search"],
    technicalMetadata: {},
  };
  const req = () =>
    new Request("http://localhost", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": operation,
      },
      body: JSON.stringify(payload),
    });
  const first = await evidencePost(req(), context);
  expect(first.status).toBe(201);
  expect((await first.json()).data.auditPending).toBe(true);
  const { payloadHash } = await import("@/lib/evidence");
  vi.mocked(prisma.auditLog.create)
    .mockRejectedValueOnce({ code: "P2002" })
    .mockResolvedValueOnce({} as never);
  vi.mocked(prisma.auditLog.findUnique).mockResolvedValue({
    actorId: id,
    action: "EVIDENCE_REQUESTED",
    metadata: { reportId: id, payloadHash: payloadHash(payload) },
  } as never);
  const retry = await evidencePost(req(), context);
  expect(retry.status).toBe(201);
  expect((await retry.json()).data.auditPending).toBe(false);
  expect(updateOne).toHaveBeenCalledTimes(2);
  expect(updateOne).toHaveBeenCalledWith(
    { _id: operation },
    { $setOnInsert: expect.any(Object) },
    { upsert: true },
  );
});
