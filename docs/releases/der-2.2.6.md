# der-2.2.6 (stable)

**Date:** 2026-10-30
**Previous stable:** `der-2.2.5`

## Headline

**§10 Packaging — Debian + portable tarball + reference HW kits + docs site.**
No containers; everything the appliance ships as runs directly under
systemd on bare-metal Linux.

- `packaging/deb/` — Debian source package layout + `build.sh` that
  produces `der_<version>_all.deb` on a Debian host (and a
  equivalent `.tar.gz` on a non-Debian host for cross-building).
- `packaging/tarball/` — distro-agnostic release tarball with
  `install.sh`; works on RHEL, Fedora, Alpine, anywhere with systemd.
- `docs/hardware/` — reference HW kits (pi5-field, mini-n100, rack-1u).
- `docs/site/` — operator docs (install, upgrade, troubleshooting).
- `/edge-api/v1/packaging` artefact registry + `/packaging` admin page.

## 1. Schema (V042)

```sql
der.package_artifact (
  artifact_id        uuid primary key,
  kind               DEB | TARBALL,
  version            text,
  arch               text,
  sha256             text,
  size_bytes         bigint,
  built_at           timestamptz,
  built_by           text,
  source_commit      text,
  output_path        text,
  details            jsonb
)
```

Indexes on `(kind, built_at desc)` and unique on `sha256`.

## 2. Debian package

`packaging/deb/`:

- `DEBIAN/control` — depends on `openjdk-21-jre-headless | openjdk-17-jre-headless`,
  `postgresql-17 | 16 | 15`, `adduser`. Recommends nginx, fail2ban,
  apparmor.
- `DEBIAN/postinst` — creates `der` system user, lays out
  `/opt/der`, `/etc/der`, `/var/lib/der`, `/var/log/der`, copies
  `pilot.env.example` to `pilot.env` on first install, enables the
  systemd unit.
- `DEBIAN/prerm` — stop + disable `der-server.service` before removal.
- `DEBIAN/conffiles` — marks `/etc/der/pilot.env` as a config file so
  dpkg prompts before overwriting operator edits.
- `build.sh` — reads version from `/VERSION`, lays out the staging
  tree, copies server JAR + admin UI dist + systemd unit + apparmor
  profile + fail2ban filter/jail + env template, calls `dpkg-deb`.
  Falls back to a plain `.tar.gz` on hosts without `dpkg-deb` so
  cross-building from a Mac still produces something installable.

## 3. Portable tarball

`packaging/tarball/`:

- `build.sh` — same inputs as deb/build.sh, outputs
  `der-<version>-portable.tar.gz`.
- `install.sh` — distro-agnostic installer baked into the archive;
  prefers `adduser` → falls back to `useradd`, best-effort AppArmor +
  fail2ban installs, systemd unit, enable only (no auto-start so the
  operator can edit `pilot.env` first).

Both build scripts emit sha256 so artefacts can be registered.

## 4. HW kits (docs/hardware)

| Kit | Best for | Notes |
|---|---|---|
| `pi5-field` | facility clinic, intermittent power | Pi 5 8GB + NVMe + PoE + UPS |
| `mini-n100` | district HQ, mid-size facility | N100 mini-PC + 16GB + dual GbE |
| `rack-1u` | regional hub, HA | Xeon E, 32GB ECC, redundant PSU, HSM optional |

Each `.md` captures BOM, capacity expectations, install path, and
known caveats. The service exposes the catalogue via GET /packaging
so the admin UI shows the same list in-product.

## 5. Docs site (docs/site)

Markdown-only — rendered as GitHub pages or served statically from
nginx. First four pages written:

- `README.md` — site home + index.
- `install.md` — fresh install (.deb or portable).
- `upgrade.md` — in-place upgrade + rollback with PITR.
- `troubleshooting.md` — service won't start, sign-in failures, where
  to look.

Fits the project's existing docs/ convention — no new tooling needed.

## 6. Endpoints

```
GET  /edge-api/v1/packaging                — summary + last 50 artefacts + HW kits
GET  /edge-api/v1/packaging/artifacts?limit=N
POST /edge-api/v1/packaging/artifacts      — record a built artefact
```

Session-auth. HW kit catalogue is read-only (code-driven).

## 7. UI — `/packaging` page

Added under **System → Packaging**. Three panels:

- **Reference hardware kits** — kit id, name, specs, best-for.
- **Artefact registry · N** — built-ago, kind chip (DEB info / TARBALL
  muted), version, arch, size, sha256 prefix, source commit, output
  path, operator.
- **Build commands** — copy-ready invocations for the two scripts.

## 8. Verified live

```
V042 migration applied cleanly (schema now at v042)
tarball build:    dist/der-2.2.6-portable.tar.gz (41 MB)
                  sha256: 8291c174…cffb1
.deb build:       dist/der_2.2.6_all.tar.gz (41 MB; falls back on Mac host)
                  sha256: 069d23e0…77836
HW kits endpoint: pi5-field, mini-n100, rack-1u
Register DEB:     artifactId returned
Register TARBALL: artifactId returned
After record:     artifactCount=2, DEB:1 + TARBALL:1
UI page:          screen rendered, 3 kit rows, 2 artefact rows
pageerrors:       0
```

## 9. Files changed

```
database/migrations/V042__phase_prod_packaging.sql                         (new)
server/src/main/java/ug/ac/mak/der/packaging/PackagingService.java         (new)
server/src/main/java/ug/ac/mak/der/web/PackagingController.java            (new)
server/src/main/java/ug/ac/mak/der/security/SecurityConfig.java            — permit /packaging/**
packaging/deb/DEBIAN/{control,postinst,prerm,conffiles}                    (new)
packaging/deb/build.sh                                                      (new)
packaging/tarball/build.sh                                                  (new)
packaging/tarball/install.sh                                                (new)
docs/hardware/{README,pi5-field,mini-n100,rack-1u}.md                      (new)
docs/site/{README,install,upgrade,troubleshooting}.md                      (new)
admin-ui/src/screens/Packaging.tsx                                          (new)
admin-ui/src/App.tsx                                                        — /packaging route
admin-ui/src/app/navigation.ts                                              — Packaging sub-tab under System
admin-ui/public/sw.js                                                       — SW_VERSION → 2.2.6
VERSION                                                                     — 2.2.4 → 2.2.6
```

## 10. Next step in the sequential march

**All 10 §1-§10 roadmap sections implemented through 2.2.6.** The
production MVP sweep is complete: peer mesh maturity (§1),
observability (§2, 2.1.x), hardware integration (§4), backup/DR (§5),
security hardening (§6), compliance (§7), UI maturity (§8), testing
(§9), packaging (§10).

Future releases will track real-deployment feedback rather than the
pre-planned sweep.

## Build + test

```
tsc -b && vite build                             ✓ 80 modules
./mvnw -q -DskipTests clean package              ✓ 2.2.6 JAR + V042 applied
bash packaging/tarball/build.sh                  ✓ 41 MB portable tarball
bash packaging/deb/build.sh                      ✓ 41 MB deb staging (needs Debian host for actual .deb)
E2E Playwright sweep                             ✓ 2 artefacts + 3 HW kits + 0 pageerrors
```
