CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE "RoleName" AS ENUM ('RESEARCHER', 'ADMIN');
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "ReportStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'REMEDIATING', 'PATCHED', 'CLOSED');

CREATE TABLE "users" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" VARCHAR(255) NOT NULL UNIQUE,
  "display_name" VARCHAR(120) NOT NULL,
  "password_hash" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_email_not_blank" CHECK (length(trim("email")) > 3)
);

CREATE TABLE "roles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" "RoleName" NOT NULL UNIQUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "user_roles" (
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role_id" UUID NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("user_id", "role_id")
);

CREATE TABLE "vulnerability_reports" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" VARCHAR(200) NOT NULL,
  "description" TEXT NOT NULL,
  "affected_asset" VARCHAR(255) NOT NULL,
  "severity" "Severity" NOT NULL DEFAULT 'MEDIUM',
  "status" "ReportStatus" NOT NULL DEFAULT 'SUBMITTED',
  "reporter_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "assigned_admin_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "last_status_changed_by" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reports_title_not_blank" CHECK (length(trim("title")) >= 8),
  CONSTRAINT "reports_description_not_blank" CHECK (length(trim("description")) >= 20),
  CONSTRAINT "reports_affected_asset_not_blank" CHECK (length(trim("affected_asset")) > 0)
);

CREATE TABLE "report_status_history" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "report_id" UUID NOT NULL REFERENCES "vulnerability_reports"("id") ON DELETE CASCADE,
  "from_status" "ReportStatus",
  "to_status" "ReportStatus" NOT NULL,
  "changed_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "note" VARCHAR(500),
  "changed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "history_real_change" CHECK ("from_status" IS NULL OR "from_status" <> "to_status")
);

CREATE TABLE "patches" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "report_id" UUID NOT NULL REFERENCES "vulnerability_reports"("id") ON DELETE CASCADE,
  "summary" TEXT NOT NULL,
  "reference" VARCHAR(255) NOT NULL,
  "patched_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "patch_summary_not_blank" CHECK (length(trim("summary")) >= 10),
  UNIQUE ("report_id", "reference")
);

CREATE TABLE "bounty_payouts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "report_id" UUID NOT NULL UNIQUE REFERENCES "vulnerability_reports"("id") ON DELETE RESTRICT,
  "amount" NUMERIC(12, 2) NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'INR',
  "reference" VARCHAR(100) NOT NULL UNIQUE,
  "recorded_by_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payout_positive_amount" CHECK ("amount" > 0),
  CONSTRAINT "payout_currency_format" CHECK ("currency" ~ '^[A-Z]{3}$')
);

CREATE TABLE "audit_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "actor_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "action" VARCHAR(100) NOT NULL,
  "entity_type" VARCHAR(50) NOT NULL,
  "entity_id" UUID NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "reports_owner_status_idx" ON "vulnerability_reports" ("reporter_id", "status");
CREATE INDEX "reports_status_severity_created_idx" ON "vulnerability_reports" ("status", "severity", "created_at" DESC);
CREATE INDEX "reports_search_idx" ON "vulnerability_reports" USING GIN (to_tsvector('english', "title" || ' ' || "description"));
CREATE INDEX "history_report_changed_idx" ON "report_status_history" ("report_id", "changed_at" DESC);
CREATE INDEX "patches_report_patched_idx" ON "patches" ("report_id", "patched_at" DESC);
CREATE INDEX "payouts_recorded_idx" ON "bounty_payouts" ("recorded_at" DESC);
CREATE INDEX "audit_entity_created_idx" ON "audit_logs" ("entity_type", "entity_id", "created_at" DESC);

CREATE OR REPLACE FUNCTION validate_report_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."status" = OLD."status" THEN RETURN NEW; END IF;
  IF (OLD."status" = 'SUBMITTED' AND NEW."status" IN ('UNDER_REVIEW', 'REJECTED'))
     OR (OLD."status" = 'UNDER_REVIEW' AND NEW."status" IN ('ACCEPTED', 'REJECTED'))
     OR (OLD."status" = 'ACCEPTED' AND NEW."status" = 'REMEDIATING')
     OR (OLD."status" = 'REMEDIATING' AND NEW."status" = 'PATCHED')
     OR (OLD."status" = 'PATCHED' AND NEW."status" = 'CLOSED') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Invalid report status transition from % to %', OLD."status", NEW."status" USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION record_report_status_history()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO "report_status_history" ("report_id", "from_status", "to_status", "changed_by_id")
    VALUES (NEW."id", NULL, NEW."status", NEW."reporter_id");
  ELSIF OLD."status" IS DISTINCT FROM NEW."status" THEN
    INSERT INTO "report_status_history" ("report_id", "from_status", "to_status", "changed_by_id")
    VALUES (NEW."id", OLD."status", NEW."status", NEW."last_status_changed_by");
    INSERT INTO "audit_logs" ("actor_id", "action", "entity_type", "entity_id", "metadata")
    VALUES (NEW."last_status_changed_by", 'REPORT_STATUS_CHANGED', 'VULNERABILITY_REPORT', NEW."id",
      jsonb_build_object('fromStatus', OLD."status", 'toStatus', NEW."status"));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "report_status_transition_guard"
BEFORE UPDATE OF "status" ON "vulnerability_reports"
FOR EACH ROW EXECUTE FUNCTION validate_report_status_transition();

CREATE TRIGGER "report_status_history_audit"
AFTER INSERT OR UPDATE OF "status" ON "vulnerability_reports"
FOR EACH ROW EXECUTE FUNCTION record_report_status_history();

CREATE VIEW "v_report_dashboard" AS
SELECT r."status", r."severity", COUNT(*) AS "report_count",
       COUNT(*) FILTER (WHERE p."id" IS NOT NULL) AS "patched_report_count"
FROM "vulnerability_reports" r
LEFT JOIN "patches" p ON p."report_id" = r."id"
GROUP BY r."status", r."severity";

CREATE VIEW "v_payout_ledger" AS
SELECT p."id", p."report_id", r."title" AS "report_title", p."amount", p."currency",
       p."reference", p."recorded_at", u."display_name" AS "recorded_by"
FROM "bounty_payouts" p
JOIN "vulnerability_reports" r ON r."id" = p."report_id"
JOIN "users" u ON u."id" = p."recorded_by_id";
