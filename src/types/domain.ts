export const reportStatuses = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "ACCEPTED",
  "REJECTED",
  "REMEDIATING",
  "PATCHED",
  "CLOSED"
] as const;

export type ReportStatus = (typeof reportStatuses)[number];

export const severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type Severity = (typeof severities)[number];

export type UserRole = "RESEARCHER" | "ADMIN";
