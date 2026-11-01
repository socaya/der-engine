-- V063: structured suggested_value on validation issues.
--
-- Program-rule ASSIGN actions compute a value server-side. Prior
-- releases carried it only inside the human-readable message; this
-- column lets the client (and tests) consume it reliably without
-- parsing message strings.

SET search_path = der, public;

ALTER TABLE workflow_validation_issue
    ADD COLUMN suggested_value TEXT;
