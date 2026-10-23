package ug.ac.mak.der.workflows.tracker;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class EnrollmentTest {

    @Test
    void acceptsValidEnrollment() {
        final UUID u = UUID.randomUUID();
        final Enrollment e = new Enrollment("aBcDeFgHiJk", "aBcDeFgHiJ2",
                "aBcDeFgHiJ3", "aBcDeFgHiJ4", Enrollment.Status.ACTIVE,
                LocalDate.of(2026, 10, 23), null, "nurse.alice",
                u, Instant.now(), Instant.now(), 1);
        assertThat(e.status()).isEqualTo(Enrollment.Status.ACTIVE);
    }

    @Test
    void rejectsBadUid() {
        assertThatThrownBy(() -> new Enrollment("bad", "aBcDeFgHiJ2",
                "aBcDeFgHiJ3", "aBcDeFgHiJ4", Enrollment.Status.ACTIVE,
                LocalDate.of(2026, 10, 23), null, null,
                UUID.randomUUID(), Instant.now(), Instant.now(), 1))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
