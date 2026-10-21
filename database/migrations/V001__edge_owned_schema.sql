-- Illustration of DER-owned schema only. Not sufficient for real DHIS2 transaction capture.
CREATE SCHEMA IF NOT EXISTS der;
CREATE TABLE IF NOT EXISTS der.edge_node (
  edge_id UUID PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS der.sync_operation (
  operation_id UUID PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING','IN_PROGRESS','ACCEPTED','REJECTED','REVIEW_REQUIRED','UNCERTAIN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_sync_operation_status ON der.sync_operation(status, created_at);
