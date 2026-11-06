#!/usr/bin/env bash
#
# Local-dev DER server restart that side-steps the fat-jar classloader
# wedge.
#
# Problem: Spring Boot's fat-jar Launcher opens
# server/target/der-server-*.jar once at process start and then
# re-reads it on every lazy class load. Running `scripts/run_all_checks.sh`
# (or `./mvnw verify`) rewrites that file in place. Lazy class loads in
# the live JVM then fail with ClassNotFoundException — the server
# appears UP on /system/health but 15s-hangs on anything that triggers
# a new class load (new auth path, logback error formatter, etc.).
#
# Fix: run the server from a stable copy at ~/.der/current-der-server.jar
# so gate rebuilds of server/target/... never touch the file the running
# JVM has open.
#
# Usage: bash scripts/dev/restart_der_server.sh
#   - kills any existing java -jar for the DER server
#   - copies server/target/der-server-*.jar to ~/.der/current-der-server.jar
#   - sources .env.local
#   - starts the server in the background, logs to /tmp/der-server-<ts>.log
#   - waits for /system/health to respond
#   - runs a sentinel probe (GET /edge-api/v1/apps + /apps/signing-key)
#     to force lazy class loads that `/system/health` alone doesn't
#     — the wedge signature from the alpha debug notes.
#   - prints the commit hash it's on, or exits 3 with a clear diagnostic

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

JAR_SRC=$(ls -t server/target/der-server-*.jar 2>/dev/null | head -1)
if [[ -z "${JAR_SRC}" ]]; then
    echo "error: no server jar at server/target/der-server-*.jar" >&2
    echo "       build it first: cd server && ./mvnw package -DskipTests" >&2
    exit 1
fi

JAR_DST="${HOME}/.der/current-der-server.jar"
mkdir -p "$(dirname "$JAR_DST")"

echo "stopping any live DER server…"
pkill -9 -f 'java -jar .*der-server-.*\.jar' 2>/dev/null || true
sleep 3

echo "copying ${JAR_SRC} -> ${JAR_DST}"
cp "$JAR_SRC" "$JAR_DST"

if [[ -f .env.local ]]; then
    set -a
    # shellcheck disable=SC1091
    source .env.local
    set +a
else
    echo "warning: .env.local missing — the server will start with default config" >&2
fi

LOG="/tmp/der-server-$(date +%s).log"
nohup java -jar "$JAR_DST" > "$LOG" 2>&1 &
PID=$!
disown
echo "started pid=$PID log=$LOG"

# Wait for /system/health to respond, up to 30s.
for _ in $(seq 1 30); do
    if curl -sf http://localhost:8085/edge-api/v1/system/health --max-time 2 >/dev/null 2>&1; then
        break
    fi
    sleep 1
done
if ! curl -sf http://localhost:8085/edge-api/v1/system/health --max-time 2 >/dev/null 2>&1; then
    echo "error: server did not become healthy within 30s; check $LOG" >&2
    exit 2
fi

# Sentinel probe — catch the fat-jar classloader wedge that
# `/system/health` can't. `/system/health` only touches classes
# loaded at boot; lazy class loads (multipart parsing, signing-key
# codepath, logback's ThrowableProxy, …) only resolve on first use.
# If the JAR under the JVM was rewritten by a parallel `mvnw verify`
# run, those lazy loads 404 with ClassNotFoundException and
# multipart POSTs hang indefinitely, while /health still answers.
#
# Probe two endpoints that force the shaky code paths to resolve:
#   - GET /edge-api/v1/apps        — AppCatalogueController + repo
#   - GET /edge-api/v1/apps/signing-key — AppSigningKeyService
# Both must answer 200 within 5s. Anything else is wedge.
echo "---"
sentinel_fail=""
for path in \
    "/edge-api/v1/apps" \
    "/edge-api/v1/apps/signing-key"; do
    code=$(curl -s -o /dev/null -w "%{http_code}" \
        --max-time 5 "http://localhost:8085${path}") || code="000"
    if [[ "$code" != "200" ]]; then
        sentinel_fail="${sentinel_fail}${path} → HTTP ${code}; "
    fi
done
if [[ -n "$sentinel_fail" ]]; then
    echo "error: sentinel probe FAILED — ${sentinel_fail}" >&2
    echo "       JVM has stale classes loaded; the JAR under it" >&2
    echo "       likely got rewritten mid-run. Kill the server and" >&2
    echo "       rerun this script to restart cleanly. Log: $LOG" >&2
    exit 3
fi

curl -sf http://localhost:8085/edge-api/v1/system/health --max-time 5
echo
