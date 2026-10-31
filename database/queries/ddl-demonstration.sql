-- Safe DDL and DML demonstration; application tables are not modified.
BEGIN;
CREATE TEMP TABLE import_validation_demo (raw_title TEXT NOT NULL);
ALTER TABLE import_validation_demo ADD COLUMN validated_at TIMESTAMPTZ;
INSERT INTO import_validation_demo(raw_title) VALUES ('Sanitized demo report'), ('Discarded draft');
UPDATE import_validation_demo SET validated_at = CURRENT_TIMESTAMP WHERE raw_title = 'Sanitized demo report';
DELETE FROM import_validation_demo WHERE validated_at IS NULL;
SELECT * FROM import_validation_demo ORDER BY raw_title;
DROP TABLE import_validation_demo;
ROLLBACK;
