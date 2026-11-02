package ug.ac.mak.der.util;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** §2.3.100 R-J — proves the validator accepts every DHIS2 2.44
 *  period family and rejects the obvious hand-typed mistakes. */
class DhisPeriodCodesTest {

    @ParameterizedTest
    @ValueSource(strings = {
        "20241115",      // Daily
        "2024W47",       // Weekly ISO
        "202411",        // Monthly
        "202406B",       // BiMonthly
        "2024Q4",        // Quarterly
        "2024S2",        // SixMonthly
        "2024AprilS1",   // SixMonthlyApril
        "2024",          // Yearly
        "2024April",     // FinancialApril
        "2024July",      // FinancialJuly
        "2024Oct",       // FinancialOct
    })
    void acceptsValidCodes(final String code) {
        assertThat(DhisPeriodCodes.isValid(code)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "",              // blank
        "   ",           // whitespace
        "2024-11",       // ISO date, not DHIS2 code
        "2024/11",
        "202413",        // Month 13
        "2024W54",       // Week 54 is invalid
        "2024Q5",        // Q5 doesn't exist
        "2024S3",        // S3 doesn't exist
        "202407B",       // 7th bi-month doesn't exist
        "2024Mar",       // Non-canonical month name
        "foo",
    })
    void rejectsInvalidCodes(final String code) {
        assertThat(DhisPeriodCodes.isValid(code)).isFalse();
    }
}
