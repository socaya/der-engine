package ug.ac.mak.der.metadata;

import java.util.List;
import java.util.Objects;

import com.fasterxml.jackson.databind.JsonNode;

public record MirroredProgramStage(
        String dhis2Uid,
        String programUid,
        String displayName,
        boolean repeatable,
        /**
         * DHIS2 programStage.formType — DEFAULT / SECTION / CUSTOM.
         * Nullable; absent means older metadata that doesn't carry
         * the hint. Round 2 uses it only to decide whether to group
         * by sections (SECTION or CUSTOM with sections present) or
         * fall back to the pre-Phase-1 lumped layout (DEFAULT).
         */
        String formType,
        /** Raw custom HTML blob for Phase 3 layout-hint parsing. */
        String dataEntryFormHtml,
        List<ProgramStageDataElement> dataElements,
        List<MirroredProgramStageSection> sections,
        JsonNode payload
) implements MirroredEntity {

    public MirroredProgramStage {
        Objects.requireNonNull(dhis2Uid, "dhis2Uid");
        Objects.requireNonNull(programUid, "programUid");
        Objects.requireNonNull(displayName, "displayName");
        dataElements = dataElements == null ? List.of() : List.copyOf(dataElements);
        sections = sections == null ? List.of() : List.copyOf(sections);
        payload = MirroredEntity.requirePayload(payload);
    }

    public record ProgramStageDataElement(
            String dataElementUid,
            boolean compulsory,
            Integer sortOrder,
            /**
             * Per-field DHIS2 renderType (DROPDOWN /
             * VERTICAL_RADIOBUTTONS / HORIZONTAL_RADIOBUTTONS /
             * VERTICAL_CHECKBOXES / HORIZONTAL_CHECKBOXES / TOGGLE /
             * SPINNER / SLIDER / AUTOCOMPLETE / DEFAULT / ...).
             * Nullable; absent = DEFAULT (plain typed input).
             */
            String renderTypeDesktop,
            String renderTypeMobile
    ) {

        public ProgramStageDataElement {
            Objects.requireNonNull(dataElementUid, "dataElementUid");
        }
    }
}
