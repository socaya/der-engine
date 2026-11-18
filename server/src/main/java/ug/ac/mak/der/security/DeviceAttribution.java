package ug.ac.mak.der.security;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Small helper that controllers call to resolve the <em>attribution
 * device</em> — the device identity a write should be filed under in
 * the journal / audit. On a direct submit this is just
 * {@code X-DER-Device-Id}. On a P2P relay (see
 * {@link DeviceApprovalInterceptor#ON_BEHALF_HEADER}) the receiver
 * device is the sender but the write belongs to the on-behalf source
 * so the original attribution is preserved end-to-end.
 *
 * <p>Centralised here (instead of inlined per controller) so a change
 * to the attribution contract — e.g. adding a {@code X-DER-Delegated-By}
 * chain for multi-hop relays — only touches one file.</p>
 */
public final class DeviceAttribution {

    private DeviceAttribution() { }

    /** Device ID the write should be attributed to. Prefers
     *  {@code X-DER-On-Behalf-Of} (the original source), falls back
     *  to {@code X-DER-Device-Id} (the direct sender). Returns null
     *  when neither header is present. */
    public static String attributionDeviceId(final HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        final String onBehalf = request.getHeader(
                DeviceApprovalInterceptor.ON_BEHALF_HEADER);
        if (onBehalf != null && !onBehalf.isBlank()) {
            return onBehalf.trim();
        }
        final String device = request.getHeader(
                DeviceApprovalInterceptor.DEVICE_HEADER);
        if (device != null && !device.isBlank()) {
            return device.trim();
        }
        return null;
    }

    /** Device ID that actually transmitted the request. Always the
     *  direct sender ({@code X-DER-Device-Id}) regardless of the
     *  on-behalf-of header. Null when the header is absent. */
    public static String relayDeviceId(final HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        final String device = request.getHeader(
                DeviceApprovalInterceptor.DEVICE_HEADER);
        if (device == null || device.isBlank()) {
            return null;
        }
        return device.trim();
    }

    /** True when this request is a P2P relay (both headers present). */
    public static boolean isRelay(final HttpServletRequest request) {
        if (request == null) {
            return false;
        }
        final String onBehalf = request.getHeader(
                DeviceApprovalInterceptor.ON_BEHALF_HEADER);
        return onBehalf != null && !onBehalf.isBlank();
    }
}
