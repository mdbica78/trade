#!/usr/bin/env bash
# QA helper (DEC-012): serve the app locally for the qa-runner subagent, fetch pages, stop it.
#   bash scripts/claude/qa-serve.sh start [--db-unreachable] [--rebuild]
#        builds if sources changed since the last build, starts `next start` on 127.0.0.1:$QA_PORT
#        (default 3100) and waits until it answers. Never uses a real database: DATABASE_URL is
#        unset, or with --db-unreachable set to a local address nothing listens on.
#   bash scripts/claude/qa-serve.sh get <path> [cookie]   → "STATUS <code>" + visible page text
#   bash scripts/claude/qa-serve.sh raw <path> [cookie]   → "STATUS <code>" + raw HTML
#   bash scripts/claude/qa-serve.sh stop
# No git. Logs: /tmp/etf-qa-server.log
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
PORT="${QA_PORT:-3100}"
PIDF="/tmp/etf-qa-server.pid"
LOGF="/tmp/etf-qa-server.log"
export NODE_EXTRA_CA_CERTS="${NODE_EXTRA_CA_CERTS:-/etc/ssl/certs/ca-certificates.crt}"

fetch_js=$(cat <<'JS'
const [, url, mode, cookie] = process.argv;   // node -e: argv[1..] are the arguments
const headers = cookie ? { cookie } : {};
fetch(url, { headers, redirect: "manual", signal: AbortSignal.timeout(30000) })
  .then(async r => {
    let body = await r.text();
    console.log("STATUS " + r.status + (r.headers.get("location") ? "  LOCATION " + r.headers.get("location") : ""));
    if (mode === "text") {
      body = body.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
                 .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
                 .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#x27;|&#39;/g, "'")
                 .replace(/\s+/g, " ").trim();
      console.log(body.slice(0, 6000));
    } else { console.log(body.slice(0, 30000)); }
  })
  .catch(e => { console.log("STATUS ERROR " + (e.cause?.code || e.name || e.message)); process.exit(2); });
JS
)

stop_server() {
  if [ -f "$PIDF" ]; then
    pid="$(cat "$PIDF")"
    kill -- -"$pid" 2>/dev/null || kill "$pid" 2>/dev/null
    sleep 1
    kill -9 -- -"$pid" 2>/dev/null || true
    rm -f "$PIDF"
  fi
  pkill -f "next start -H 127.0.0.1 -p $PORT" 2>/dev/null || true
}

needs_build() {
  [ "${1:-}" = "--rebuild" ] && return 0
  [ -f .next/BUILD_ID ] || return 0
  [ -n "$(find app lib components i18n messages next.config.ts package.json -newer .next/BUILD_ID -print -quit 2>/dev/null)" ]
}

case "${1:-}" in
  start)
    shift; db_mode="none"; rebuild=""
    for a in "$@"; do
      case "$a" in --db-unreachable) db_mode="unreachable" ;; --rebuild) rebuild="--rebuild" ;; esac
    done
    stop_server
    if needs_build "$rebuild"; then
      echo "Building (env -u DATABASE_URL pnpm build)…"
      env -u DATABASE_URL pnpm build > /tmp/etf-qa-build.log 2>&1 || { echo "BUILD FAILED — last lines:"; tail -n 25 /tmp/etf-qa-build.log; exit 3; }
    fi
    if [ "$db_mode" = "unreachable" ]; then
      DBENV=(env DATABASE_URL="postgresql://qa:qa@127.0.0.1:1/qa")
    else
      DBENV=(env -u DATABASE_URL)
    fi
    setsid nohup "${DBENV[@]}" pnpm exec next start -H 127.0.0.1 -p "$PORT" > "$LOGF" 2>&1 < /dev/null &
    echo $! > "$PIDF"
    for _ in $(seq 1 90); do
      if node -e "fetch('http://127.0.0.1:$PORT/',{signal:AbortSignal.timeout(3000)}).then(()=>process.exit(0)).catch(()=>process.exit(1))" 2>/dev/null; then
        echo "QA server ready on http://127.0.0.1:$PORT (database: $db_mode)"; exit 0
      fi
      sleep 1
    done
    echo "QA server did not become ready in 90 s — last log lines:"; tail -n 25 "$LOGF"; stop_server; exit 4 ;;
  get|raw)
    path="${2:-/}"; cookie="${3:-}"
    mode=$([ "$1" = "get" ] && echo text || echo raw)
    node -e "$fetch_js" "http://127.0.0.1:$PORT$path" "$mode" "$cookie" ;;
  stop)
    stop_server; echo "QA server stopped." ;;
  *)
    echo "usage: qa-serve.sh start [--db-unreachable] [--rebuild] | get <path> [cookie] | raw <path> [cookie] | stop"; exit 1 ;;
esac
