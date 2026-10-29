-- V042: §10 Packaging artefact history.
--
-- Operators building .deb / OCI images from this edge can register the
-- resulting artefact so the admin UI shows what the running appliance
-- was shipped from.

CREATE TABLE der.package_artifact (
    artifact_id       UUID PRIMARY KEY,
    kind              TEXT NOT NULL CHECK (kind IN ('DEB','TARBALL')),
    version           TEXT NOT NULL,
    arch              TEXT,
    sha256            TEXT NOT NULL,
    size_bytes        BIGINT NOT NULL,
    built_at          TIMESTAMPTZ NOT NULL,
    built_by          TEXT,
    source_commit     TEXT,
    output_path       TEXT NOT NULL,
    details           JSONB
);

CREATE INDEX idx_package_artifact_kind_built
    ON der.package_artifact (kind, built_at DESC);
CREATE UNIQUE INDEX uq_package_artifact_sha256
    ON der.package_artifact (sha256);
