package ug.ac.mak.der.analytics.column.governor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class SpillStoreTest {

    @TempDir Path tmp;

    private SpillStore newStore(final long perQuery, final long global) {
        return new SpillStore(new SpillProperties(
                tmp.toString(), perQuery, global));
    }

    @Test
    void allocateCreatesDirAndTracksHandle() throws IOException {
        final SpillStore s = newStore(10_000L, 100_000L);
        final UUID q = UUID.randomUUID();
        final SpillHandle h = s.allocate(q);

        assertThat(h.queryId()).isEqualTo(q);
        assertThat(h.spillId()).isNotNull();
        assertThat(Files.exists(h.file().getParent())).isTrue();
        assertThat(s.listUsage()).hasSize(1);
    }

    @Test
    void writeAndReadRoundTrip() throws IOException {
        final SpillStore s = newStore(10_000L, 100_000L);
        final UUID q = UUID.randomUUID();
        final SpillHandle h = s.allocate(q);
        final byte[] payload = "hello der analytics".getBytes();

        h.write(payload);
        s.acknowledgeWrite(h, payload.length);

        assertThat(h.sizeBytes()).isEqualTo(payload.length);
        assertThat(h.read()).isEqualTo(payload);
        assertThat(s.currentBytes(q)).isEqualTo(payload.length);
    }

    @Test
    void perQueryLimitRejectsAndDeletesFile() throws IOException {
        final SpillStore s = newStore(10L, 1_000_000L);
        final UUID q = UUID.randomUUID();
        final SpillHandle h = s.allocate(q);
        h.write(new byte[50]);

        assertThatThrownBy(() -> s.acknowledgeWrite(h, 50))
                .isInstanceOf(IOException.class)
                .hasMessageContaining("per-query limit");
        assertThat(Files.exists(h.file())).isFalse();
    }

    @Test
    void globalLimitRejects() throws IOException {
        final SpillStore s = newStore(10_000L, 10L);
        final UUID q = UUID.randomUUID();
        final SpillHandle h = s.allocate(q);
        h.write(new byte[20]);

        assertThatThrownBy(() -> s.acknowledgeWrite(h, 20))
                .isInstanceOf(IOException.class)
                .hasMessageContaining("global limit");
    }

    @Test
    void cleanupRemovesFilesAndFreesBytes() throws IOException {
        final SpillStore s = newStore(10_000L, 100_000L);
        final UUID q = UUID.randomUUID();
        final SpillHandle h1 = s.allocate(q);
        final SpillHandle h2 = s.allocate(q);
        h1.write(new byte[100]);
        h2.write(new byte[50]);
        s.acknowledgeWrite(h1, 100);
        s.acknowledgeWrite(h2, 50);
        assertThat(s.globalBytes()).isEqualTo(150L);

        s.cleanup(q);

        assertThat(s.globalBytes()).isZero();
        assertThat(s.listUsage()).isEmpty();
        assertThat(Files.exists(h1.file())).isFalse();
        assertThat(Files.exists(h2.file())).isFalse();
    }

    @Test
    void cleanupOnUnknownQueryIsNoOp() {
        final SpillStore s = newStore(10_000L, 100_000L);
        s.cleanup(UUID.randomUUID());
        assertThat(s.globalBytes()).isZero();
    }

    @Test
    void appendAccumulatesBytes() throws IOException {
        final SpillStore s = newStore(10_000L, 100_000L);
        final SpillHandle h = s.allocate(UUID.randomUUID());
        h.append("alpha".getBytes());
        h.append("beta".getBytes());
        assertThat(h.sizeBytes()).isEqualTo(9L);
        assertThat(h.read()).isEqualTo("alphabeta".getBytes());
    }

    @Test
    void releasedHandleRejectsFurtherWrites() throws IOException {
        final SpillStore s = newStore(10_000L, 100_000L);
        final UUID q = UUID.randomUUID();
        final SpillHandle h = s.allocate(q);
        s.cleanup(q);
        assertThatThrownBy(() -> h.write(new byte[1]))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void listUsageSortsByBytesDescending() throws IOException {
        final SpillStore s = newStore(10_000L, 100_000L);
        final UUID a = UUID.randomUUID();
        final UUID b = UUID.randomUUID();
        final SpillHandle ha = s.allocate(a);
        final SpillHandle hb = s.allocate(b);
        ha.write(new byte[10]);
        hb.write(new byte[100]);

        final var usage = s.listUsage();
        assertThat(usage).hasSize(2);
        assertThat(usage.get(0).getKey()).isEqualTo(b);
        assertThat(usage.get(0).getValue()).isEqualTo(100L);
    }
}
