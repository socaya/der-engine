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
#   - waits for /system/health to respond, prints the commit hash it's on

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
        echo "---"
        curl -sf http://localhost:8085/edge-api/v1/system/health --max-time 5
        echo
        exit 0
    fi
    sleep 1
done

echo "error: server did not become healthy within 30s; check $LOG" >&2
exit 2
