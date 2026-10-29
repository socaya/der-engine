# der-2.1.94 (stable)

**Date:** 2026-10-29
**Previous stable:** `der-2.1.93`

## Headline

`https://der.local` now actually resolves and serves the admin UI
on this dev host. Three things land together to close the gap
between the control-plane UI and a live listener:

1. **HTTPS listener on port 8443** — Spring Boot's embedded Tomcat
   gets a second TLS connector alongside the existing HTTP:8085
   port. On first boot DER auto-generates a self-signed PKCS12
   keystore at `~/.der/der-local.p12` using the JDK's own `keytool`.
2. **User-space mDNS responder** (`org.jmdns:jmdns:3.5.9`) — DER
   broadcasts `_der._tcp.local.`, `_derapi._tcp.local.` and
   `_http._tcp.local.` on every usable IPv4 interface so macOS
   Bonjour / Linux `nss-mdns` / Windows Bonjour Print Services
   resolve `der.local` without `/etc/hosts`.
3. **Live listener state on the TLS panel** — `GET /network/tls`
   now returns `httpsEnabled`, `httpsPort`, `mdnsEnabled`,
   `hostname`, so operators see the actual URL DER is serving.

## 1. HTTPS bootstrap

New config:

```yaml
der:
  https:
    enabled: true                 # default; set false for HTTP-only
    port: 8443
    keystore: ~/.der/der-local.p12 # auto-generated if missing
    password: changeit             # dev-only — override per deploy
    alias: der-local
```

On first boot `HttpsBootstrap` spawns `${JAVA_HOME}/bin/keytool` to
create a self-signed PKCS12 keystore:

```
keytool -genkeypair -alias der-local -keyalg RSA -keysize 2048
  -validity 3650 -storetype PKCS12 -keystore ~/.der/der-local.p12
  -storepass changeit
  -dname "CN=der.local, O=DER Edge, L=Dev"
  -ext "SAN=dns:der.local,dns:localhost,ip:127.0.0.1,ip:10.88.0.1"
```

The resulting cert has 4 SAN entries so clients hitting
`https://der.local:8443`, `https://localhost:8443`,
`https://127.0.0.1:8443` or `https://10.88.0.1:8443` all see a
cert that matches.

Then `WebServerFactoryCustomizer` adds a Tomcat connector:

```java
Connector c = new Connector("org.apache.coyote.http11.Http11NioProtocol");
c.setPort(httpsPort);
c.setSecure(true);
c.setScheme("https");
SSLHostConfig ssl = new SSLHostConfig();
ssl.setProtocols("TLSv1.2+TLSv1.3");
SSLHostConfigCertificate cert = new SSLHostConfigCertificate(ssl, Type.UNDEFINED);
cert.setCertificateKeystoreFile(ks.toString());
cert.setCertificateKeystorePassword(password);
cert.setCertificateKeystoreType("PKCS12");
cert.setCertificateKeyAlias(keyAlias);
ssl.addCertificate(cert);
proto.addSslHostConfig(ssl);
```

(Tomcat 10 moved SSL config out of the protocol handler into
`SSLHostConfig` — this is the current API.)

**Pilot Ubuntu edges** replace the auto-generated keystore via the
`LinuxNetworkAgent`: either a facility-CA-signed cert or a
Let's Encrypt cert on a public hostname.

## 2. mDNS responder (JmDNS)

New Maven dep:

```xml
<dependency>
  <groupId>org.jmdns</groupId>
  <artifactId>jmdns</artifactId>
  <version>3.5.9</version>
</dependency>
```

(218 KB jar, auto-module `javax.jmdns`.)

`MdnsResponder` opens a JmDNS instance on every usable IPv4
interface (loopback + any real LAN interface) and registers three
services:

```
_der._tcp.local.      der   :8443  "DER HTTPS admin + capture"
_derapi._tcp.local.   der   :8443  "DER edge-api"
_http._tcp.local.     der   :8085  "HTTP redirect to HTTPS"
```

Startup log on this dev Mac:

```
mDNS responder bound on 192.168.100.50 as der.local
mDNS responder bound on 127.0.0.1 as der.local
HTTPS listener bound at https://localhost:8443 (keystore …/.der/der-local.p12)
```

Live resolution:

```
$ curl -sk https://der.local:8443/edge-api/v1/system/health
{"service":"der-server","status":"UP","version":"2.1.94",…}
```

### Platform support

| Platform | Resolves `der.local`? | Notes |
|---|---|---|
| macOS      | ✓ out of the box | mDNSResponder (Bonjour) always running |
| Linux desktop | needs `nss-mdns` | `sudo apt install libnss-mdns`, see `/etc/nsswitch.conf` |
| Windows    | needs Bonjour Print Services | ships with iTunes; downloadable from Apple |
| Pilot Ubuntu edge | Avahi via LinuxNetworkAgent | set `der.mdns.enabled=false` to disable the JmDNS bean |

Toggle with `der.mdns.enabled=false` to disable the user-space
responder when a system-level responder (Avahi) is active.

## 3. Live listener state on TLS panel

`GET /network/tls` response gains four live fields:

```jsonc
{
  …existing cert fields…,
  "httpsEnabled": true,
  "httpsPort": 8443,
  "mdnsEnabled": true,
  "hostname": "der.local"
}
```

The Security page's TLS cert card already picks up the subject +
SAN from the server, so operators now see the actual listener URL
instead of the aspirational one.

### Cert details verified

```
$ openssl s_client -connect der.local:8443 -servername der.local \
    </dev/null | openssl x509 -noout -subject -issuer -ext subjectAltName -dates

subject=L=Dev, O=DER Edge, CN=der.local
issuer =L=Dev, O=DER Edge, CN=der.local
X509v3 Subject Alternative Name:
    DNS:der.local, DNS:localhost, IP Address:127.0.0.1, IP Address:10.88.0.1
notBefore=Oct 29 15:18:54 2026 GMT
notAfter =Oct 26 15:18:54 2036 GMT
```

### UI loads over HTTPS end-to-end

```
mDNS + HTTPS worked:  true   (navigated https://der.local:8443/admin/)
TLS panel loaded over HTTPS: true
```

Screenshot `/tmp/der-2.1.94-https-security.png` shows the Security
page served from `https://der.local:8443/admin/network/security`.

## 4. Operator notes

### macOS

Nothing to do — Bonjour auto-resolves `der.local`. Open
`https://der.local:8443/admin/` and accept the self-signed cert
once (fingerprint shown on the Security page).

### Linux desktop

```
sudo apt install libnss-mdns
```

### Pilot Ubuntu edge

Set in `.env.local` or systemd unit:

```
DER_HTTPS_ENABLED=true
DER_HTTPS_PORT=8443
DER_HTTPS_KEYSTORE=/etc/der/der-local.p12
DER_MDNS_ENABLED=false     # Avahi handles mDNS at OS level
```

Pre-provision the keystore with a Let's Encrypt or facility-CA cert
before starting the server.

### Browser trust

The auto-generated cert is self-signed, so browsers show a trust
warning on first visit. Accept it once per device — the fingerprint
is the DER internal CA fingerprint shown on the Security page, so
operators can verify out-of-band.

To avoid the warning entirely, pre-provision a facility-CA-signed
cert as above.

## 5. Files changed

```
server/pom.xml                                                     — jmdns 3.5.9 dep
server/src/main/java/ug/ac/mak/der/network/HttpsBootstrap.java     — new; adds Tomcat SSL connector on 8443, auto-generates PKCS12 keystore via keytool
server/src/main/java/ug/ac/mak/der/network/MdnsResponder.java      — new; JmDNS multi-interface broadcaster for _der._tcp / _derapi._tcp / _http._tcp
server/src/main/java/ug/ac/mak/der/network/NetworkService.java     — tlsCertificate() returns live listener state (httpsEnabled/Port/mdnsEnabled/hostname)
```

## Build + test

```
./mvnw -q -DskipTests package                          ✓ 2.1.94 JAR built with jmdns-3.5.9
Startup                                                 ✓ HTTPS :8443 + 2 mDNS instances bound
curl -sk https://der.local:8443/edge-api/v1/system/health → 200
openssl s_client subject                                → CN=der.local, SANs {der.local, localhost, 127.0.0.1, 10.88.0.1}
Playwright navigate https://der.local:8443/admin/      ✓ login + Security page render
```
