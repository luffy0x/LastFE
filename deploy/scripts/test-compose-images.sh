#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
verifier="$repo_root/deploy/scripts/verify-compose-images.sh"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

[[ -x "$verifier" ]] || fail "required executable is missing: $verifier"

test_root="$(mktemp -d)"
trap 'rm -rf -- "$test_root"' EXIT
fake_bin="$test_root/bin"
selector_env="$test_root/compose.env"
call_log="$test_root/calls.log"
mkdir "$fake_bin"
printf 'APP_IMAGE=target-app-image\nMAINTENANCE_IMAGE=target-maintenance-image\n' >"$selector_env"

cat >"$fake_bin/docker" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf 'docker:%s\n' "$*" >>"$CALL_LOG"
if [[ -n "${APP_IMAGE+x}" || -n "${MAINTENANCE_IMAGE+x}" ]]; then
  echo 'inherited image selector reached Compose' >&2
  exit 90
fi
if [[ "$*" == *' config --quiet' ]]; then
  exit "${CONFIG_STATUS:-0}"
fi
arguments=("$@")
selector_env=''
for ((index = 0; index < ${#arguments[@]}; index++)); do
  if [[ "${arguments[$index]}" == --env-file ]]; then
    selector_env="${arguments[$((index + 1))]}"
  fi
done
[[ -n "$selector_env" ]]
service="${arguments[$((${#arguments[@]} - 1))]}"
case "$service" in
  app) sed -n 's/^APP_IMAGE=//p' "$selector_env" ;;
  maintenance) sed -n 's/^MAINTENANCE_IMAGE=//p' "$selector_env" ;;
  *) exit 2 ;;
esac
[[ -z "${EXTRA_RENDERED_IMAGE:-}" ]] || printf '%s\n' "$EXTRA_RENDERED_IMAGE"
EOF
chmod +x "$fake_bin/docker"

run_verifier() {
  env \
    PATH="$fake_bin:$PATH" \
    CALL_LOG="$call_log" \
    EXTRA_RENDERED_IMAGE="${1:-}" \
    APP_IMAGE='stale-app-image' \
    MAINTENANCE_IMAGE='stale-maintenance-image' \
    "$verifier" "$selector_env" 'target-app-image' 'target-maintenance-image'
}

assert_status() {
  local expected="$1"
  shift
  local status=0
  "$@" || status=$?
  [[ "$status" -eq "$expected" ]] || fail "expected status $expected, got $status"
}

run_verifier

printf 'APP_IMAGE=target-app-image\nMAINTENANCE_IMAGE=wrong-maintenance-image\n' >"$selector_env"
assert_status 1 run_verifier

printf 'APP_IMAGE=target-maintenance-image\nMAINTENANCE_IMAGE=target-app-image\n' >"$selector_env"
if run_verifier; then
  fail 'swapped app and maintenance image targets must be rejected'
fi

printf 'APP_IMAGE=target-app-image\nMAINTENANCE_IMAGE=target-app-image\n' >"$selector_env"
if env \
  PATH="$fake_bin:$PATH" \
  CALL_LOG="$call_log" \
  APP_IMAGE='stale-app-image' \
  MAINTENANCE_IMAGE='stale-maintenance-image' \
  "$verifier" "$selector_env" 'target-app-image' 'target-app-image'; then
  fail 'duplicate app and maintenance image targets must be rejected'
fi

printf 'APP_IMAGE=target-app-image\nMAINTENANCE_IMAGE=target-maintenance-image\n' >"$selector_env"
assert_status 1 run_verifier 'unexpected-image'

echo 'PASS: Compose image verification clears inherited selectors and requires exact targets'
