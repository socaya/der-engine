package ug.ac.mak.der.nfr;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import ug.ac.mak.der.ops.StorageAdmissionInterceptor;
import ug.ac.mak.der.ops.StorageHealthProbe;

/**
 * NFR-30 — "When disk, DB or credentials prevent durable
 * acceptance, reject explicitly; never report false success."
 *
 * <p>Storage-exhaustion fault-injection scenario. Synthesises a
 * {@link StorageHealthProbe} reporting
 * {@link StorageHealthProbe.Status#REJECT} and walks the hot write
 * surfaces (DHIS2 /api/* writes + /edge-api/* writes), asserting
 * that each hit by the admission interceptor:
 * <ol>
 *   <li>returns HTTP 507 Insufficient Storage,</li>
 *   <li>carries the {@code STORAGE_FULL_REJECT} discriminator so
 *       clients can present a specific "appliance storage full"
 *       UX instead of a generic 5xx,</li>
 *   <li>short-circuits the handler chain
 *       ({@code preHandle} returns {@code false}) — the controller
 *       and service never see the request, so nothing is written
 *       to {@code operation_journal}, nothing is false-acknowledged.</li>
 * </ol>
 * </p>
 *
 * <p>Fault injection is at the {@link StorageHealthProbe} boundary
 * (via a stubbed probe that always reports REJECT). The real
 * pilot procedure fills a tmpfs mount to &gt;99%; the probe's
 * {@code Files.getUsableSpace} walk picks that up and reports
 * REJECT, triggering exactly the same control path this test
 * exercises.</p>
 *
 * <p>Complements NFR-32 (no central coupling on write paths) and
 * NFR-07 (two-client retrieval): NFR-07 proves acknowledged
 * writes travel across clients; NFR-30 proves that when storage
 * can't acknowledge, nothing is written at all.</p>
 */
class Nfr30StorageFaultInjectionScenarioTest {

    private static final long USABLE_AT_REJECT = 100L * 1024L * 1024L;   // 100 MB
    private static final long WARN_THRESHOLD   = 500L * 1024L * 1024L;   // 500 MB
    private static final long REJECT_THRESHOLD = 200L * 1024L * 1024L;   // 200 MB

    /** Fault-injected probe that pins the REJECT branch — no
     *  real disk IO, no tmpfs, deterministic across hosts. */
    private static StorageHealthProbe rejectingProbe() {
        return new StorageHealthProbe("/dev/null",
                WARN_THRESHOLD, REJECT_THRESHOLD) {
            @Override
            public Snapshot sample() {
                return new Snapshot("/pilot/data",
                        USABLE_AT_REJECT,
                        /* totalBytes */ 100L * 1024L * 1024L * 1024L,
                        WARN_THRESHOLD, REJECT_THRESHOLD,
                        Status.REJECT);
            }
        };
    }

    @Test
    void storageFullRejectsAllHotWritePathsWith507() throws Exception {
        final StorageAdmissionInterceptor gate =
                new StorageAdmissionInterceptor(rejectingProbe());
        final List<String> hotWritePaths = List.of(
                "/api/dataValueSets",
                "/api/events",
                "/api/tracker",
                "/edge-api/v1/apps/install",
                "/edge-api/v1/backup/request",
                "/edge-api/v1/sync/metadata");
        for (final String path : hotWritePaths) {
            final MockHttpServletRequest req = new MockHttpServletRequest(
                    "POST", path);
            final MockHttpServletResponse resp = new MockHttpServletResponse();

            final boolean admitted = gate.preHandle(req, resp, new Object());

            assertThat(admitted)
                    .as("%s must be short-circuited at the admission gate", path)
                    .isFalse();
            assertThat(resp.getStatus())
                    .as("%s must return HTTP 507 Insufficient Storage", path)
                    .isEqualTo(507);
            assertThat(resp.getContentAsString())
                    .as("%s must carry STORAGE_FULL_REJECT discriminator", path)
                    .contains("STORAGE_FULL_REJECT");
            assertThat(resp.getContentType())
                    .as("%s must emit JSON so UIs can parse it", path)
                    .startsWith("application/json");
        }
    }

    @Test
    void readsPassThroughEvenUnderReject() throws Exception {
        // NFR-30 is about rejecting WRITES under storage pressure.
        // Reads must stay reachable so operators can diagnose the
        // appliance while the alarm is active.
        final StorageAdmissionInterceptor gate =
                new StorageAdmissionInterceptor(rejectingProbe());
        for (final String path : List.of(
                "/api/dataValueSets", "/edge-api/v1/system/health",
                "/edge-api/v1/apps")) {
            final MockHttpServletRequest req = new MockHttpServletRequest(
                    "GET", path);
            final MockHttpServletResponse resp = new MockHttpServletResponse();
            assertThat(gate.preHandle(req, resp, new Object()))
                    .as("GET %s must stay reachable under REJECT", path)
                    .isTrue();
            assertThat(resp.getStatus())
                    .as("no status touched on pass-through for %s", path)
                    .isEqualTo(200);
        }
    }

    @Test
    void sessionAndAdminOpsBypassGateSoOperatorsCanRecover() throws Exception {
        // Deliberately exempt: an admin needs to sign in and run
        // backup/restore / purge / decommission actions WHILE the
        // storage alarm is active. These paths don't themselves
        // persist new operation_journal rows — they operate on
        // the admin surface and can free up space.
        final StorageAdmissionInterceptor gate =
                new StorageAdmissionInterceptor(rejectingProbe());
        for (final String path : List.of(
                "/edge-api/v1/auth/sign-in",
                "/edge-api/v1/admin/ops/journal/purge",
                "/edge-api/v1/admin/ops/backup/integrity/check")) {
            final MockHttpServletRequest req = new MockHttpServletRequest(
                    "POST", path);
            assertThat(gate.preHandle(req, new MockHttpServletResponse(),
                            new Object()))
                    .as("%s must stay reachable to let admins recover", path)
                    .isTrue();
        }
    }
}
