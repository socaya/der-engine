package ug.ac.mak.der.dhis2.compatibility;

/**
 * Single probe result captured by {@link Dhis2CapabilityProbe}.
 *
 * @param endpoint     path probed ({@code /api/system/info}, {@code /api/tracker/events}, …)
 * @param method       HTTP method
 * @param status       HTTP status code; -1 if the request could not be sent
 * @param durationMs   wall-clock duration
 * @param shapeDigest  SHA-256 (hex, first 16 chars) of the response body, or
 *                     {@code null} when the body was not consulted (e.g. the probe
 *                     only cared about reachability)
 * @param notes        operator-oriented hint, e.g. {@code "expected 400 E1003"}
 * @param reachable    convenience flag: {@code true} iff the server answered at all
 */
public record ProbeOutcome(
        String endpoint,
        String method,
        int status,
        long durationMs,
        String shapeDigest,
        String notes,
        boolean reachable
) { }
