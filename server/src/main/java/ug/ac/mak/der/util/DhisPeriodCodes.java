package ug.ac.mak.der.util;

import java.util.regex.Pattern;

/**
 * §2.3.100 R-J — DHIS2 period-code validator.
 *
 * <p>The admin UI's {@code PeriodPicker} generates valid codes, but
 * nothing stops a hand-crafted request to {@code /data/aggregate}
 * with a malformed {@code ?period=} string. Rather than let it
 * silently return 0 rows (and then puzzle operators), the controller
 * calls {@link #isValid} and rejects with {@code PERIOD_INVALID}.</p>
 *
 * <p>Patterns match the client generator in
 * {@code admin-ui/src/lib/dhis2Periods.ts} and the DHIS2 2.44
 * {@code org.hisp.dhis.period.*} outputs byte-for-byte.</p>
 */
public final class DhisPeriodCodes {

    private DhisPeriodCodes() { /* static */ }

    // Daily:              YYYYMMDD                e.g. 20241115
    private static final Pattern DAILY           = Pattern.compile("^\\d{4}(0[1-9]|1[0-2])(0[1-9]|[12]\\d|3[01])$");
    // Weekly ISO:         YYYYWww                 e.g. 2024W47
    private static final Pattern WEEKLY          = Pattern.compile("^\\d{4}W(0[1-9]|[1-4]\\d|5[0-3])$");
    // Monthly:            YYYYMM                  e.g. 202411
    private static final Pattern MONTHLY         = Pattern.compile("^\\d{4}(0[1-9]|1[0-2])$");
    // BiMonthly:          YYYY0M + B              e.g. 202406B
    private static final Pattern BIMONTHLY       = Pattern.compile("^\\d{4}0[1-6]B$");
    // Quarterly:          YYYYQn                  e.g. 2024Q4
    private static final Pattern QUARTERLY       = Pattern.compile("^\\d{4}Q[1-4]$");
    // SixMonthly Jan:     YYYYSn                  e.g. 2024S2
    private static final Pattern SIX_MONTHLY     = Pattern.compile("^\\d{4}S[12]$");
    // SixMonthly April:   YYYYAprilSn             e.g. 2024AprilS1
    private static final Pattern SIX_MONTHLY_APR = Pattern.compile("^\\d{4}AprilS[12]$");
    // Yearly:             YYYY                    e.g. 2024
    private static final Pattern YEARLY          = Pattern.compile("^\\d{4}$");
    // Financial year:     YYYYApril|July|Oct      e.g. 2024April
    private static final Pattern FINANCIAL       = Pattern.compile("^\\d{4}(April|July|Oct)$");

    public static boolean isValid(final String code) {
        if (code == null || code.isBlank()) {
            return false;
        }
        return DAILY.matcher(code).matches()
            || WEEKLY.matcher(code).matches()
            || MONTHLY.matcher(code).matches()
            || BIMONTHLY.matcher(code).matches()
            || QUARTERLY.matcher(code).matches()
            || SIX_MONTHLY.matcher(code).matches()
            || SIX_MONTHLY_APR.matcher(code).matches()
            || FINANCIAL.matcher(code).matches()
            || YEARLY.matcher(code).matches();
    }
}
