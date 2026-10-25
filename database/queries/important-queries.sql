-- Search reports using PostgreSQL full-text search.
SELECT id, title, severity, status
FROM vulnerability_reports
WHERE to_tsvector('english', title || ' ' || description) @@ plainto_tsquery('english', :'search_term')
ORDER BY created_at DESC;

-- Aggregate reports by severity; HAVING excludes insignificant groups.
SELECT severity, COUNT(*) AS total_reports
FROM vulnerability_reports
GROUP BY severity
HAVING COUNT(*) >= 1
ORDER BY total_reports DESC, severity;

-- Join reports to their reporter and find reports that have no payout yet.
SELECT r.id, r.title, u.display_name AS researcher, r.status
FROM vulnerability_reports r
JOIN users u ON u.id = r.reporter_id
WHERE r.status = 'CLOSED'
  AND NOT EXISTS (SELECT 1 FROM bounty_payouts p WHERE p.report_id = r.id)
ORDER BY r.created_at DESC;

-- Administrator dashboard view.
SELECT * FROM v_report_dashboard ORDER BY status, severity;

-- Payout ledger joins report, recording admin, and recipient.
SELECT * FROM v_payout_ledger ORDER BY recorded_at DESC;

-- Audit events for a report UUID supplied with psql -v report_id=... .
SELECT a.action, u.display_name AS actor, a.created_at, a.metadata
FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
WHERE (a.entity_type = 'VULNERABILITY_REPORT' AND a.entity_id = :'report_id'::uuid)
   OR a.metadata->>'reportId' = :'report_id'
ORDER BY a.created_at;
