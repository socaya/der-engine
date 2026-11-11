package ug.ac.mak.der.analytics.column.feedback;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.UUID;

import org.springframework.stereotype.Service;

import ug.ac.mak.der.analytics.engine.AnalyticsEngineRepository;

/**
 * Bounded ring buffer of recent {@link PlanFeedback} observations
 * (SRS FR-QRY-015). In-memory only in this slice; durable
 * persistence lands when the adaptive optimizer actually consumes
 * aggregates.
 *
 * <p>Thread-safe via a single synchronized lock — the write rate
 * is bounded by /query throughput and the reader is an
 * occasional admin inspection, so a fancy lock-free queue is
 * overkill here.</p>
 */
@Service
public class PlanFeedbackStore {

    private final Deque<PlanFeedback> buffer;
    private final int capacity;

    public PlanFeedbackStore(final PlanFeedbackProperties properties) {
        Objects.requireNonNull(properties, "properties");
        this.capacity = properties.capacity();
        this.buffer = new ArrayDeque<>(capacity);
    }

    public PlanFeedbackStore() {
        this(new PlanFeedbackProperties(512));
    }

    public synchronized void record(final PlanFeedback feedback) {
        Objects.requireNonNull(feedback, "feedback");
        while (buffer.size() >= capacity) {
            buffer.pollFirst();
        }
        buffer.offerLast(feedback);
    }

    public synchronized List<PlanFeedback> recent(final int limit) {
        final int n = Math.max(1, Math.min(limit, capacity));
        final List<PlanFeedback> out = new ArrayList<>(buffer);
        java.util.Collections.reverse(out);
        if (out.size() > n) {
            return new ArrayList<>(out.subList(0, n));
        }
        return out;
    }

    public synchronized int size() {
        return buffer.size();
    }

    public int capacity() {
        return capacity;
    }

    public synchronized void clear() {
        buffer.clear();
    }

    /** Average observed ratio per shape key over the window.
     *  Shape keys with zero observations are absent so a consumer
     *  doesn't skew per-shape estimates on no-data cases. */
    public synchronized Map<String, Double> averageRatioByShape() {
        final Map<String, long[]> sums = new TreeMap<>();
        for (final PlanFeedback f : buffer) {
            sums.computeIfAbsent(f.shapeKey(), k -> new long[2]);
            final long[] acc = sums.get(f.shapeKey());
            acc[0] += (long) (f.observedRatio() * 1_000_000d);
            acc[1] += 1L;
        }
        final Map<String, Double> out = new TreeMap<>();
        for (final Map.Entry<String, long[]> e : sums.entrySet()) {
            final long[] acc = e.getValue();
            if (acc[1] == 0L) {
                continue;
            }
            out.put(e.getKey(),
                    (acc[0] / 1_000_000d) / acc[1]);
        }
        return out;
    }

    /** Derive a stable shape key from a CellQuery. PHI-safe —
     *  only the <em>presence</em> of filter axes contributes, never
     *  the values. */
    public static String shapeKeyFor(
            final AnalyticsEngineRepository.CellQuery q) {
        Objects.requireNonNull(q, "query");
        try {
            final MessageDigest md = MessageDigest.getInstance("SHA-256");
            md.update(Integer.toString(
                    q.metricIds() == null ? 0 : q.metricIds().size())
                    .getBytes(StandardCharsets.UTF_8));
            md.update((byte) 0);
            // Metric ids themselves are not PHI — include them so
            // feedback groups per-metric.
            if (q.metricIds() != null) {
                for (final UUID id : q.metricIds()) {
                    md.update(id.toString()
                            .getBytes(StandardCharsets.UTF_8));
                    md.update((byte) 0);
                }
            }
            md.update(Integer.toString(
                    q.periodKeys() == null ? 0 : q.periodKeys().size())
                    .getBytes(StandardCharsets.UTF_8));
            md.update((byte) 0);
            md.update(Integer.toString(
                    q.orgUnitUids() == null ? 0 : q.orgUnitUids().size())
                    .getBytes(StandardCharsets.UTF_8));
            md.update((byte) 0);
            // Dimension axes contribute by name only — no values.
            if (q.dimensionFilter() != null) {
                for (final String key : new TreeMap<>(
                        q.dimensionFilter()).keySet()) {
                    md.update(key.getBytes(StandardCharsets.UTF_8));
                    md.update((byte) 0);
                }
            }
            final byte[] digest = md.digest();
            final StringBuilder sb = new StringBuilder(digest.length * 2);
            for (int i = 0; i < 8 && i < digest.length; i++) {
                sb.append(String.format("%02x", digest[i]));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(
                    "SHA-256 unavailable on this JVM", ex);
        }
    }
}
