import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(255)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});

export const reportSchema = z
  .object({
    title: z.string().trim().min(8).max(200),
    description: z.string().trim().min(20).max(10000),
    affectedAsset: z.string().trim().min(1).max(255),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  })
  .strict();

export const statusSchema = z
  .object({
    status: z.enum([
      "UNDER_REVIEW",
      "ACCEPTED",
      "REJECTED",
      "REMEDIATING",
      "PATCHED",
      "CLOSED",
    ]),
  })
  .strict();

export const reportIdSchema = z
  .string()
  .uuid()
  .transform((value) => value.toLowerCase());

export const statusTransitions = {
  SUBMITTED: ["UNDER_REVIEW", "REJECTED"],
  UNDER_REVIEW: ["ACCEPTED", "REJECTED"],
  ACCEPTED: ["REMEDIATING"],
  REJECTED: [],
  REMEDIATING: ["PATCHED"],
  PATCHED: ["CLOSED"],
  CLOSED: [],
} as const;

export type LifecycleStatus = keyof typeof statusTransitions;

export function canTransitionStatus(
  current: LifecycleStatus,
  next: LifecycleStatus,
): boolean {
  return (statusTransitions[current] as readonly string[]).includes(next);
}

export const patchSchema = z
  .object({
    summary: z.string().trim().min(10).max(10000),
    reference: z.string().trim().min(1).max(255),
    patchedAt: z.iso
      .datetime({ offset: true })
      .refine(
        (value) => Date.parse(value) <= Date.now(),
        "Patch date cannot be in the future.",
      ),
  })
  .strict();
export const patchReviewSchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    note: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine((value) => value.decision !== "REJECTED" || !!value.note, {
    message: "A rejection note is required.",
    path: ["note"],
  });
// Convert JSON numbers to their decimal spelling, then validate before Prisma Decimal.
export const payoutSchema = z
  .object({
    amount: z
      .union([z.string(), z.number()])
      .transform(String)
      .refine(
        (value) =>
          /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value) &&
          /[1-9]/.test(value),
        "Use a positive amount with at most two decimal places and ten integer digits.",
      ),
    currency: z.enum(["INR", "USD"]),
    reference: z.string().trim().min(1).max(100),
  })
  .strict();
