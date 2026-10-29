# Troubleshooting

## Service won't start

```bash
sudo systemctl status der-server
sudo journalctl -u der-server -n 100 --no-pager
```

Common causes:

| Symptom | Fix |
|---|---|
| `Flyway migration failed` | Fix the migration locally first; DER refuses to downgrade. |
| `DER_SESSION_SECRET missing or too short` | ≥ 32 bytes; `openssl rand -base64 48`. |
| `Could not connect to postgres` | Check `pg_hba.conf` + `pg_isready -h localhost`. |
| `Port 8085 already in use` | Change `DER_PORT` in `/etc/der/pilot.env`. |

## Can't sign in

- Reset the admin password via `der-manager.sh reset-admin`.
- Watch the sign-in attempt in `journalctl` — the `AUTH_FAIL` log line
  shows the actual failure reason.

## UI shows "connection error"

Confirm the server is up and the admin UI points at the right host:

```bash
curl -sf http://localhost:8085/edge-api/v1/system/health
```

If the admin UI loads but the data never resolves, check the browser
console for CSP / CORS errors — the admin shell is served same-origin,
so a reverse-proxy rewriting the Host header can break session cookies.

## Where to look

| What | Where |
|---|---|
| Server logs | `/var/log/der/server.log` + `journalctl -u der-server` |
| Audit trail | admin UI → Security & Audit → Audit trail |
| Health probe history | admin UI → System → Testing |
| Fleet view | admin UI → Network → Fleet |

## Still stuck

File an issue at <https://github.com/socaya/der-engine/issues> with
`journalctl -u der-server --since '1 hour ago'` attached.
