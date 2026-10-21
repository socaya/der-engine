package ug.ac.mak.der.build;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;

import org.junit.jupiter.api.Test;

class BuildInfoTest {

    @Test
    void acceptsAllRequiredFields() {
        final BuildInfo info = new BuildInfo(
                "0.1.0", "abc1234", "main", false, Instant.parse("2026-10-21T00:00:00Z"), "unknown");
        assertThat(info.release()).isEqualTo("0.1.0");
        assertThat(info.commit()).isEqualTo("abc1234");
        assertThat(info.branch()).isEqualTo("main");
        assertThat(info.dirty()).isFalse();
        assertThat(info.buildTime()).isEqualTo(Instant.parse("2026-10-21T00:00:00Z"));
        assertThat(info.dhis2ReferenceVersion()).isEqualTo("unknown");
    }

    @Test
    void rejectsNullRelease() {
        assertThatThrownBy(() -> new BuildInfo(null, "c", "b", false, Instant.EPOCH, "unknown"))
                .isInstanceOf(NullPointerException.class).hasMessage("release");
    }

    @Test
    void rejectsNullCommit() {
        assertThatThrownBy(() -> new BuildInfo("r", null, "b", false, Instant.EPOCH, "unknown"))
                .isInstanceOf(NullPointerException.class).hasMessage("commit");
    }

    @Test
    void rejectsNullBranch() {
        assertThatThrownBy(() -> new BuildInfo("r", "c", null, false, Instant.EPOCH, "unknown"))
                .isInstanceOf(NullPointerException.class).hasMessage("branch");
    }

    @Test
    void rejectsNullBuildTime() {
        assertThatThrownBy(() -> new BuildInfo("r", "c", "b", false, null, "unknown"))
                .isInstanceOf(NullPointerException.class).hasMessage("buildTime");
    }

    @Test
    void rejectsNullDhis2Reference() {
        assertThatThrownBy(() -> new BuildInfo("r", "c", "b", false, Instant.EPOCH, null))
                .isInstanceOf(NullPointerException.class).hasMessage("dhis2ReferenceVersion");
    }
}
