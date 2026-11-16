package ug.ac.mak.der.workflows.events;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * FR-07-08 — pure function that compares a local-stored {@link Event}
 * with the central-returned {@link Event} and returns a
 * {@link EventDivergenceClass} + a per-field diff summary suitable
 * for audit detail.
 *
 * <p>Deliberately stateless: no repository or clock dependency.
 * The caller supplies both sides and routes the classification to
 * the right surface (journal, audit, admin API).</p>
 */
public final class EventDivergenceClassifier {

    private EventDivergenceClassifier() { }

    /**
     * Compare the local + central view of a single event uid.
     *
     * @param local   DER-stored event, {@code null} if DER has no
     *                record for this uid (the puller already handles
     *                insert-new; absence of local means central
     *                introduced the event and the classifier isn't
     *                the surface — returns IN_SYNC to short-circuit).
     * @param central central-returned event, {@code null} when DER
     *                is doing a deletion sweep and central no longer
     *                knows this uid.
     */
    public static Classification classify(final Event local, final Event central) {
        if (local == null) {
            // Central knows about an event DER doesn't. The pull path
            // inserts it; nothing to flag.
            return new Classification(EventDivergenceClass.IN_SYNC, Map.of());
        }
        if (central == null) {
            return new Classification(EventDivergenceClass.CENTRAL_DELETED,
                    Map.of("absentOn", "central",
                            "localEventVersion", String.valueOf(local.eventVersion())));
        }
        final Map<String, Object> diff = diffFields(local, central);
        if (diff.isEmpty()) {
            return new Classification(EventDivergenceClass.IN_SYNC, Map.of());
        }
        return new Classification(EventDivergenceClass.CENTRAL_DIVERGED, diff);
    }

    /**
     * Collision-check variant: given two local rows sharing an event
     * uid (e.g. the canonical + legacy tables holding the same
     * identifier), classify as DUPLICATE_LOCAL. Callers with a single
     * local row should use {@link #classify} instead.
     */
    public static Classification classifyDuplicate(final Event local,
                                                      final Event otherLocal) {
        Objects.requireNonNull(local, "local");
        Objects.requireNonNull(otherLocal, "otherLocal");
        if (!local.eventId().equals(otherLocal.eventId())) {
            return new Classification(EventDivergenceClass.IN_SYNC, Map.of());
        }
        return new Classification(EventDivergenceClass.DUPLICATE_LOCAL,
                Map.of("eventId", local.eventId().toString(),
                        "localVersions", String.valueOf(local.eventVersion())
                                + "," + otherLocal.eventVersion()));
    }

    private static Map<String, Object> diffFields(final Event local, final Event central) {
        final Map<String, Object> out = new LinkedHashMap<>();
        if (!equalStr(local.programUid(), central.programUid())) {
            out.put("program", cmp(local.programUid(), central.programUid()));
        }
        if (!equalStr(local.programStageUid(), central.programStageUid())) {
            out.put("programStage", cmp(local.programStageUid(), central.programStageUid()));
        }
        if (!equalStr(local.orgUnitUid(), central.orgUnitUid())) {
            out.put("orgUnit", cmp(local.orgUnitUid(), central.orgUnitUid()));
        }
        if (local.status() != central.status()) {
            out.put("status", cmp(local.status().name(), central.status().name()));
        }
        if (!Objects.equals(local.occurredAt(), central.occurredAt())) {
            out.put("occurredAt", cmp(String.valueOf(local.occurredAt()),
                    String.valueOf(central.occurredAt())));
        }
        if (!equalStr(local.attributeOptionComboUid(), central.attributeOptionComboUid())) {
            out.put("attributeOptionCombo",
                    cmp(local.attributeOptionComboUid(),
                        central.attributeOptionComboUid()));
        }
        final List<Map<String, Object>> dataValueDiffs =
                diffDataValues(local.dataValues(), central.dataValues());
        if (!dataValueDiffs.isEmpty()) {
            out.put("dataValues", dataValueDiffs);
        }
        return out;
    }

    private static List<Map<String, Object>> diffDataValues(
            final Map<String, String> local, final Map<String, String> central) {
        final List<Map<String, Object>> rows = new ArrayList<>();
        for (final var e : local.entrySet()) {
            final String c = central.get(e.getKey());
            if (!equalStr(e.getValue(), c)) {
                rows.add(Map.of("dataElement", e.getKey(),
                        "local", nullSafe(e.getValue()),
                        "central", nullSafe(c)));
            }
        }
        for (final var e : central.entrySet()) {
            if (!local.containsKey(e.getKey())) {
                rows.add(Map.of("dataElement", e.getKey(),
                        "local", "", "central", nullSafe(e.getValue())));
            }
        }
        return rows;
    }

    private static boolean equalStr(final String a, final String b) {
        return Objects.equals(a == null ? "" : a, b == null ? "" : b);
    }

    private static Map<String, Object> cmp(final String local, final String central) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("local", nullSafe(local));
        m.put("central", nullSafe(central));
        return m;
    }

    private static String nullSafe(final String s) {
        return s == null ? "" : s;
    }

    public record Classification(EventDivergenceClass klass,
                                  Map<String, Object> detail) { }
}
