
import { describe, expect, it } from "vitest";
import {
  canTransitionStatus,
  loginSchema,
  reportSchema,
  statusSchema,
} from "../../src/lib/validation";

describe("Login input validation", () => {
  it("accepts valid credentials and normalizes the email", () => {
    const result = loginSchema.safeParse({
      email: "  RESEARCHER@example.com  ",
      password: "valid-password",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.email).toBe("researcher@example.com");
    }
  });

  it("rejects malformed emails and empty passwords", () => {
    expect(
      loginSchema.safeParse({ email: "not-an-email", password: "secret" }).success,
    ).toBe(false);

    expect(
      loginSchema.safeParse({ email: "user@example.com", password: "" }).success,
    ).toBe(false);
  });
});

describe("Vulnerability report validation", () => {
  const validReport = {
    title: "SQL injection in search",
    description:
      "The search endpoint may allow SQL injection through an unsanitized parameter.",
    affectedAsset: "https://example.com/search",
    severity: "HIGH",
  };

  it("accepts a valid report", () => {
    expect(reportSchema.safeParse(validReport).success).toBe(true);
  });

  it("rejects missing, short, or invalid fields", () => {
    expect(
      reportSchema.safeParse({ ...validReport, title: "Bug" }).success,
    ).toBe(false);

    expect(
      reportSchema.safeParse({ ...validReport, severity: "EXTREME" }).success,
    ).toBe(false);

    const missingDescription = {
        title: validReport.title,
        affectedAsset: validReport.affectedAsset,
        severity: validReport.severity,                        
        };
    expect(reportSchema.safeParse(missingDescription).success).toBe(false);
  });

  it("rejects unexpected fields", () => {
    expect(
      reportSchema.safeParse({ ...validReport, reporterId: "attacker-controlled" })
        .success,
    ).toBe(false);
  });

  it("trims whitespace around report text", () => {
    const result = reportSchema.safeParse({
      ...validReport,
      title: "  SQL injection in search  ",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.title).toBe("SQL injection in search");
    }
  });
});

describe("Status input validation", () => {
  it("accepts valid target statuses", () => {
    expect(statusSchema.safeParse({ status: "UNDER_REVIEW" }).success).toBe(true);
    expect(statusSchema.safeParse({ status: "PATCHED" }).success).toBe(true);
  });

  it("rejects unknown statuses and unexpected fields", () => {
    expect(statusSchema.safeParse({ status: "MAGICALLY_FIXED" }).success).toBe(
      false,
    );

    expect(
      statusSchema.safeParse({
        status: "PATCHED",
        changedBy: "attacker",
      }).success,
    ).toBe(false);
  });
});

describe("Report status lifecycle", () => {
  it("allows permitted transitions", () => {
    expect(canTransitionStatus("SUBMITTED", "UNDER_REVIEW")).toBe(true);
    expect(canTransitionStatus("SUBMITTED", "REJECTED")).toBe(true);
    expect(canTransitionStatus("UNDER_REVIEW", "ACCEPTED")).toBe(true);
    expect(canTransitionStatus("ACCEPTED", "REMEDIATING")).toBe(true);
    expect(canTransitionStatus("REMEDIATING", "PATCHED")).toBe(true);
    expect(canTransitionStatus("PATCHED", "CLOSED")).toBe(true);
  });

  it("rejects skipped stages and transitions from terminal states", () => {
    expect(canTransitionStatus("SUBMITTED", "ACCEPTED")).toBe(false);
    expect(canTransitionStatus("ACCEPTED", "PATCHED")).toBe(false);
    expect(canTransitionStatus("REJECTED", "UNDER_REVIEW")).toBe(false);
    expect(canTransitionStatus("CLOSED", "REMEDIATING")).toBe(false);
  });
});
