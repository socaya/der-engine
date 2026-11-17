-- V131 — on-edge persistence for user-created analytics artifacts.
--
-- Rationale: DHIS2's Data Visualizer, Dashboard, Maps, Event Reports,
-- and Event Charts apps all save user-created artifacts (saved pivot
-- tables, dashboards, maps, event report queries) to central via
-- POST/PUT /api/{visualizations,dashboards,maps,reports,eventReports,
-- eventCharts,charts}. Without a local persistence layer, a DER
-- appliance either (a) proxies to central — breaking the offline
-- promise — or (b) accepts-and-drops via gracefulEmpty, which
-- silently loses the operator's work on reload.
--
-- metadata_catalog_item stores central-pulled metadata snapshots; it
-- is not the right home for operator-authored artifacts (those must
-- survive a metadata sync overwrite, carry per-user ownership, and be
-- editable client-side without a central round-trip). This table is
-- the matching write-side.
--
-- Shape: (resource, uid) is the DHIS2 natural key. payload is the
-- full DHIS2 object the client POSTed, served back verbatim on GET so
-- round-trip fidelity is lossless (we don't need to understand chart
-- semantics to persist them).
CREATE TABLE IF NOT EXISTS der.metadata_artifact (
    resource    text        NOT NULL,
    uid         varchar(11) NOT NULL,
    display_name text,
    created_by  uuid,
    updated_by  uuid,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    payload     jsonb       NOT NULL,
    PRIMARY KEY (resource, uid)
);

CREATE INDEX IF NOT EXISTS metadata_artifact_resource_created_idx
    ON der.metadata_artifact (resource, created_at DESC);

CREATE INDEX IF NOT EXISTS metadata_artifact_display_name_idx
    ON der.metadata_artifact (resource, display_name);

COMMENT ON TABLE der.metadata_artifact IS
    'Operator-authored DHIS2 analytics artifacts (visualizations, dashboards, maps, reports, eventReports, eventCharts, charts). Distinct from metadata_catalog_item (central-pulled metadata) so a metadata sync does not overwrite user-created content.';
