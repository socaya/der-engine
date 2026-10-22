package ug.ac.mak.der.security;

import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Argon2id password hasher with the parameters recommended by OWASP's 2025
 * password-storage cheatsheet for high-security interactive logins:
 *
 * <ul>
 *   <li>Salt length: 16 bytes</li>
 *   <li>Hash length: 32 bytes</li>
 *   <li>Parallelism: 1</li>
 *   <li>Memory: 65_536 KiB (64 MiB)</li>
 *   <li>Iterations: 3</li>
 * </ul>
 *
 * The resulting verifier is scheme-encoded by {@link Argon2PasswordEncoder}
 * (format starts with {@code $argon2id$v=19$...}), so the stored string is
 * self-describing and version-agile.
 */
public final class PasswordHasher {

    private static final int SALT_LENGTH = 16;
    private static final int HASH_LENGTH = 32;
    private static final int PARALLELISM = 1;
    private static final int MEMORY = 65_536;
    private static final int ITERATIONS = 3;

    private final PasswordEncoder encoder;

    public PasswordHasher() {
        this.encoder = new Argon2PasswordEncoder(SALT_LENGTH, HASH_LENGTH, PARALLELISM, MEMORY, ITERATIONS);
    }

    PasswordHasher(final PasswordEncoder encoder) {
        this.encoder = encoder;
    }

    /** Produce a verifier that can later be matched with {@link #verify}. */
    public String hash(final String plaintext) {
        if (plaintext == null || plaintext.isEmpty()) {
            throw new IllegalArgumentException("plaintext must not be null or empty");
        }
        return encoder.encode(plaintext);
    }

    /** Return {@code true} iff {@code plaintext} matches the previously stored verifier. */
    public boolean verify(final String plaintext, final String verifier) {
        if (plaintext == null || plaintext.isEmpty() || verifier == null || verifier.isEmpty()) {
            return false;
        }
        return encoder.matches(plaintext, verifier);
    }
}
