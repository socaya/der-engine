-- V065: Peer-level direct_import flag.
--
-- Trusted peers skip the receiving edge's import inbox and apply
-- directly. Default false — pilots start cautious.

SET search_path = der, public;

ALTER TABLE workflow_peer
    ADD COLUMN direct_import BOOLEAN NOT NULL DEFAULT false;
