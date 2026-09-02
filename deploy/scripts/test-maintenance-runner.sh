#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
runner="$repo_root/deploy/scripts/run-maintenance.sh"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

[[ -x "$runner" ]] || fail "required executable is missing: $runner"

test_root="$(mktemp -d)"
trap 'rm -rf -- "$test_root"' EXIT
fake_bin="$test_root/bin"
call_log="$test_root/calls.log"
container_state="$test_root/container.state"
mkdir "$fake_bin"

cat >"$fake_bin/flock" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf 'flock:%s\n' "$*" >>"$CALL_LOG"
exit "${FLOCK_STATUS:-0}"
EOF

cat >"$fake_bin/timeout" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf 'timeout:%s\n' "$*" >>"$CALL_LOG"
[[ "$1" == --kill-after=* ]]
shift 2
"$@"
EOF

cat >"$fake_bin/docker" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf 'docker:%s\n' "$*" >>"$CALL_LOG"
if [[ -n "${APP_IMAGE+x}" || -n "${MAINTENANCE_IMAGE+x}" ]]; then
  echo 'inherited image selector reached Docker Compose' >&2
  exit 90
fi

if [[ "$1 $2" == 'container ls' ]]; then
  [[ ! -e "$CONTAINER_STATE" ]] || printf 'fixture-container-id\n'
  exit 0
fi

if [[ "$1 $2" == 'container rm' ]]; then
  if [[ "${CLEANUP_STATUS:-0}" -ne 0 ]]; then
    exit "$CLEANUP_STATUS"
  fi
  rm -f -- "$CONTAINER_STATE"
  exit 0
fi

if [[ "$1" == compose ]]; then
  touch "$CONTAINER_STATE"
  status="${COMPOSE_STATUS:-0}"
  if [[ "$status" -eq 0 ]]; then
    rm -f -- "$CONTAINER_STATE"
  fi
  exit "$status"
fi

exit 2
EOF
chmod +x "$fake_bin/flock" "$fake_bin/timeout" "$fake_bin/docker"

run_runner() {
  env \
    PATH="$fake_bin:$PATH" \
    CALL_LOG="$call_log" \
    CONTAINER_STATE="$container_state" \
    MAINTENANCE_LOCK_FILE="$test_root/maintenance.lock" \
    APP_IMAGE='stale-app-image' \
    MAINTENANCE_IMAGE='stale-maintenance-image' \
    "$runner" probe-command probe-argument
}

assert_status() {
  local expected="$1"
  shift
  local status=0
  "$@" || status=$?
  [[ "$status" -eq "$expected" ]] || fail "expected status $expected, got $status"
}

assert_log_line() {
  local expected="$1"
  grep -Fqx "$expected" "$call_log" || fail "missing call: $expected"
}

: >"$call_log"
run_runner
assert_log_line 'flock:-w 1020 -E 75 9'
assert_log_line 'timeout:--kill-after=30s 15m env -u APP_IMAGE -u MAINTENANCE_IMAGE docker compose --profile maintenance run --name knowledge-frontier-maintenance --rm --no-deps maintenance probe-command probe-argument'
test ! -e "$container_state"

: >"$call_log"
touch "$container_state"
assert_status 76 run_runner
if grep -Fq 'docker:compose ' "$call_log"; then
  fail 'a stale deterministic container must prevent another maintenance run'
fi
test -e "$container_state"
rm -f -- "$container_state"

: >"$call_log"
COMPOSE_STATUS=124 assert_status 124 run_runner
assert_log_line 'docker:container rm --force --volumes knowledge-frontier-maintenance'
test ! -e "$container_state"

: >"$call_log"
COMPOSE_STATUS=124 CLEANUP_STATUS=1 assert_status 70 run_runner
test -e "$container_state"
rm -f -- "$container_state"

: >"$call_log"
FLOCK_STATUS=75 assert_status 75 run_runner
if grep -Fq 'docker:' "$call_log"; then
  fail 'maintenance must not reach Docker without the shared lock'
fi

echo 'PASS: maintenance runner lock, timeout, deterministic name, and cleanup checks'
