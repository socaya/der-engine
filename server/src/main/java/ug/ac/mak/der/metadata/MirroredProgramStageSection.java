package ug.ac.mak.der.metadata;

import java.util.List;
import java.util.Objects;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * A DHIS2 program-stage section, as ingested by MetadataSyncService and
 * surfaced to CaptureFormService so it can emit per-section
 * FormAssembly rows instead of lumping every data element into one
 * flat section (the pre-Phase-1 behavior).
 *
 * <p>sortOrder drives the order operators see sections in. The
 * renderType* fields carry the DHIS2 enum (LISTING / MATRIX /
 * SEQUENTIAL) verbatim and are nullable — older metadata sometimes
 * omits them, in which case the client falls back to LISTING.</p>
 */
public record MirroredProgramStageSection(
        String dhis2Uid,
        String programStageUid,
        String displayName,
        Integer sortOrder,
        String renderTypeDesktop,
        String renderTypeMobile,
        List<String> dataElementUids,
        JsonNode payload
) implements MirroredEntity {

    public MirroredProgramStageSection {
        Objects.requireNonNull(dhis2Uid, "dhis2Uid");
        Objects.requireNonNull(programStageUid, "programStageUid");
        Objects.requireNonNull(displayName, "displayName");
        dataElementUids = dataElementUids == null
                ? List.of() : List.copyOf(dataElementUids);
        payload = MirroredEntity.requirePayload(payload);
    }
}
