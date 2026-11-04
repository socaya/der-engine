package ug.ac.mak.der.security;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

/**
 * Spring Security {@link org.springframework.security.core.Authentication}
 * implementation that carries a resolved {@link EdgeUser} and {@link EdgeSession}.
 *
 * <p>DER never uses the Authentication's credentials field; the raw token
 * stays in the HTTP cookie and must not be reflected into logs.</p>
 */
public final class EdgeUserPrincipal extends AbstractAuthenticationToken {

    private static final long serialVersionUID = 1L;

    private final transient EdgeUser user;
    private final transient EdgeSession session;

    public EdgeUserPrincipal(final EdgeUser user, final EdgeSession session) {
        this(user, session, Set.of());
    }

    /**
     * Constructor that also grants a set of DER authorities (strings prefixed
     * {@code der.}) resolved from {@link RoleDefinitionRepository} for the
     * user's role grants.  Role-based {@code hasRole(..)} rules continue to
     * work via the {@code ROLE_X} authorities derived from
     * {@link EdgeUser#roles()}.
     */
    public EdgeUserPrincipal(final EdgeUser user,
                             final EdgeSession session,
                             final Set<String> authorities) {
        super(toAuthorities(user, authorities));
        this.user = Objects.requireNonNull(user, "user");
        this.session = Objects.requireNonNull(session, "session");
        setAuthenticated(true);
    }

    private static Collection<? extends GrantedAuthority> toAuthorities(final EdgeUser user,
                                                                        final Set<String> authorities) {
        Objects.requireNonNull(user, "user");
        final List<GrantedAuthority> out = new ArrayList<>();
        for (final EdgeRole r : user.roles()) {
            out.add(new SimpleGrantedAuthority("ROLE_" + r.name()));
        }
        if (authorities != null) {
            for (final String a : authorities) {
                if (a != null && !a.isBlank()) {
                    out.add(new SimpleGrantedAuthority(a));
                }
            }
        }
        return List.copyOf(out);
    }

    @Override
    public Object getCredentials() {
        return "[REDACTED]";
    }

    @Override
    public Object getPrincipal() {
        return user;
    }

    @Override
    public String getName() {
        return user.username();
    }

    public UUID userId() {
        return user.userId();
    }

    public EdgeUser user() {
        return user;
    }

    public EdgeSession session() {
        return session;
    }

    /** Convenience for logs: authority list without the ROLE_ prefix. */
    public List<String> roleNames() {
        return user.roles().stream().map(Enum::name).toList();
    }
}
