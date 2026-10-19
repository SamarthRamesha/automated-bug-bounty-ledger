-- Execute this only in a local demo database session. It demonstrates CREATE, ALTER and DROP
-- without changing application tables.
CREATE TEMP TABLE import_validation_demo (raw_title TEXT NOT NULL);
ALTER TABLE import_validation_demo ADD COLUMN validated_at TIMESTAMPTZ;
DROP TABLE import_validation_demo;
