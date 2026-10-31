CREATE TYPE "PatchReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
ALTER TABLE patches
  ADD COLUMN review_status "PatchReviewStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN submitted_by_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  ADD COLUMN reviewed_by_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  ADD COLUMN reviewed_at TIMESTAMPTZ,
  ADD COLUMN review_note VARCHAR(500),
  ADD CONSTRAINT patch_review_complete CHECK (
    (review_status = 'PENDING' AND reviewed_by_id IS NULL AND reviewed_at IS NULL AND review_note IS NULL)
    OR (review_status <> 'PENDING' AND reviewed_by_id IS NOT NULL AND reviewed_at IS NOT NULL
        AND (review_status <> 'REJECTED' OR length(trim(review_note)) > 0) AND (review_status <> 'REJECTED' OR review_note IS NOT NULL)));

-- Locks are shared with the API transaction so SQL writers obey the same ordering.
CREATE FUNCTION guard_patch_write() RETURNS TRIGGER AS $$
DECLARE report_status "ReportStatus";
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Patch records are retained' USING ERRCODE = '23514';
  END IF;
  SELECT status INTO report_status FROM vulnerability_reports WHERE id = NEW.report_id FOR UPDATE;
  IF report_status IS DISTINCT FROM 'REMEDIATING' THEN
    RAISE EXCEPTION 'Patches require a report in remediation' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.review_status <> 'PENDING' OR NEW.submitted_by_id IS NULL THEN
      RAISE EXCEPTION 'New patches require a submitter and pending review' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF OLD.review_status <> 'PENDING' OR NEW.review_status = 'PENDING'
       OR (NEW.report_id, NEW.summary, NEW.reference, NEW.patched_at, NEW.submitted_by_id, NEW.created_at)
          IS DISTINCT FROM (OLD.report_id, OLD.summary, OLD.reference, OLD.patched_at, OLD.submitted_by_id, OLD.created_at) THEN
      RAISE EXCEPTION 'Only a pending patch review can be recorded' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF length(trim(NEW.reference)) = 0 THEN
    RAISE EXCEPTION 'Patch reference is required' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER patch_write_guard BEFORE INSERT OR UPDATE OR DELETE ON patches
FOR EACH ROW EXECUTE FUNCTION guard_patch_write();

CREATE FUNCTION require_approved_patch() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('PATCHED', 'CLOSED')
     AND NOT EXISTS (SELECT 1 FROM patches WHERE report_id = NEW.id AND review_status = 'APPROVED') THEN
    RAISE EXCEPTION 'An approved patch is required' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER report_patch_guard BEFORE UPDATE OF status ON vulnerability_reports
FOR EACH ROW EXECUTE FUNCTION require_approved_patch();

CREATE FUNCTION guard_payout_write() RETURNS TRIGGER AS $$
DECLARE report_status "ReportStatus";
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Payout records are immutable' USING ERRCODE = '23514';
  END IF;
  SELECT status INTO report_status FROM vulnerability_reports WHERE id = NEW.report_id FOR UPDATE;
  IF report_status IS DISTINCT FROM 'CLOSED'
     OR NOT EXISTS (SELECT 1 FROM patches WHERE report_id = NEW.report_id AND review_status = 'APPROVED') THEN
    RAISE EXCEPTION 'Payout requires a closed report with an approved patch' USING ERRCODE = '23514';
  END IF;
  IF NEW.currency NOT IN ('INR', 'USD') OR length(trim(NEW.reference)) = 0 THEN
    RAISE EXCEPTION 'Unsupported currency or blank reference' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER payout_write_guard BEFORE INSERT OR UPDATE OR DELETE ON bounty_payouts
FOR EACH ROW EXECUTE FUNCTION guard_payout_write();

CREATE FUNCTION audit_workflow_event() RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'vulnerability_reports' THEN
    INSERT INTO audit_logs(actor_id, action, entity_type, entity_id, metadata)
    VALUES (NEW.reporter_id, 'REPORT_SUBMITTED', 'VULNERABILITY_REPORT', NEW.id, jsonb_build_object('status', NEW.status));
  ELSIF TG_TABLE_NAME = 'patches' THEN
    INSERT INTO audit_logs(actor_id, action, entity_type, entity_id, metadata)
    VALUES (CASE WHEN TG_OP = 'INSERT' THEN NEW.submitted_by_id ELSE NEW.reviewed_by_id END,
      CASE WHEN TG_OP = 'INSERT' THEN 'PATCH_SUBMITTED' ELSE 'PATCH_REVIEWED' END, 'PATCH', NEW.id,
      jsonb_build_object('reportId', NEW.report_id, 'reviewStatus', NEW.review_status));
  ELSE
    INSERT INTO audit_logs(actor_id, action, entity_type, entity_id, metadata)
    VALUES (NEW.recorded_by_id, 'PAYOUT_RECORDED', 'BOUNTY_PAYOUT', NEW.id,
      jsonb_build_object('reportId', NEW.report_id, 'amount', NEW.amount::text, 'currency', NEW.currency));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER report_submission_audit AFTER INSERT ON vulnerability_reports FOR EACH ROW EXECUTE FUNCTION audit_workflow_event();
CREATE TRIGGER patch_audit AFTER INSERT OR UPDATE ON patches FOR EACH ROW EXECUTE FUNCTION audit_workflow_event();
CREATE TRIGGER payout_audit AFTER INSERT ON bounty_payouts FOR EACH ROW EXECUTE FUNCTION audit_workflow_event();

CREATE FUNCTION retain_audit_event() RETURNS TRIGGER AS $$
BEGIN RAISE EXCEPTION 'Audit records are append-only' USING ERRCODE = '23514'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER audit_retention BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION retain_audit_event();

CREATE OR REPLACE VIEW v_report_dashboard AS
SELECT r.status, r.severity, COUNT(*) AS report_count,
       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM patches p WHERE p.report_id = r.id AND p.review_status = 'APPROVED')) AS patched_report_count
FROM vulnerability_reports r GROUP BY r.status, r.severity;
CREATE OR REPLACE VIEW v_payout_ledger AS
SELECT p.id, p.report_id, r.title AS report_title, p.amount, p.currency, p.reference, p.recorded_at,
       u.display_name AS recorded_by, owner.id AS researcher_id, owner.display_name AS researcher
FROM bounty_payouts p
JOIN vulnerability_reports r ON r.id = p.report_id
JOIN users u ON u.id = p.recorded_by_id
JOIN users owner ON owner.id = r.reporter_id;
