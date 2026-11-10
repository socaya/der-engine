package ug.ac.mak.der.workflows.tracker;

/**
 * Thrown by {@link TrackerService#upsertEnrollment} when a write
 * would leave a tracked entity with more than one ACTIVE enrolment
 * in the same program. DHIS2 central rejects this shape with
 * error E1015, so we enforce the same invariant at the edge
 * regardless of which controller / draft drain / future caller
 * invoked the upsert.
 *
 * <p>Callers typically translate this into HTTP 409 + an
 * operator-friendly message that steers the user to the existing
 * enrolment instead of attempting a second one.</p>
 */
public class ActiveEnrollmentClashException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    private final String teiUid;
    private final String programUid;
    private final String conflictingEnrollmentUid;

    public ActiveEnrollmentClashException(final String teiUid,
                                            final String programUid,
                                            final String conflictingEnrollmentUid) {
        super("Tracked entity " + teiUid + " already has an ACTIVE "
                + "enrolment in program " + programUid + " (uid="
                + conflictingEnrollmentUid + "). Complete or cancel "
                + "it before opening another.");
        this.teiUid = teiUid;
        this.programUid = programUid;
        this.conflictingEnrollmentUid = conflictingEnrollmentUid;
    }

    public String teiUid() {
        return teiUid;
    }

    public String programUid() {
        return programUid;
    }

    public String conflictingEnrollmentUid() {
        return conflictingEnrollmentUid;
    }
}
