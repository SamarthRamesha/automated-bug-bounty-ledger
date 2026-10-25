import { describe, expect, it } from "vitest";
import { patchReviewSchema, patchSchema, payoutSchema } from "@/lib/validation";
import { evidenceSchema, payloadHash } from "@/lib/evidence";
describe("workflow validation", () => {
  it.each(["0", "-1", "1.001", "10000000000", "1e3", "NaN", "0.00", " 2 "])(
    "rejects invalid amount %s",
    (amount) => {
      expect(
        payoutSchema.safeParse({ amount, currency: "INR", reference: "PAY-1" })
          .success,
      ).toBe(false);
    },
  );
  it.each(["0.01", "9999999999.99", 2500, "20.50"])(
    "accepts exact valid decimal %s",
    (amount) => {
      expect(
        payoutSchema.parse({ amount, currency: "USD", reference: "PAY-1" })
          .amount,
      ).toBe(String(amount));
    },
  );
  it("rejects an untrusted recipient and unsupported currency", () => {
    expect(
      payoutSchema.safeParse({ amount: 1, currency: "EUR", reference: "x" })
        .success,
    ).toBe(false);
    expect(
      payoutSchema.safeParse({
        amount: 1,
        currency: "USD",
        reference: "x",
        recipientId: "untrusted",
      }).success,
    ).toBe(false);
  });
  it("requires a rejection reason and disallows arbitrary review fields", () => {
    expect(
      patchReviewSchema.safeParse({ decision: "REJECTED", note: " " }).success,
    ).toBe(false);
    expect(
      patchReviewSchema.safeParse({
        decision: "APPROVED",
        reviewedById: "untrusted",
      }).success,
    ).toBe(false);
    expect(
      patchReviewSchema.safeParse({
        decision: "REJECTED",
        note: "Regression remains",
      }).success,
    ).toBe(true);
  });
  it("requires meaningful patch metadata and a past date", () => {
    expect(
      patchSchema.safeParse({
        summary: "Fixed validation",
        reference: "v1",
        patchedAt: "2026-01-01T12:00:00Z",
      }).success,
    ).toBe(true);
    expect(
      patchSchema.safeParse({
        summary: "Fixed validation",
        reference: " ",
        patchedAt: "2099-01-01T12:00:00Z",
      }).success,
    ).toBe(false);
  });
  it("bounds evidence, deduplicates components, and canonicalizes retries", () => {
    const evidence = {
      reproduction: {
        steps: ["Open local demo"],
        expectedBehavior: "Escaped content",
        observedBehavior: "Unescaped content",
      },
      affectedComponents: ["search", "search"],
      technicalMetadata: { browser: "local" },
    };
    expect(evidenceSchema.parse(evidence).affectedComponents).toEqual([
      "search",
    ]);
    expect(
      evidenceSchema.safeParse({
        ...evidence,
        technicalMetadata: { secret: { nested: true } },
      }).success,
    ).toBe(false);
    expect(payloadHash({ a: 1, b: { x: 2, y: 3 } })).toBe(
      payloadHash({ b: { y: 3, x: 2 }, a: 1 }),
    );
  });
});
