package ug.ac.mak.der.web;

import java.time.Duration;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.AuthenticationService;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.SecurityProperties;

/**
 * Phase 02 identity endpoints: sign-in, sign-out, session introspection.
 *
 * <p>All endpoints emit JSON. Sign-in and sign-out set/clear the DER_SESSION
 * cookie through {@link ResponseCookie} so SameSite + HttpOnly flags are
 * explicit and testable.</p>
 */
@RestController
@RequestMapping(path = "/edge-api/v1/auth", produces = MediaType.APPLICATION_JSON_VALUE)
public class AuthController {

    private final AuthenticationService auth;
    private final SecurityProperties props;

    public AuthController(final AuthenticationService auth, final SecurityProperties props) {
        this.auth = auth;
        this.props = props;
    }

    @PostMapping(path = "/sign-in", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<SignInResponse> signIn(@Valid @RequestBody final SignInRequest req,
                                                 final HttpServletRequest http) {
        final String ip = http.getRemoteAddr();
        final String ua = http.getHeader(HttpHeaders.USER_AGENT);
        final AuthenticationService.SignInOutcome outcome = auth.signIn(req.username(), req.password(), ip, ua);
        if (outcome instanceof AuthenticationService.SignInOutcome.RateLimited) {
            return ResponseEntity.status(429).build();
        }
        if (outcome instanceof AuthenticationService.SignInOutcome.InvalidCredentials) {
            return ResponseEntity.status(401).build();
        }
        final AuthenticationService.SignInOutcome.Success ok = (AuthenticationService.SignInOutcome.Success) outcome;
        final ResponseCookie cookie = buildCookie(ok.rawToken(), props.session().ttl());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(new SignInResponse(
                        ok.user().userId().toString(),
                        ok.user().username(),
                        ok.user().displayName(),
                        ok.user().roles().stream().map(Enum::name).toList(),
                        ok.session().expiresAt().toString()
                ));
    }

    @PostMapping("/sign-out")
    public ResponseEntity<Void> signOut(final Authentication authentication, final HttpServletRequest http) {
        final EdgeUserPrincipal principal = asEdgePrincipal(authentication);
        if (principal == null) {
            return ResponseEntity.status(401).build();
        }
        auth.signOut(principal.session().sessionId(), principal.userId(),
                http.getRemoteAddr(), http.getHeader(HttpHeaders.USER_AGENT));
        final ResponseCookie clear = buildCookie("", Duration.ZERO);
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, clear.toString()).build();
    }

    @GetMapping("/session")
    public ResponseEntity<SignInResponse> session(final Authentication authentication) {
        final EdgeUserPrincipal principal = asEdgePrincipal(authentication);
        if (principal == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(new SignInResponse(
                principal.userId().toString(),
                principal.user().username(),
                principal.user().displayName(),
                principal.roleNames(),
                principal.session().expiresAt().toString()
        ));
    }

    private static EdgeUserPrincipal asEdgePrincipal(final Authentication authentication) {
        return authentication instanceof EdgeUserPrincipal p ? p : null;
    }

    private ResponseCookie buildCookie(final String value, final Duration ttl) {
        return ResponseCookie.from(props.session().cookieName(), value)
                .httpOnly(true)
                .secure(props.session().cookieSecure())
                .path("/")
                .sameSite(props.session().cookieSameSite())
                .maxAge(ttl)
                .build();
    }

    public record SignInRequest(
            @NotBlank @JsonProperty("username") String username,
            @NotBlank @JsonProperty("password") String password
    ) { }

    public record SignInResponse(
            @JsonProperty("userId") String userId,
            @JsonProperty("username") String username,
            @JsonProperty("displayName") String displayName,
            @JsonProperty("roles") java.util.List<String> roles,
            @JsonProperty("expiresAt") String expiresAt
    ) { }
}
