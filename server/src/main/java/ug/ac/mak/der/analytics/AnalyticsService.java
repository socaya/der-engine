package ug.ac.mak.der.analytics;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Service;

/** ADR-0020 slice A analytics service. */
@Service
@ConditionalOnBean(AnalyticsRepository.class)
public class AnalyticsService {

    private static final Logger LOG = LoggerFactory.getLogger(AnalyticsService.class);

    private final AnalyticsRepository repo;

    public AnalyticsService(final AnalyticsRepository repo) {
        this.repo = Objects.requireNonNull(repo, "repo");
    }

    public List<FacilitySummaryRow> summary(final String orgUnitId,
                                              final FacilitySummaryRow.Kind kind) {
        return repo.summary(orgUnitId, kind);
    }

    public int rejections(final int limit) {
        return repo.recentRejections(limit);
    }

    public Instant lastRefreshedAt() {
        return repo.lastRefreshedAt();
    }

    public void refreshNow() {
        try {
            repo.refresh();
        } catch (RuntimeException ex) {
            LOG.warn("analytics refresh failed: {}", ex.getMessage());
            throw ex;
        }
    }
}
