package ug.ac.mak.der.ops;

import java.io.File;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Locale;
import java.util.Objects;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * FR-14-09: durable storage alarm. Reports the usable bytes on the
 * volume that hosts the data root ({@code der.storage.root}) and
 * classifies the headroom against operator-provided thresholds.
 *
 * <p>Status transitions:
 * <ul>
 *   <li>{@code OK} — usable &ge; warn threshold</li>
 *   <li>{@code WARN} — usable &ge; reject threshold but &lt; warn</li>
 *   <li>{@code REJECT} — usable &lt; reject threshold; callers must
 *     fail new write admission (ADR-0012).</li>
 * </ul>
 */
@Component
public class StorageHealthProbe {

    public enum Status { OK, WARN, REJECT }

    private final Path root;
    private final long warnBytes;
    private final long rejectBytes;

    public StorageHealthProbe(
            @Value("${der.storage.root:${user.home}/.der}") final String root,
            @Value("${der.storage.warn-bytes:536870912}") final long warnBytes,
            @Value("${der.storage.reject-bytes:134217728}") final long rejectBytes) {
        this.root = Paths.get(root).toAbsolutePath().normalize();
        this.warnBytes = warnBytes;
        this.rejectBytes = rejectBytes;
    }

    public Snapshot sample() {
        final File anchor = resolveExistingAncestor(root).toFile();
        final long usable = anchor.getUsableSpace();
        final long total = anchor.getTotalSpace();
        final Status s;
        if (usable < rejectBytes) {
            s = Status.REJECT;
        } else if (usable < warnBytes) {
            s = Status.WARN;
        } else {
            s = Status.OK;
        }
        return new Snapshot(root.toString(), usable, total, warnBytes, rejectBytes, s);
    }

    public boolean admitWrites() {
        return sample().status() != Status.REJECT;
    }

    private static Path resolveExistingAncestor(final Path start) {
        Path p = Objects.requireNonNull(start, "start");
        while (p != null && !p.toFile().exists()) {
            p = p.getParent();
        }
        return p == null ? Paths.get(".").toAbsolutePath() : p;
    }

    public record Snapshot(String root, long usableBytes, long totalBytes,
                            long warnBytes, long rejectBytes, Status status) {

        public String formattedUsable() {
            return formatBytes(usableBytes);
        }

        private static String formatBytes(final long bytes) {
            if (bytes < 1024) {
                return bytes + "B";
            }
            final String[] suf = {"KB", "MB", "GB", "TB"};
            double v = bytes;
            int i = -1;
            while (v >= 1024 && i < suf.length - 1) {
                v /= 1024;
                i++;
            }
            return String.format(Locale.ROOT, "%.1f%s", v, suf[i]);
        }
    }
}
