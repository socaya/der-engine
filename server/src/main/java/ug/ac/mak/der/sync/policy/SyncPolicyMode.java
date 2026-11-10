package ug.ac.mak.der.sync.policy;

/**
 * Three-mode sync model for the DER journal drain.
 *
 * <p>Applies at either the GLOBAL scope or per entity type. A
 * per-entity row overrides GLOBAL; absence means inherit.</p>
 */
public enum SyncPolicyMode {

    /**
     * Fire a drain tick as soon as a write of this scope lands, when
     * central is reachable. The Quartz cron (if any) still runs as a
     * safety-net for rows that were enqueued during an outage.
     */
    INSTANT,

    /**
     * Only the scheduled Quartz cron drains rows for this scope.
     * Equivalent to the pre-SM-2 behaviour.
     */
    SCHEDULED,

    /**
     * Skip rows for this scope during drains — they stay PENDING in
     * the journal with a clear "paused" signal on the admin backlog.
     * A {@code paused_reason} is required so the operator records
     * why (audit trail).
     */
    PAUSED
}
