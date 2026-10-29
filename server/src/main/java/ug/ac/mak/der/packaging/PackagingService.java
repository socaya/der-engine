package ug.ac.mak.der.packaging;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.build.BuildInfoProvider;

/** §10 Packaging — artefact registry.
 *
 *  <p>Operators who build a .deb or OCI image from this edge post the
 *  resulting path + sha256 to /packaging/artifacts so the admin UI can
 *  show the appliance's provenance.</p>
 */
@Service
public class PackagingService {

    private final JdbcTemplate jdbc;
    private final BuildInfoProvider build;

    public PackagingService(final JdbcTemplate jdbc, final BuildInfoProvider build) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.build = Objects.requireNonNull(build, "build");
    }

    private String appVersion() {
        return build.buildInfo().release();
    }

    public Map<String, Object> summary() {
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("appVersion", appVersion());
        out.put("artifactCount", jdbc.queryForObject(
            "SELECT COUNT(*) FROM der.package_artifact", Long.class));
        out.put("kinds", jdbc.query(
            "SELECT kind, COUNT(*) AS n, MAX(built_at) AS latest "
          + "FROM der.package_artifact GROUP BY kind ORDER BY kind",
            (final ResultSet rs, final int rowNum) -> {
                final Map<String, Object> row = new LinkedHashMap<>();
                row.put("kind", rs.getString("kind"));
                row.put("count", rs.getLong("n"));
                row.put("latest",
                    rs.getTimestamp("latest") == null ? null
                        : rs.getTimestamp("latest").toInstant().toString());
                return row;
            }));
        out.put("hwKits", hwKits());
        return out;
    }

    public List<Map<String, Object>> artifacts(final int limit) {
        return jdbc.query(
            "SELECT artifact_id, kind, version, arch, sha256, size_bytes, "
          + "built_at, built_by, source_commit, output_path "
          + "FROM der.package_artifact ORDER BY built_at DESC LIMIT ?",
            (final ResultSet rs, final int rowNum) -> {
                final Map<String, Object> row = new LinkedHashMap<>();
                row.put("artifactId", rs.getString("artifact_id"));
                row.put("kind", rs.getString("kind"));
                row.put("version", rs.getString("version"));
                row.put("arch", rs.getString("arch"));
                row.put("sha256", rs.getString("sha256"));
                row.put("sizeBytes", rs.getLong("size_bytes"));
                row.put("builtAt",
                    rs.getTimestamp("built_at").toInstant().toString());
                row.put("builtBy", rs.getString("built_by"));
                row.put("sourceCommit", rs.getString("source_commit"));
                row.put("outputPath", rs.getString("output_path"));
                return row;
            },
            Math.max(1, Math.min(500, limit)));
    }

    public Map<String, Object> record(final Map<String, Object> body, final String user) {
        final UUID id = UUID.randomUUID();
        jdbc.update(
            "INSERT INTO der.package_artifact (artifact_id, kind, version, arch, "
          + "sha256, size_bytes, built_at, built_by, source_commit, output_path) "
          + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            id,
            Objects.toString(body.get("kind"), "DEB"),
            Objects.toString(body.get("version"), appVersion()),
            Objects.toString(body.get("arch"), ""),
            Objects.toString(body.get("sha256"), ""),
            toLong(body.get("sizeBytes")),
            Timestamp.from(Instant.now()),
            user,
            Objects.toString(body.get("sourceCommit"), ""),
            Objects.toString(body.get("outputPath"), ""));
        return Map.of("artifactId", id.toString());
    }

    /** Reference HW kits documented under docs/hardware/. */
    public List<Map<String, Object>> hwKits() {
        return List.of(
            kit("pi5-field", "Raspberry Pi 5 (field kit)",
                "8 GB RAM · 128 GB NVMe · PoE+ HAT · UPS HAT · 802.11ac",
                List.of("facility clinics", "edge devices with intermittent power")),
            kit("mini-n100", "Mini-PC (Intel N100)",
                "16 GB RAM · 512 GB NVMe · dual GbE · USB-UPS",
                List.of("district HQ", "mid-size facility")),
            kit("rack-1u",   "Rack 1U appliance",
                "32 GB ECC · 2x 1 TB NVMe RAID1 · redundant PSU · HSM module",
                List.of("regional hub", "high-availability deployment")));
    }

    private static Map<String, Object> kit(final String id, final String name,
                                            final String specs, final List<String> fit) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("kitId", id);
        m.put("name", name);
        m.put("specs", specs);
        m.put("bestFor", fit);
        return m;
    }

    private static long toLong(final Object v) {
        if (v == null) {
            return 0L;
        }
        if (v instanceof Number n) {
            return n.longValue();
        }
        try {
            return Long.parseLong(v.toString());
        } catch (Exception ex) {
            return 0L;
        }
    }
}
