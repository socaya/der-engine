package ug.ac.mak.der.workflows.coc;

import java.util.Objects;

import org.springframework.stereotype.Component;

import ug.ac.mak.der.metadata.ExtendedMirrorRepository;

/**
 * Validator for aggregate-write COCs (and AOCs) against the metadata mirror.
 *
 * <p>Phase 03.5 defaulted to {@code HllvX50cXC0} (DHIS2's default COC). Phase
 * 03.6b enforces that any non-default COC a client submits must exist in
 * {@code metadata_category_option_combo}. The default COC is seeded by the
 * V005 migration so first-boot writes keep working before the first
 * metadata-sync run.</p>
 */
@Component
public class CategoryOptionComboValidator {

    static final String DEFAULT_COC = "HllvX50cXC0";

    private final ExtendedMirrorRepository mirror;

    public CategoryOptionComboValidator(final ExtendedMirrorRepository mirror) {
        this.mirror = Objects.requireNonNull(mirror, "mirror");
    }

    public boolean isKnown(final String uid) {
        if (uid == null || uid.isBlank()) {
            return false;
        }
        if (DEFAULT_COC.equals(uid)) {
            return true;
        }
        return mirror.categoryOptionComboExists(uid);
    }
}
