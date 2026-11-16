package ug.ac.mak.der.workflows.events;

/**
 * FR-07-08 — taxonomy for central-vs-local event divergence.
 *
 * <p>Emitted as the second segment of {@code EVENT_DIVERGENCE_<CLASS>}
 * audit events by {@link ug.ac.mak.der.workflows.pull.EventPuller}
 * and surfaced via the admin diagnostic at
 * {@code /edge-api/v1/events/divergence/recent}.</p>
 *
 * <p>Four cases with distinct operator responses:
 * <ul>
 *   <li>{@link #IN_SYNC} — informational; local + central agree.
 *     Not audited (would spam the log).</li>
 *   <li>{@link #CENTRAL_DIVERGED} — both sides have the event; data
 *     differs. Someone edited it on central after DER's last sync.
 *     The existing pull/conflict path already raises a journal
 *     conflict for operator review; this audit adds the explicit
 *     classification label so the UI can filter by it.</li>
 *   <li>{@link #CENTRAL_DELETED} — DER has an event that previously
 *     reached central (per {@code operation_journal}), but it's now
 *     absent from a central-side sweep. Either an admin deleted it
 *     on central, or DER's cached acceptance was false-positive.
 *     Operator decides: re-publish, keep local tombstone, or
 *     accept deletion.</li>
 *   <li>{@link #DUPLICATE_LOCAL} — two local rows share the same
 *     DHIS2 event uid. The schema's PK makes this impossible at
 *     insert, but the sweeper still checks across the legacy
 *     {@code der.event} + canonical {@code der.edge_tracker_event}
 *     tables so a historical migration leak surfaces.</li>
 * </ul>
 */
public enum EventDivergenceClass {
    IN_SYNC,
    CENTRAL_DIVERGED,
    CENTRAL_DELETED,
    DUPLICATE_LOCAL
}
