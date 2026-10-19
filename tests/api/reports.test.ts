import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  isAdmin: vi.fn((session) => session.roles.includes("ADMIN")),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    vulnerabilityReport: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GET, POST } from "@/app/api/reports/route";
import { PATCH } from "@/app/api/reports/[reportId]/status/route";

const researcher = {
  userId: "11111111-1111-4111-8111-111111111111",
  email: "researcher@example.com",
  roles: ["RESEARCHER"] as ("RESEARCHER" | "ADMIN")[],
};

const admin = {
  userId: "22222222-2222-4222-8222-222222222222",
  email: "admin@example.com",
  roles: ["ADMIN"] as ("RESEARCHER" | "ADMIN")[],
};

const reportId = "33333333-3333-4333-8333-333333333333";

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getSession).mockResolvedValue(null);
});

describe("Reports API authorization and validation", () => {
  it("returns 401 when a logged-out user lists reports", async () => {
    const response = await GET(new Request("http://localhost/api/reports"));

    expect(response.status).toBe(401);
    expect(prisma.vulnerabilityReport.findMany).not.toHaveBeenCalled();
  });

  it("returns 401 when a logged-out user submits a report", async () => {
    const response = await POST(
      jsonRequest("http://localhost/api/reports", {
        title: "SQL injection vulnerability",
      }),
    );

    expect(response.status).toBe(401);
    expect(prisma.vulnerabilityReport.create).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON on report submission", async () => {
    vi.mocked(getSession).mockResolvedValue(researcher);

    const response = await POST(
      new Request("http://localhost/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{invalid-json",
      }),
    );

    expect(response.status).toBe(400);
    expect(prisma.vulnerabilityReport.create).not.toHaveBeenCalled();
  });

  it("scopes researcher report listings to their own user ID", async () => {
    vi.mocked(getSession).mockResolvedValue(researcher);
    vi.mocked(prisma.vulnerabilityReport.findMany).mockResolvedValue([]);

    const response = await GET(new Request("http://localhost/api/reports"));

    expect(response.status).toBe(200);
    expect(prisma.vulnerabilityReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { reporterId: researcher.userId },
      }),
    );
  });

  it("returns 403 when a researcher tries to change a report status", async () => {
    vi.mocked(getSession).mockResolvedValue(researcher);

    const response = await PATCH(
      jsonRequest("http://localhost/api/reports/status", {
        status: "UNDER_REVIEW",
      }),
      { params: Promise.resolve({ reportId }) },
    );

    expect(response.status).toBe(403);
    expect(prisma.vulnerabilityReport.findUnique).not.toHaveBeenCalled();
    expect(prisma.vulnerabilityReport.updateMany).not.toHaveBeenCalled();
  });

  it("returns 409 when another request changes the report first", async () => {
    vi.mocked(getSession).mockResolvedValue(admin);

    vi.mocked(prisma.vulnerabilityReport.findUnique)
      .mockResolvedValueOnce({
        id: reportId,
        status: "SUBMITTED",
      } as never)
      .mockResolvedValueOnce({
        id: reportId,
      } as never);

    vi.mocked(prisma.vulnerabilityReport.updateMany).mockResolvedValue({
      count: 0,
    });

    const response = await PATCH(
      jsonRequest("http://localhost/api/reports/status", {
        status: "UNDER_REVIEW",
      }),
      { params: Promise.resolve({ reportId }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "CONCURRENT_UPDATE",
      },
    });

    expect(prisma.vulnerabilityReport.updateMany).toHaveBeenCalledWith({
      where: {
        id: reportId,
        status: "SUBMITTED",
      },
      data: {
        status: "UNDER_REVIEW",
        lastStatusChangedBy: admin.userId,
      },
    });
  });

  it("returns 400 when an admin submits an invalid report ID", async () => {
    vi.mocked(getSession).mockResolvedValue(admin);

    const response = await PATCH(
      jsonRequest("http://localhost/api/reports/status", {
        status: "UNDER_REVIEW",
      }),
      { params: Promise.resolve({ reportId: "not-a-uuid" }) },
    );

    expect(response.status).toBe(400);
    expect(prisma.vulnerabilityReport.findUnique).not.toHaveBeenCalled();
  });

  it("returns 404 when an admin updates a nonexistent report", async () => {
    vi.mocked(getSession).mockResolvedValue(admin);
    vi.mocked(prisma.vulnerabilityReport.findUnique).mockResolvedValue(null);

    const response = await PATCH(
      jsonRequest("http://localhost/api/reports/status", {
        status: "UNDER_REVIEW",
      }),
      { params: Promise.resolve({ reportId }) },
    );

    expect(response.status).toBe(404);
    expect(prisma.vulnerabilityReport.updateMany).not.toHaveBeenCalled();
  });

  it("returns 409 when an admin requests an invalid lifecycle transition", async () => {
    vi.mocked(getSession).mockResolvedValue(admin);
    vi.mocked(prisma.vulnerabilityReport.findUnique).mockResolvedValue({
      id: reportId,
      status: "SUBMITTED",
    } as never);

    const response = await PATCH(
      jsonRequest("http://localhost/api/reports/status", {
        status: "PATCHED",
      }),
      { params: Promise.resolve({ reportId }) },
    );

    expect(response.status).toBe(409);
    expect(prisma.vulnerabilityReport.updateMany).not.toHaveBeenCalled();
  });
});
