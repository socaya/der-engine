package ug.ac.mak.der.nfr;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;

import ug.ac.mak.der.workflows.aggregate.AggregateDataValueService;
import ug.ac.mak.der.workflows.events.EventService;
import ug.ac.mak.der.workflows.tracker.TrackerService;

/**
 * NFR-32 — "A successful supported local operation makes no
 * blocking central API call on its critical path."
 *
 * <p>Architectural invariant over the three services that
 * terminate the hot write paths (aggregate / event / tracker).
 * The DER design posture (ADR-0010 durable journal) is that every
 * local write lands in {@code operation_journal} and returns;
 * {@code JournalPublisher} drains to central from a background
 * worker, never on the request thread. If any future refactor
 * injects an HTTP-client-shaped dependency into one of these
 * services, the write path can silently acquire a critical-path
 * network round-trip to central, violating NFR-32.</p>
 *
 * <p>This test walks the declared constructor parameters + fields
 * of each service via reflection and asserts none carries a type
 * (or a generic parameter of a type) in the forbidden set:
 * {@code java.net.http.HttpClient}, {@code
 * ug.ac.mak.der.dhis2.Dhis2ReferenceClient}, Spring's
 * {@code RestTemplate} / {@code WebClient}, Apache HTTP
 * components. Fails the gate if any new field or param lands
 * one of these on the hot path.</p>
 *
 * <p>The pin is deliberately static — it runs in &lt;1ms and
 * needs no runtime fixtures. Pairs with the FR-11-09/10 cursor-
 * only-on-success invariant + {@code JournalPublisher}'s
 * always-background posture: a backend engineer can't
 * accidentally make the write path blocking by adding a
 * "convenience" direct-to-central call during local commit.</p>
 */
class Nfr32NoCentralCouplingTest {

    /** The classes whose critical path NFR-32 constrains. */
    private static final List<Class<?>> HOT_PATH_SERVICES = List.of(
            AggregateDataValueService.class,
            EventService.class,
            TrackerService.class);

    /**
     * Fully-qualified names of types that can issue a blocking
     * network call to central. Any field or constructor parameter
     * of this type (or carrying this type as a generic argument)
     * on a hot-path service fails the invariant.
     */
    private static final Set<String> FORBIDDEN_TYPES = Set.of(
            "java.net.http.HttpClient",
            "org.apache.hc.client5.http.classic.HttpClient",
            "org.apache.http.client.HttpClient",
            "org.springframework.web.client.RestTemplate",
            "org.springframework.web.reactive.function.client.WebClient",
            "ug.ac.mak.der.dhis2.Dhis2ReferenceClient",
            "ug.ac.mak.der.dhis2.CentralReferralSearchClient",
            "ug.ac.mak.der.apps.central.CentralAppClient",
            "ug.ac.mak.der.apps.central.AppHubClient");

    @Test
    void noHotPathServiceDependsOnACentralHttpClient() {
        final List<String> violations = new ArrayList<>();
        for (final Class<?> svc : HOT_PATH_SERVICES) {
            checkClass(svc, violations);
        }
        assertThat(violations)
                .as("NFR-32 — the following hot-path write services have "
                    + "acquired a central-HTTP-client-shaped dependency "
                    + "on their critical path. Re-route via the journal "
                    + "worker (background drain, non-blocking) rather "
                    + "than calling central inline from the request thread.")
                .isEmpty();
    }

    private static void checkClass(final Class<?> cls,
                                     final List<String> violations) {
        for (final Constructor<?> c : cls.getDeclaredConstructors()) {
            for (final Parameter p : c.getParameters()) {
                collectForbidden(cls.getSimpleName() + " ctor param "
                        + p.getName(), p.getParameterizedType(), violations);
            }
        }
        for (final Field f : cls.getDeclaredFields()) {
            collectForbidden(cls.getSimpleName() + " field "
                    + f.getName(), f.getGenericType(), violations);
        }
        // Also inspect the setters that mimic constructor injection —
        // services use @Autowired(required=false) setters for optional
        // back-compat deps. Methods starting with `set` are heuristic
        // but good enough to catch the common patterns.
        for (final Method m : cls.getDeclaredMethods()) {
            if (!m.getName().startsWith("set") || m.getParameterCount() != 1) {
                continue;
            }
            collectForbidden(cls.getSimpleName() + " setter " + m.getName(),
                    m.getGenericParameterTypes()[0], violations);
        }
    }

    /**
     * Walk a (possibly generic) type and append any forbidden-set
     * match to {@code violations}. For {@code
     * ObjectProvider<Dhis2ReferenceClient>} we pick up the inner
     * type too so Spring-provider-wrapped injection can't sneak
     * past the check.
     */
    private static void collectForbidden(final String location,
                                             final Type t,
                                             final List<String> violations) {
        final Set<String> seen = new HashSet<>();
        walk(t, seen);
        for (final String name : seen) {
            if (FORBIDDEN_TYPES.contains(name)) {
                violations.add(location + " → " + name);
            }
        }
    }

    private static void walk(final Type t, final Set<String> seen) {
        if (t == null) {
            return;
        }
        if (t instanceof Class<?> c) {
            seen.add(c.getName());
            return;
        }
        if (t instanceof ParameterizedType pt) {
            walk(pt.getRawType(), seen);
            for (final Type arg : pt.getActualTypeArguments()) {
                walk(arg, seen);
            }
        }
    }

    /**
     * Guard against the invariant going stale: if the forbidden-set
     * no longer contains the canonical central HTTP client, the
     * test is lying. Pin the tripwire explicitly.
     */
    @Test
    void forbiddenSetStillIncludesCanonicalCentralClient() {
        assertThat(FORBIDDEN_TYPES)
                .contains("ug.ac.mak.der.dhis2.Dhis2ReferenceClient")
                .contains("java.net.http.HttpClient");
    }

    /**
     * Guard against the hot-path list going stale: if a future
     * supported-local-operation surface lands a new write service
     * (e.g., a dataset-completion service), this test will keep
     * passing while NFR-32 silently drifts. Pin the known-current
     * set so adding a new service without extending this test
     * triggers a code-review discussion.
     */
    @Test
    void hotPathSetMatchesTheKnownWriteSurface() {
        assertThat(HOT_PATH_SERVICES)
                .containsExactlyInAnyOrder(
                        AggregateDataValueService.class,
                        EventService.class,
                        TrackerService.class);
    }
}
