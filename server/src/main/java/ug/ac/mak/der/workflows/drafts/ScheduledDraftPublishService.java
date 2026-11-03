package ug.ac.mak.der.workflows.drafts;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.web.DraftController;

/**
 * E6 — tick body for the ScheduledDraftPublishJob.
 *
 * <p>Scans {@code der.draft} for rows whose {@code scheduled_publish_at}
 * is now in the past, replays the exact same server-side publish logic
 * the manual {@code POST /{id}/publish} uses, and clears the schedule
 * marker on both success and permanent failure so a bad payload does
 * not re-attempt forever.</p>
 *
 * <p>Permanent-failure classification is "any non-2xx response from
 * {@code publishCore}" because {@link DraftController} already encodes
 * validation failures (payload malformed, mirror missing, upstream
 * rejected) as deterministic 4xx responses; a 5xx shouldn't happen
 * here because the controller catches RuntimeException and converts
 * it to 409. Transient infrastructure failures would raise an
 * exception from the surrounding JDBC call and the tick's catch
 * leaves the schedule intact for retry on the next tick.</p>
 */
@Service
public class ScheduledDraftPublishService {

    private static final Logger LOG = LoggerFactory.getLogger(
            ScheduledDraftPublishService.class);

    private static final int BATCH_LIMIT = 50;
    private static final String TICK_IP = "scheduler";
    private static final String TICK_UA = "der-scheduler";

    private final DraftRepository drafts;
    private final DraftController controller;

    public ScheduledDraftPublishService(final DraftRepository drafts,
                                          final DraftController controller) {
        this.drafts = Objects.requireNonNull(drafts, "drafts");
        this.controller = Objects.requireNonNull(controller, "controller");
    }

    /**
     * One pass. Returns a result struct the Quartz job can serialise
     * into the {@code scheduled_job_run} payload for operator audit.
     */
    public TickResult runOnce() {
        final Instant now = Instant.now();
        final List<DraftRepository.ScheduledDraftRef> matured =
                drafts.findMaturedScheduled(now, BATCH_LIMIT);
        int published = 0;
        int kept = 0;
        int failed = 0;
        for (final DraftRepository.ScheduledDraftRef ref : matured) {
            final Optional<Draft> row = drafts.findById(ref.draftId());
            if (row.isEmpty()) {
                /* draft was deleted between the batch read and this
                 * iteration — nothing to publish, nothing to clear. */
                continue;
            }
            final Draft draft = row.get();
            try {
                final ResponseEntity<Map<String, Object>> result =
                        controller.publishCore(draft, ref.ownerId(), TICK_IP, TICK_UA);
                if (result.getStatusCode().is2xxSuccessful()) {
                    final boolean consumed = result.getBody() != null
                            && Boolean.TRUE.equals(result.getBody().get("draftConsumed"));
                    if (consumed) {
                        published++;
                    } else {
                        /* The payload was accepted but conflicts kept
                         * the draft alive. Clear the schedule so the
                         * tick doesn't loop over the same unchanged
                         * draft every minute — the operator must
                         * manually re-publish after fixing. */
                        drafts.clearSchedule(ref.draftId(), ref.ownerId());
                        kept++;
                    }
                } else {
                    drafts.clearSchedule(ref.draftId(), ref.ownerId());
                    failed++;
                }
            } catch (RuntimeException ex) {
                /* Transient (likely infra). Leave the schedule in place
                 * so the next tick retries. Metrics would be a nicer
                 * channel but a WARN log is enough for the operator
                 * right now. */
                LOG.warn("scheduled publish of draft {} raised {} — leaving scheduled",
                        ref.draftId(), ex.getClass().getSimpleName());
                failed++;
            }
        }
        return new TickResult(matured.size(), published, kept, failed);
    }

    public record TickResult(int scanned, int published, int keptWithConflicts, int failed) { }
}
