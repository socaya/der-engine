-- V069 — tag aggregate_data_value with the originating dataSet.
--
-- Standard DHIS2 does not pin a data value to a specific dataset
-- (a value is uniquely identified by dataElement / orgUnit / period
-- / categoryOptionCombo / attributeOptionCombo). For DER's
-- facility-local analytics we want to know which dataset the value
-- was captured through so we can roll up / filter / report by
-- dataset without re-deriving it at read time.
--
-- The column is nullable and does NOT participate in the compound
-- key — same cell captured via two overlapping datasets still
-- resolves to the same row (last-writer-wins), the tag just records
-- the form that captured it last.
SET search_path = der, public;

ALTER TABLE aggregate_data_value
    ADD COLUMN IF NOT EXISTS data_set_uid TEXT
        REFERENCES metadata_data_set(dhis2_uid)
        ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_aggregate_data_value_data_set
    ON aggregate_data_value (data_set_uid, submitted_at DESC);
