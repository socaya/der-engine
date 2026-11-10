package ug.ac.mak.der.scheduler;

import java.util.Objects;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import ug.ac.mak.der.sync.policy.SyncPolicyMode;
import ug.ac.mak.der.sync.policy.SyncPolicyService;

/**
 * UI-10 — consult sync_policy before running a scheduled sync job.
 *
 * <p>Centralises the "am I paused?" check so each Quartz job stays
 * tiny. Called by every DER↔DHIS2-sync job at the top of
 * {@code execute()}. Returns {@code true} when the job should
 * proceed, {@code false} when it should silently no-op (paused).</p>
 *
 * <p>Admin-initiated triggers ({@code triggeredBy != "SCHEDULED"})
 * bypass the pause — the operator explicitly asked for a run, so
 * the policy's PAUSED state shouldn't block them.</p>
 */
public final class JobPolicyGate {

    private static final Logger LOG = LoggerFactory.getLogger(JobPolicyGate.class);

    private JobPolicyGate() {
        // utility
    }

    /** Return {@code true} if the job named by {@code scope} should
     *  proceed under the current policy + trigger source. */
    public static boolean shouldRun(final SyncPolicyService policy,
                                      final String scope,
                                      final String triggeredBy) {
        Objects.requireNonNull(scope, "scope");
        // No policy service wired (test harness) → always run.
        if (policy == null) {
            return true;
        }
        // Manual admin trigger → always run; bypass PAUSED.
        if (triggeredBy != null && !"SCHEDULED".equals(triggeredBy)) {
            return true;
        }
        final SyncPolicyService.ResolvedPolicy eff =
                policy.effectiveForScope(scope);
        if (eff.mode() == SyncPolicyMode.PAUSED) {
            LOG.info("skip {} — policy paused (scope decided by {}): {}",
                    scope, eff.decidedBy(),
                    eff.pausedReason() == null ? "(no reason)" : eff.pausedReason());
            return false;
        }
        return true;
    }
}
