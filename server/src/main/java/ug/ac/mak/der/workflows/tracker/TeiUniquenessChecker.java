package ug.ac.mak.der.workflows.tracker;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.metadata.ExtendedMirrorRepository;
import ug.ac.mak.der.metadata.MirroredTrackedEntityAttribute;

/**
 * FR-08-08 — "Apply locally evaluable unique-attribute constraints
 * and flag central collisions."
 *
 * <p>Pre-upsert hook: before DER persists a TEI write, walk every
 * attribute the metadata mirror has flagged
 * {@code unique_attribute = true} and check whether another TEI
 * already holds the same value. Local collisions surface here with
 * the colliding TEI uid; central collisions are classified from the
 * import summary at drain time (handled by the publisher's
 * ResponseClassifier — this service is the <em>local</em> half).</p>
 *
 * <p>Deliberately stateless + optional in its dependencies — the
 * ExtendedMirrorRepository bean is {@code ObjectProvider}-injected
 * so environments without the extended mirror (early boot / test
 * harnesses) pre-degrade to "no uniqueness known, pass through"
 * rather than crashing.</p>
 */
@Service
public class TeiUniquenessChecker {

    private final TrackedEntityRepository teis;
    private final ObjectProvider<ExtendedMirrorRepository> mirrorProvider;

    public TeiUniquenessChecker(final TrackedEntityRepository teis,
                                  final ObjectProvider<ExtendedMirrorRepository> mirrorProvider) {
        this.teis = Objects.requireNonNull(teis, "teis");
        this.mirrorProvider = mirrorProvider;
    }

    /**
     * Check whether the given candidate TEI would collide with an
     * existing one on any unique attribute.
     *
     * @param candidateTeiUid the uid of the row being
     *                        inserted/updated — a match against this
     *                        uid is a self-update, not a collision.
     * @param attributes      attribute map being written.
     * @return {@link Result#ok()} when no collision; otherwise
     *         a {@code Result.collision(...)} with per-attribute
     *         details.
     */
    public Result check(final String candidateTeiUid,
                          final Map<String, String> attributes) {
        if (attributes == null || attributes.isEmpty()) {
            return Result.ok();
        }
        final Set<String> uniqueAttrUids = uniqueAttributeUids();
        if (uniqueAttrUids.isEmpty()) {
            // Mirror says there are no unique attributes (or the
            // extended mirror isn't wired). Nothing to enforce.
            return Result.ok();
        }
        final List<Collision> collisions = new ArrayList<>();
        for (final var entry : attributes.entrySet()) {
            final String attrUid = entry.getKey();
            final String value = entry.getValue();
            if (!uniqueAttrUids.contains(attrUid) || value == null || value.isBlank()) {
                continue;
            }
            // JSONB containment search: TEIs whose attributes map
            // contains {attrUid: value}. Cap at 2 — we just need to
            // know "is there one that isn't me."
            final var hits = teis.search(null, null,
                    Map.of(attrUid, value), 2);
            for (final TrackedEntityRepository.TrackedEntity hit : hits) {
                if (candidateTeiUid != null
                        && candidateTeiUid.equals(hit.teiUid())) {
                    continue; // self-update is fine
                }
                collisions.add(new Collision(attrUid, value, hit.teiUid()));
                break; // one collision per attr is enough for the message
            }
        }
        return collisions.isEmpty() ? Result.ok() : Result.collisions(collisions);
    }

    private Set<String> uniqueAttributeUids() {
        final ExtendedMirrorRepository mirror = mirrorProvider == null
                ? null : mirrorProvider.getIfAvailable();
        if (mirror == null) {
            return Set.of();
        }
        return mirror.findAllTrackedEntityAttributes().stream()
                .filter(MirroredTrackedEntityAttribute::uniqueAttribute)
                .map(MirroredTrackedEntityAttribute::dhis2Uid)
                .collect(Collectors.toUnmodifiableSet());
    }

    /** Uniqueness-check outcome. */
    public record Result(boolean passed, List<Collision> collisions) {
        public static Result ok() {
            return new Result(true, List.of());
        }

        public static Result collisions(final List<Collision> items) {
            return new Result(false, List.copyOf(items));
        }
    }

    /** One (attribute → existing-TEI-uid) clash row. */
    public record Collision(String attributeUid, String value,
                              String existingTeiUid) { }
}
