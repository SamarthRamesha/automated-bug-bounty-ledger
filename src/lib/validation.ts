
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});

export const reportSchema = z.object({
  title: z.string().trim().min(8).max(200),
  description: z.string().trim().min(20).max(10000),
  affectedAsset: z.string().trim().min(1).max(255),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
}).strict();

export const statusSchema = z.object({
  status: z.enum([
    "UNDER_REVIEW",
    "ACCEPTED",
    "REJECTED",
    "REMEDIATING",
    "PATCHED",
    "CLOSED",
  ]),
}).strict();

export const reportIdSchema = z.string().uuid();

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
