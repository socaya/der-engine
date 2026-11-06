package ug.ac.mak.der.apps;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PublicKey;
import java.util.Base64;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import ug.ac.mak.der.security.SecretEnvelope;

/** Unit coverage for {@link AppSigningKeyService}. */
class AppSigningKeyServiceTest {

    private AppCatalogueRepository repo;
    private SecretEnvelope envelope;

    @BeforeEach
    void setUp() {
        repo = mock(AppCatalogueRepository.class);
        envelope = new SecretEnvelope("");
    }

    @Test
    void generatesPersistsAndCaches() {
        // No existing row → service generates + inserts, then re-selects it.
        final AtomicReference<AppCatalogueRepository.SigningKey> captured =
                new AtomicReference<>();
        when(repo.readSigningKey())
                .thenAnswer(inv -> Optional.ofNullable(captured.get()));
        when(repo.insertSigningKey(anyString(), anyString(), anyString(), any()))
                .thenAnswer(inv -> {
                    captured.set(new AppCatalogueRepository.SigningKey(
                            inv.getArgument(0), inv.getArgument(1), inv.getArgument(2)));
                    return 1;
                });

        final AppSigningKeyService svc = new AppSigningKeyService(repo, envelope);
        final byte[] pub = svc.publicKeyRaw();
        assertThat(pub).hasSize(32);
        assertThat(svc.publicKeyBase64()).isEqualTo(Base64.getEncoder().encodeToString(pub));

        // Subsequent calls do not re-persist — the in-memory cache answers.
        svc.publicKeyRaw();
        svc.publicKeyBase64();
        verify(repo, times(1))
                .insertSigningKey(eq("Ed25519"), anyString(), anyString(), any());
    }

    @Test
    void loadsExistingKeyWithoutRegenerating() throws Exception {
        // Seed the repo with a pre-existing keypair so the service must
        // load rather than generate.
        final KeyPair kp = KeyPairGenerator.getInstance("Ed25519").generateKeyPair();
        final String pubB64 = Base64.getEncoder().encodeToString(
                AppSigningKeyService.extractRawPublicKey(kp.getPublic()));
        final String sealed = Base64.getEncoder().encodeToString(kp.getPrivate().getEncoded());
        when(repo.readSigningKey()).thenReturn(Optional.of(
                new AppCatalogueRepository.SigningKey("Ed25519", pubB64, sealed)));

        final AppSigningKeyService svc = new AppSigningKeyService(repo, envelope);
        assertThat(svc.publicKeyBase64()).isEqualTo(pubB64);
        verify(repo, times(0)).insertSigningKey(any(), any(), any(), any());
    }

    @Test
    void signAndVerifyRoundtrip() {
        when(repo.readSigningKey())
                .thenReturn(Optional.empty())
                .thenAnswer(inv -> Optional.of(seededOnInsert.get()));
        setupCaptureOnInsert();

        final AppSigningKeyService svc = new AppSigningKeyService(repo, envelope);
        final byte[] bundle = "console.log('hi');".getBytes();
        final byte[] sig = svc.signBundle(bundle);
        assertThat(sig).hasSize(64);
        assertThat(svc.verify(bundle, sig)).isTrue();
    }

    @Test
    void verifyRejectsTamperedBundle() {
        when(repo.readSigningKey())
                .thenReturn(Optional.empty())
                .thenAnswer(inv -> Optional.of(seededOnInsert.get()));
        setupCaptureOnInsert();

        final AppSigningKeyService svc = new AppSigningKeyService(repo, envelope);
        final byte[] bundle = "clean".getBytes();
        final byte[] sig = svc.signBundle(bundle);
        final byte[] tampered = "CLEAN".getBytes();
        assertThat(svc.verify(tampered, sig)).isFalse();
    }

    @Test
    void verifyReturnsFalseOnMalformedSignature() {
        when(repo.readSigningKey())
                .thenReturn(Optional.empty())
                .thenAnswer(inv -> Optional.of(seededOnInsert.get()));
        setupCaptureOnInsert();

        final AppSigningKeyService svc = new AppSigningKeyService(repo, envelope);
        // Malformed signature (wrong length) → Signature.verify throws
        // SignatureException, which the service wraps as "false".
        assertThat(svc.verify("x".getBytes(), new byte[]{1, 2, 3})).isFalse();
    }

    @Test
    void readFailureAfterInsertPanics() {
        // Simulate the pathological case where insert returns 1 but the
        // follow-up re-select returns empty — the service should blow up.
        when(repo.readSigningKey()).thenReturn(Optional.empty());
        when(repo.insertSigningKey(any(), any(), any(), any())).thenReturn(1);
        assertThatThrownBy(() -> new AppSigningKeyService(repo, envelope).publicKeyRaw())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("signing_key missing");
    }

    // ---- extractRawPublicKey -------------------------------------------

    @Test
    void extractRawPublicKeyRejectsNonEdECKey() throws Exception {
        // Any non-EdECPublicKey (RSA here) should blow the type guard.
        final KeyPair rsa = KeyPairGenerator.getInstance("RSA").generateKeyPair();
        final PublicKey rsaPub = rsa.getPublic();
        assertThatThrownBy(() -> AppSigningKeyService.extractRawPublicKey(rsaPub))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("unexpected key type");
    }

    @Test
    void extractRawPublicKeyProducesThirtyTwoBytes() throws Exception {
        final KeyPair kp = KeyPairGenerator.getInstance("Ed25519").generateKeyPair();
        final byte[] raw = AppSigningKeyService.extractRawPublicKey(kp.getPublic());
        assertThat(raw).hasSize(32);
    }

    // ---- helpers -------------------------------------------------------

    private final AtomicReference<AppCatalogueRepository.SigningKey> seededOnInsert =
            new AtomicReference<>();

    private void setupCaptureOnInsert() {
        when(repo.insertSigningKey(anyString(), anyString(), anyString(), any()))
                .thenAnswer(inv -> {
                    seededOnInsert.set(new AppCatalogueRepository.SigningKey(
                            inv.getArgument(0), inv.getArgument(1), inv.getArgument(2)));
                    return 1;
                });
    }
}
