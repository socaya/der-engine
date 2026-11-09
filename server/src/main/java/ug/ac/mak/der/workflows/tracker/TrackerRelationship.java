package ug.ac.mak.der.workflows.tracker;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** FR-08-06: typed relationship between tracker entities.
 *  Slice 2 (relationships full emulation) adds sync-tracking
 *  fields so the drain can reconcile with central DHIS2:
 *  centralUid is non-null once drain succeeds; updatedAt orders
 *  drain passes; deletedAt is a soft-delete marker the drain
 *  reads before pruning. version is bumped on every in-place
 *  mutation so a replayed drain can't resurrect a deleted row. */
public record TrackerRelationship(
        String relationshipUid,
        String relationshipType,
        EntityType fromEntityType,
        String fromEntityUid,
        EntityType toEntityType,
        String toEntityUid,
        boolean bidirectional,
        UUID createdBy,
        Instant createdAt,
        Instant updatedAt,
        Instant deletedAt,
        String centralUid,
        int version,
        SyncStatus syncStatus
) {

    public TrackerRelationship {
        Objects.requireNonNull(relationshipUid, "relationshipUid");
        Objects.requireNonNull(relationshipType, "relationshipType");
        Objects.requireNonNull(fromEntityType, "fromEntityType");
        Objects.requireNonNull(fromEntityUid, "fromEntityUid");
        Objects.requireNonNull(toEntityType, "toEntityType");
        Objects.requireNonNull(toEntityUid, "toEntityUid");
        Objects.requireNonNull(createdBy, "createdBy");
        Objects.requireNonNull(createdAt, "createdAt");
        Objects.requireNonNull(syncStatus, "syncStatus");
        if (!relationshipUid.matches("^[A-Za-z][A-Za-z0-9]{10}$")) {
            throw new IllegalArgumentException("relationshipUid must be 11-char DHIS2 UID");
        }
        if (fromEntityType == toEntityType && fromEntityUid.equals(toEntityUid)) {
            throw new IllegalArgumentException("relationship cannot point to itself");
        }
        if (version < 1) {
            throw new IllegalArgumentException("version must be >= 1");
        }
    }

    /** Back-compat ctor for pre-syncStatus call sites — defaults
     *  updatedAt=createdAt, no soft-delete, no central UID,
     *  version 1, syncStatus LOCAL. */
    public TrackerRelationship(final String relationshipUid,
                                 final String relationshipType,
                                 final EntityType fromEntityType,
                                 final String fromEntityUid,
                                 final EntityType toEntityType,
                                 final String toEntityUid,
                                 final boolean bidirectional,
                                 final UUID createdBy,
                                 final Instant createdAt) {
        this(relationshipUid, relationshipType, fromEntityType,
                fromEntityUid, toEntityType, toEntityUid, bidirectional,
                createdBy, createdAt, createdAt, null, null, 1,
                SyncStatus.LOCAL);
    }

    /** Back-compat ctor with sync-tracking fields but no explicit
     *  syncStatus — derives the status from central_uid + deletedAt
     *  so the repo's old row mapper still works during the rollout. */
    public TrackerRelationship(final String relationshipUid,
                                 final String relationshipType,
                                 final EntityType fromEntityType,
                                 final String fromEntityUid,
                                 final EntityType toEntityType,
                                 final String toEntityUid,
                                 final boolean bidirectional,
                                 final UUID createdBy,
                                 final Instant createdAt,
                                 final Instant updatedAt,
                                 final Instant deletedAt,
                                 final String centralUid,
                                 final int version) {
        this(relationshipUid, relationshipType, fromEntityType,
                fromEntityUid, toEntityType, toEntityUid, bidirectional,
                createdBy, createdAt, updatedAt, deletedAt, centralUid,
                version, deriveSyncStatus(centralUid, deletedAt));
    }

    private static SyncStatus deriveSyncStatus(
            final String centralUid, final Instant deletedAt) {
        if (centralUid != null) {
            return SyncStatus.SYNCED;
        }
        if (deletedAt != null) {
            return SyncStatus.PENDING;
        }
        return SyncStatus.LOCAL;
    }

    public boolean needsSync() {
        return centralUid == null && deletedAt == null;
    }

    public boolean isDeleted() {
        return deletedAt != null;
    }

    public enum EntityType { TRACKED_ENTITY, ENROLLMENT, EVENT }

    /** Per-row sync state for the Capture UI badge. Mirrors the
     *  edge_rel_sync_status_check CHECK constraint (V099). */
    public enum SyncStatus {
        LOCAL, PENDING, SYNCED, FAILED, BLOCKED, CONFLICT
    }
}
