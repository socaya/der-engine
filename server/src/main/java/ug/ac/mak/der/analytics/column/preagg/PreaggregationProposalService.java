package ug.ac.mak.der.analytics.column.preagg;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Transitions preaggregation proposals through their lifecycle (SRS
 * FR-INC-013). The proposer produces advisory candidates; this
 * service is where those candidates become durable records an admin
 * can approve or reject.
 *
 * <p>Dedup contract: at most one {@code PROPOSED} or {@code APPROVED}
 * row per shape at any time (enforced by the partial unique index in
 * V119). When the proposer re-emits an existing shape, the record's
 * measurements refresh in place rather than creating a parallel row.</p>
 */
@Service
public class PreaggregationProposalService {

    private final PreaggregationProposer proposer;
    private final PreaggregationProposalRepository repo;

    public PreaggregationProposalService(
            final PreaggregationProposer proposer,
            final PreaggregationProposalRepository repo) {
        this.proposer = Objects.requireNonNull(proposer, "proposer");
        this.repo = Objects.requireNonNull(repo, "repo");
    }

    /**
     * Run the proposer and persist the result. Existing open
     * proposals for the same shape have their measurements refreshed
     * (if still PROPOSED) or are left untouched (if APPROVED —
     * refresh would overwrite the number the admin saw at approval).
     */
    @Transactional
    public List<PreaggregationProposalRecord> generate() {
        final List<PreaggregationProposal> candidates = proposer.propose();
        final List<PreaggregationProposalRecord> out =
                new ArrayList<>(candidates.size());
        final Instant now = Instant.now();
        for (final PreaggregationProposal p : candidates) {
            final Optional<PreaggregationProposalRecord> existing =
                    repo.findOpenByShape(p.shapeKey());
            if (existing.isPresent()) {
                final PreaggregationProposalRecord open = existing.get();
                if (open.state()
                        == PreaggregationProposalRecord.State.PROPOSED) {
                    repo.refreshMeasurements(
                            open.proposalId(),
                            p.observations(), p.avgElapsedMillis(),
                            p.score(), p.estimatedBytes(),
                            p.lastObservedAt(), p.rationale());
                }
                out.add(repo.findById(open.proposalId()).orElse(open));
                continue;
            }
            final PreaggregationProposalRecord fresh =
                    new PreaggregationProposalRecord(
                            UUID.randomUUID(),
                            p.shapeKey(),
                            p.observations(),
                            p.avgElapsedMillis(),
                            p.score(),
                            p.estimatedBytes(),
                            p.firstObservedAt(),
                            p.lastObservedAt(),
                            p.rationale(),
                            PreaggregationProposalRecord.State.PROPOSED,
                            null, null, null,
                            now, now);
            repo.insert(fresh);
            out.add(fresh);
        }
        return out;
    }

    public List<PreaggregationProposalRecord> list(
            final PreaggregationProposalRecord.State state,
            final int limit) {
        return repo.listByState(state, limit <= 0 ? 100 : limit);
    }

    @Transactional
    public Optional<PreaggregationProposalRecord> approve(
            final UUID proposalId,
            final UUID adminId,
            final String reason) {
        Objects.requireNonNull(proposalId, "proposalId");
        final int rows = repo.transition(proposalId,
                PreaggregationProposalRecord.State.APPROVED,
                adminId, reason);
        if (rows == 0) {
            return Optional.empty();
        }
        return repo.findById(proposalId);
    }

    @Transactional
    public Optional<PreaggregationProposalRecord> reject(
            final UUID proposalId,
            final UUID adminId,
            final String reason) {
        Objects.requireNonNull(proposalId, "proposalId");
        final int rows = repo.transition(proposalId,
                PreaggregationProposalRecord.State.REJECTED,
                adminId, reason);
        if (rows == 0) {
            return Optional.empty();
        }
        return repo.findById(proposalId);
    }
}
