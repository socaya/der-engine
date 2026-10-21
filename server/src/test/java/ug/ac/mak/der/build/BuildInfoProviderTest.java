package ug.ac.mak.der.build;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;

class BuildInfoProviderTest {

    @Test
    void parsesFullBuildAndGitProperties() {
        final Resource buildInfo = resource(
                "build.der.release=0.1.0-SNAPSHOT\n"
                        + "build.dhis2.reference.version=unknown\n"
                        + "build.time=2026-10-21T12:00:00Z\n"
                        + "build.version=0.1.0-SNAPSHOT\n");
        final Resource git = resource(
                "git.commit.id.abbrev=abc1234\n"
                        + "git.commit.id.full=abc1234deadbeef\n"
                        + "git.branch=main\n"
                        + "git.dirty=false\n");

        final BuildInfo info = new BuildInfoProvider(buildInfo, git).buildInfo();

        assertThat(info.release()).isEqualTo("0.1.0-SNAPSHOT");
        assertThat(info.commit()).isEqualTo("abc1234");
        assertThat(info.branch()).isEqualTo("main");
        assertThat(info.dirty()).isFalse();
        assertThat(info.buildTime()).isEqualTo(Instant.parse("2026-10-21T12:00:00Z"));
        assertThat(info.dhis2ReferenceVersion()).isEqualTo("unknown");
    }

    @Test
    void dirtyTreeFlagSurfaces() {
        final Resource buildInfo = resource(
                "build.der.release=0.2.0\nbuild.time=2026-11-01T00:00:00Z\n");
        final Resource git = resource(
                "git.commit.id.abbrev=feedbee\ngit.branch=release/0.2.0\ngit.dirty=true\n");

        final BuildInfo info = new BuildInfoProvider(buildInfo, git).buildInfo();
        assertThat(info.dirty()).isTrue();
        assertThat(info.branch()).isEqualTo("release/0.2.0");
    }

    @Test
    void missingResourcesFallBackToUnknown() {
        final BuildInfo info = new BuildInfoProvider(absentResource(), absentResource()).buildInfo();
        assertThat(info.release()).isEqualTo("unknown");
        assertThat(info.commit()).isEqualTo("unknown");
        assertThat(info.branch()).isEqualTo("unknown");
        assertThat(info.dirty()).isFalse();
        assertThat(info.buildTime()).isEqualTo(Instant.EPOCH);
        assertThat(info.dhis2ReferenceVersion()).isEqualTo("unknown");
    }

    @Test
    void nullResourcesFallBackToUnknown() {
        final BuildInfo info = new BuildInfoProvider(null, null).buildInfo();
        assertThat(info.release()).isEqualTo("unknown");
    }

    @Test
    void blankBuildTimeFallsBackToEpoch() {
        final Resource buildInfo = resource("build.der.release=0.1.0\nbuild.time=   \n");
        final BuildInfo info = new BuildInfoProvider(buildInfo, absentResource()).buildInfo();
        assertThat(info.buildTime()).isEqualTo(Instant.EPOCH);
    }

    @Test
    void malformedBuildTimeThrows() {
        final Resource buildInfo = resource("build.time=not-a-timestamp\n");
        assertThatThrownBy(() -> new BuildInfoProvider(buildInfo, absentResource()))
                .isInstanceOf(java.time.format.DateTimeParseException.class);
    }

    @Test
    void ioErrorIsWrapped() {
        final Resource broken = new ByteArrayResource(new byte[0]) {
            @Override
            public boolean exists() {
                return true;
            }

            @Override
            public InputStream getInputStream() throws IOException {
                throw new IOException("boom");
            }
        };
        assertThatThrownBy(() -> new BuildInfoProvider(broken, absentResource()))
                .isInstanceOf(java.io.UncheckedIOException.class);
    }

    @Test
    void dhis2VersionFlowsThrough() {
        final Resource buildInfo = resource(
                "build.der.release=0.5.0\n"
                        + "build.dhis2.reference.version=2.43.1\n"
                        + "build.time=2026-12-01T00:00:00Z\n");
        final BuildInfo info = new BuildInfoProvider(buildInfo, absentResource()).buildInfo();
        assertThat(info.dhis2ReferenceVersion()).isEqualTo("2.43.1");
    }

    private static Resource resource(final String contents) {
        return new ByteArrayResource(contents.getBytes(StandardCharsets.UTF_8)) {
            @Override
            public boolean exists() {
                return true;
            }
        };
    }

    private static Resource absentResource() {
        return new ByteArrayResource(new byte[0]) {
            @Override
            public boolean exists() {
                return false;
            }
        };
    }
}
