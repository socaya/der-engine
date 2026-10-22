package ug.ac.mak.der.workflows.coc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;

import ug.ac.mak.der.metadata.ExtendedMirrorRepository;

class CategoryOptionComboValidatorTest {

    @Test
    void defaultCocAlwaysKnown() {
        final ExtendedMirrorRepository mirror = mock(ExtendedMirrorRepository.class);
        assertThat(new CategoryOptionComboValidator(mirror).isKnown("HllvX50cXC0")).isTrue();
        verifyNoInteractions(mirror);
    }

    @Test
    void mirrorHit() {
        final ExtendedMirrorRepository mirror = mock(ExtendedMirrorRepository.class);
        when(mirror.categoryOptionComboExists("some-uid")).thenReturn(true);
        assertThat(new CategoryOptionComboValidator(mirror).isKnown("some-uid")).isTrue();
        verify(mirror).categoryOptionComboExists("some-uid");
    }

    @Test
    void mirrorMiss() {
        final ExtendedMirrorRepository mirror = mock(ExtendedMirrorRepository.class);
        when(mirror.categoryOptionComboExists("ghost")).thenReturn(false);
        assertThat(new CategoryOptionComboValidator(mirror).isKnown("ghost")).isFalse();
    }

    @Test
    void nullAndBlankRejected() {
        final ExtendedMirrorRepository mirror = mock(ExtendedMirrorRepository.class);
        assertThat(new CategoryOptionComboValidator(mirror).isKnown(null)).isFalse();
        assertThat(new CategoryOptionComboValidator(mirror).isKnown("")).isFalse();
        assertThat(new CategoryOptionComboValidator(mirror).isKnown("   ")).isFalse();
        verifyNoInteractions(mirror);
    }
}
