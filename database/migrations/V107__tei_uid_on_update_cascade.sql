-- SM-3a — enable UPDATE-cascade on edge_enrollment.tei_uid.
--
-- Legacy TEIs created before the DHIS2-UID generator fix carry
-- 36-char UUIDs that central rejects with E1xxx. To migrate a
-- legacy TEI to a valid 11-char DHIS2 UID we need to rewrite
-- tracked_entity.tei_uid (the primary key). The existing FK on
-- edge_enrollment.tei_uid uses ON DELETE CASCADE only — so a plain
-- UPDATE on the parent fails because child rows can't be updated
-- transparently. Adding ON UPDATE CASCADE lets the migration do a
-- single UPDATE on the parent and let Postgres propagate the new
-- UID to all enrollments.
--
-- This is also the right long-run shape for a tracker system
-- anyway — parent-id changes should cascade, not orphan children.

SET search_path = der, public;

ALTER TABLE edge_enrollment
    DROP CONSTRAINT IF EXISTS edge_enrollment_tei_uid_fkey;
ALTER TABLE edge_enrollment
    ADD CONSTRAINT edge_enrollment_tei_uid_fkey
    FOREIGN KEY (tei_uid) REFERENCES tracked_entity(tei_uid)
    ON UPDATE CASCADE ON DELETE CASCADE;
