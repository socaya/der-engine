-- V071 — aggregate_data_value.data_set_uid FK on-delete is RESTRICT.
--
-- V069 defined the FK with ON DELETE SET NULL, but V070 made the
-- column NOT NULL. The two together would mean "delete dataset →
-- try to NULL the tag → NOT NULL violation → delete fails" which
-- works, but silently relies on the NOT NULL guard to prevent
-- destructive mirror resyncs. Making the intent explicit here:
-- if a dataset mirror row still has local aggregate values pointing
-- at it, you must deal with those values before dropping the
-- dataset.

SET search_path = der, public;

ALTER TABLE aggregate_data_value
    DROP CONSTRAINT IF EXISTS aggregate_data_value_data_set_uid_fkey;

ALTER TABLE aggregate_data_value
    ADD CONSTRAINT aggregate_data_value_data_set_uid_fkey
        FOREIGN KEY (data_set_uid)
        REFERENCES metadata_data_set(dhis2_uid)
        ON DELETE RESTRICT;
