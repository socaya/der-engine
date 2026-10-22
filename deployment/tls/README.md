# Local TLS for DER — Phase 02 skeleton

> **Status:** install guidance only. Spring Boot HTTPS is NOT enabled by default at Phase 02 so unit/integration tests run over plain HTTP against the dev loopback. Enabling TLS is a Phase 06 (operational resilience) deliverable and will introduce proper certificate rotation.

## Why

FR-16-01 (TLS on LAN) and NFR-05 (Authorisation) require authenticated,
encrypted transport between DER clients and the edge. This runbook codifies the
dev-friendly path: generate a self-signed cert and configure Spring Boot to
present it on port 8443. Production deployments must use a cert from an
authority trusted on client devices (institutional CA or an ACME issuer); the
rotation process is formalised in Phase 06.

## Dev certificate generation

```bash
mkdir -p ~/.der/tls

# Generate a PKCS#12 keystore valid for localhost. The password is a dev-only
# placeholder; rotate before any shared deployment.
keytool -genkeypair \
    -alias der-edge \
    -keyalg EC -groupname secp256r1 \
    -storetype PKCS12 \
    -keystore ~/.der/tls/der-edge.p12 \
    -storepass der-dev-only \
    -validity 365 \
    -dname "CN=localhost, OU=DER, O=Makerere, L=Kampala, C=UG" \
    -ext "SAN=DNS:localhost,IP:127.0.0.1"
```

The keystore path and password are consumed by Spring Boot via:

```yaml
server:
  port: 8443
  ssl:
    enabled: true
    key-store: file:/Users/you/.der/tls/der-edge.p12
    key-store-type: PKCS12
    key-store-password: ${DER_TLS_KEYSTORE_PASSWORD}
    key-alias: der-edge
```

Alternatively via env:

```bash
export DER_PORT=8443
export SERVER_SSL_ENABLED=true
export SERVER_SSL_KEY_STORE=file:/Users/you/.der/tls/der-edge.p12
export SERVER_SSL_KEY_STORE_PASSWORD=der-dev-only
export SERVER_SSL_KEY_STORE_TYPE=PKCS12
export SERVER_SSL_KEY_ALIAS=der-edge
```

## When TLS is enabled, cookie-secure MUST flip to true

The DER session cookie's `Secure` flag defaults to `false` so sign-in works over
plain HTTP in dev. Set

```bash
export DER_SESSION_COOKIE_SECURE=true
```

before enabling TLS or `.env.local` is already updated.

## Trusting the self-signed cert

```bash
# macOS: add to the system keychain for curl/browser clients.
sudo security add-trusted-cert -d -r trustRoot \
    -k /Library/Keychains/System.keychain \
    ~/.der/tls/der-edge.p12   # imports as a cert; may prompt for password
```

## Phase 02 deliberate non-goals

- No ACME / Let's Encrypt automation. Phase 06.
- No cert rotation runner. Phase 06.
- No mTLS to the central DHIS2. The outbound `der.dhis2.central.base-url`
  continues to use plain HTTPS with the server-side cert validated via the JDK
  default trust store.
