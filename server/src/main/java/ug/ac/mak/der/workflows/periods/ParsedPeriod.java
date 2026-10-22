package ug.ac.mak.der.workflows.periods;

import java.time.LocalDate;
import java.util.Objects;

import ug.ac.mak.der.dhis2.compatibility.CapabilityFlags;

/**
 * Immutable representation of a DHIS2 period code (e.g. {@code 2026Q1},
 * {@code 202604}, {@code 2026W05}, {@code 20260122}).
 *
 * @param isoCode   the exact code as emitted by DHIS2
 * @param type      resolved {@link CapabilityFlags.PeriodType}
 * @param startDate inclusive start of the period
 * @param endDate   inclusive end of the period
 */
public record ParsedPeriod(String isoCode, CapabilityFlags.PeriodType type,
                            LocalDate startDate, LocalDate endDate) {

    public ParsedPeriod {
        Objects.requireNonNull(isoCode, "isoCode");
        Objects.requireNonNull(type, "type");
        Objects.requireNonNull(startDate, "startDate");
        Objects.requireNonNull(endDate, "endDate");
        if (endDate.isBefore(startDate)) {
            throw new IllegalArgumentException(
                    "endDate must not precede startDate: " + startDate + " .. " + endDate);
        }
    }
}
