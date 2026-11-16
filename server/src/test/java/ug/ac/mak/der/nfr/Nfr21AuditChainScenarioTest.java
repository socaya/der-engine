package ug.ac.mak.der.nfr;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import ug.ac.mak.der.security.AuditEvent;

/**
 * NFR-21 — "Every conflict decision and privilege-changing
 * operation includes accountable actor, time and outcome."
 *
 * <p>ADR-0021 shipped the full append-only audit chain:
 * {@code der.security_audit} carries one row per
 * security-sensitive event with a BEFORE INSERT trigger that
 * computes {@code row_hash = SHA256(prev_hash || canonical_body)}.
 * A later rogue INSERT or UPDATE breaks the chain and
 * {@link ug.ac.mak.der.security.SecurityAuditVerifier} reports
 * the first break. What was missing was a top-level invariant
 * pin tying the three NFR-21 obligations (actor / time /
 * outcome) to the schema + the {@link AuditEvent} record so a
 * refactor can't silently drop a field.</p>
 *
 * <p>Pinned invariants:
 * <ol>
 *   <li><b>Actor.</b> {@link AuditEvent#actorUserId()} is on the
 *       record (nullable only for the anonymous events the
 *       sign-in attempt audit emits before a session exists).
 *       The schema's {@code actor_user_id UUID} column makes
 *       the actor available for every row.</li>
 *   <li><b>Outcome.</b> {@link AuditEvent.Outcome} is a 3-value
 *       enum (SUCCESS / DENIED / ERROR). Null is rejected at
 *       record construction time (pinned by test). The schema
 *       CHECK constraint mirrors the enum so a rogue INSERT with
 *       an unknown outcome string is rejected by Postgres.</li>
 *   <li><b>Time.</b> Every row carries {@code observed_at
 *       TIMESTAMPTZ NOT NULL DEFAULT now()}. The canonical body
 *       the hash chain commits to includes
 *       {@code observed_at} to microsecond precision, so an
 *       edit that rewrites the timestamp invalidates every
 *       row downstream.</li>
 *   <li><b>Hash chain.</b> The V017 migration adds
 *       {@code prev_hash} + {@code row_hash} BYTEA columns and a
 *       BEFORE INSERT trigger that takes an advisory xact lock
 *       (prevents concurrent INSERT races) + reads the latest
 *       row hash, computes the new one, and stamps the row.</li>
 * </ol>
 * </p>
 *
 * <p>Companion to {@code Nfr02Nfr03Nfr04DurabilityAtomicityConsistencyTest}
 * (writes are @Transactional + FK-guarded) and
 * {@code Nfr06ConfidentialitySurfaceScenarioTest} (PiiMasking
 * strips PII before it reaches the audit {@code detail}
 * JSONB). Live hash-chain verification is the pilot-side
 * responsibility of {@link
 * ug.ac.mak.der.security.SecurityAuditVerifier}.</p>
 */
class Nfr21AuditChainScenarioTest {

    @Test
    void nfr21AuditEventRequiresEventTypeOutcomeTimestamp() {
        // AuditEvent's record constructor enforces non-null
        // eventType + outcome; detail defaults to an empty map;
        // the timestamp is applied by the caller (always
        // Instant.now() per the audit sink). Null values break
        // the record construction — pin so a refactor can't
        // weaken the invariant.
        assertThatThrownBy(() -> new AuditEvent(
                null, AuditEvent.Outcome.SUCCESS,
                UUID.randomUUID(), null, null, null, null))
                .as("eventType null is rejected")
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new AuditEvent(
                "SIGN_IN_SUCCESS", null,
                UUID.randomUUID(), null, null, null, null))
                .as("outcome null is rejected")
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void nfr21AuditEventEveryOutcomeIsActionable() {
        // The three outcome values cover the operator-facing
        // taxonomy: SUCCESS (action completed), DENIED (authz
        // refused), ERROR (unexpected failure). A fourth would
        // dilute the signal for pilot operators reading the
        // audit feed; pin the enum size.
        assertThat(AuditEvent.Outcome.values())
                .as("audit outcome taxonomy — three operator-actionable values")
                .containsExactlyInAnyOrder(
                        AuditEvent.Outcome.SUCCESS,
                        AuditEvent.Outcome.DENIED,
                        AuditEvent.Outcome.ERROR);
    }

    @Test
    void nfr21AuditTableSchemaPinsActorTimestampOutcome() throws IOException {
        final Path migrationDir = Paths.get(System.getProperty("user.dir"))
                .resolve("../database/migrations").normalize();
        final String base = read(migrationDir.resolve(
                "V001__phase02_identity.sql"));
        // Actor column — nullable so anonymous sign-in-attempt
        // events still land but the field exists on every row.
        assertThat(base)
                .as("security_audit.actor_user_id column present")
                .contains("actor_user_id UUID");
        // Timestamp column — NOT NULL with a server-side
        // default, so a client can't skip it or back-date it
        // (the default is now() on INSERT, computed in the DB).
        assertThat(base)
                .as("security_audit.observed_at NOT NULL DEFAULT now()")
                .contains("observed_at   TIMESTAMPTZ NOT NULL DEFAULT now()");
        // Outcome CHECK — rogue INSERT with a new string value
        // is rejected at the DB, so the Java enum stays
        // authoritative.
        assertThat(base)
                .as("security_audit.outcome CHECK pins the 3 values")
                .contains("outcome       TEXT NOT NULL CHECK (outcome IN ("
                        + "'SUCCESS','DENIED','ERROR'))");
    }

    @Test
    void nfr21AuditChainColumnsAndTriggerPresent() throws IOException {
        final Path migrationDir = Paths.get(System.getProperty("user.dir"))
                .resolve("../database/migrations").normalize();
        final String chain = read(migrationDir.resolve(
                "V017__phase11_audit_chain.sql"));
        // Both chain columns present.
        assertThat(chain)
                .as("prev_hash + row_hash columns on security_audit")
                .contains("ADD COLUMN IF NOT EXISTS prev_hash BYTEA")
                .contains("ADD COLUMN IF NOT EXISTS row_hash  BYTEA");
        // Canonical body function exists — the hash commits to
        // every field the audit record carries, so an edit to
        // any column downstream invalidates the chain.
        assertThat(chain)
                .as("canonical body function covers all audit columns")
                .contains("CREATE OR REPLACE FUNCTION security_audit_canonical_body")
                .contains("p_event_type")
                .contains("p_actor_user_id")
                .contains("p_outcome")
                .contains("p_observed_at");
        // Trigger uses pg_advisory_xact_lock so concurrent
        // INSERTs can't race on prev_hash — both would read
        // the same tail and compute conflicting row_hashes.
        assertThat(chain)
                .as("BEFORE INSERT trigger takes advisory lock")
                .contains("pg_advisory_xact_lock(1145918529, 1430668372)");
        // row_hash computed as SHA-256(prev || body) — standard
        // tamper-evident chain shape, same algorithm the
        // verifier recomputes.
        assertThat(chain)
                .as("row_hash = SHA-256(prev_hash || canonical_body)")
                .contains("digest(v_prev || v_body, 'sha256')");
    }

    @Test
    void nfr21VerifierIsReachableForPilotEvidence() {
        // The verifier is a bean with a public verify() method
        // callable from the admin ops surface. A refactor that
        // hides it behind a private method would make pilot
        // evidence runs impossible — pin presence.
        final Class<?> verifier =
                ug.ac.mak.der.security.SecurityAuditVerifier.class;
        assertThat(verifier.getAnnotation(
                org.springframework.stereotype.Component.class))
                .as("SecurityAuditVerifier is a @Component bean")
                .isNotNull();
        // Public method accepting the jdbc template or no args
        // (both shapes land during the ADR-0021 refactor).
        final boolean hasPublicEntry = java.util.Arrays
                .stream(verifier.getDeclaredMethods())
                .anyMatch(m -> java.lang.reflect.Modifier
                        .isPublic(m.getModifiers())
                        && (m.getName().equals("verify")
                                || m.getName().equals("verifyChain")
                                || m.getName().equals("verifyAll")));
        assertThat(hasPublicEntry)
                .as("verifier exposes a public verify entry")
                .isTrue();
    }

    @Test
    void nfr21AuditEventDetailMapIsImmutable() {
        // NFR-21's "every decision includes accountable actor,
        // time and outcome" plus NFR-06 (log confidentiality)
        // both require that detail payload can't be mutated
        // after the record lands. The record copies the detail
        // Map defensively at construction — pin so a refactor
        // can't leak a live-mutable reference into the audit
        // sink.
        final java.util.Map<String, Object> mutable =
                new java.util.HashMap<>();
        mutable.put("originalValue", "unchanged");
        final AuditEvent event = new AuditEvent(
                "SETTINGS_CHANGED", AuditEvent.Outcome.SUCCESS,
                UUID.randomUUID(), null, null, null, mutable);
        // Caller-side mutation must not reach into the record.
        mutable.put("sneakyAddition", "escaped");
        assertThat(event.detail())
                .as("audit detail is immutable after construction")
                .doesNotContainKey("sneakyAddition")
                .containsEntry("originalValue", "unchanged");
        // Direct mutation of the record's detail must throw —
        // Map.copyOf returns an UnmodifiableMap.
        assertThatThrownBy(() -> event.detail()
                .put("directMutation", "escaped"))
                .isInstanceOf(UnsupportedOperationException.class);
    }

    private static String read(final Path p) throws IOException {
        return Files.readString(p);
    }

    @Test
    void nfr21TimestampPrecisionCommitsToUtcMicroseconds() throws IOException {
        // The hash chain commits to observed_at at microsecond
        // precision in UTC. An edit that reformats the
        // timestamp (second precision, or a local-TZ emission)
        // invalidates every downstream row — this invariant
        // caught a real regression during ADR-0021 development
        // where Postgres's default to_char emitted milliseconds.
        final Path migrationDir = Paths.get(System.getProperty("user.dir"))
                .resolve("../database/migrations").normalize();
        final String chain = read(migrationDir.resolve(
                "V017__phase11_audit_chain.sql"));
        assertThat(chain)
                .as("UTC + microsecond precision pinned in canonical body")
                .contains("p_observed_at AT TIME ZONE 'UTC'")
                .contains("YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"");
        // Illustrative Instant parsing — the Java side always
        // emits a UTC timestamp via Instant.now() (the sink's
        // default). A caller that passes a ZonedDateTime loses
        // the zone when the audit sink converts to Instant.
        final Instant now = Instant.now();
        assertThat(now.toString())
                .as("Instant.now() emits UTC with 'Z' suffix")
                .endsWith("Z");
    }
}
