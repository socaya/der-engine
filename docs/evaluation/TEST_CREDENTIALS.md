# DER local test credentials

> Dev/test only. Rotate before any shared or production use.

## Bootstrap admin

Provisioned at first boot from `.env.local`:

| Field | Value |
|---|---|
| **URL** | `http://localhost:8085/admin/` |
| **Username** | `der-admin` |
| **Password** | `OY2/uIass26KcwqwMIc+UjqlBDNDU4ER` |
| **Role** | `ADMIN` |

## Pre-flight

Before opening `/admin/`, confirm the DER server is up:

```bash
curl -s -o /dev/null -w "DER health: %{http_code}\n" \
  http://localhost:8085/edge-api/v1/system/health
# Expect "DER health: 200"
```

If you see "Edge server is unreachable" on the sign-in form, the
server is not listening on 8085. Start it with:

```bash
cd /Users/stephocay/projects/msdcse-project/der
set -a && source .env.local && set +a
java -jar server/target/der-server-2.0.3-alpha.3-SNAPSHOT.jar
```

Then wait for `Started DerApplication` in the log.

## DHIS2 central (for compat/metadata sync paths)

| Field | Value |
|---|---|
| **URL** | `http://localhost:8080/dhis` |
| **Username** | `admin` |
| **Password** | `district` |
| **Version** | 2.44-SNAPSHOT (Sierra Leone demo) |

## Rotating

Each secret above lives in `.env.local` (gitignored):
`DER_BOOTSTRAP_ADMIN_PASSWORD`, `DER_DHIS2_PASSWORD`,
`DER_SESSION_SECRET`. Change the value, drop the Postgres `der`
database, restart; the bootstrap admin is reprovisioned with the
new secret.
