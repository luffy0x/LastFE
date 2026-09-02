#!/usr/bin/env bash
set -euo pipefail

umask 0077

fail() {
  local status="$1"
  shift
  echo "run-maintenance: $*" >&2
  exit "$status"
}

[[ "$#" -gt 0 ]] || fail 64 'a maintenance command is required'

for required_command in flock timeout docker; do
  command -v "$required_command" >/dev/null 2>&1 || fail 69 "$required_command is required"
done

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
lock_file="${MAINTENANCE_LOCK_FILE:-/run/lock/knowledge-frontier-maintenance.lock}"
container_name='knowledge-frontier-maintenance'

exec 9>"$lock_file" || fail 73 "could not open maintenance lock: $lock_file"
flock -w 1020 -E 75 9 || exit "$?"

container_ids() {
  env -u APP_IMAGE -u MAINTENANCE_IMAGE \
    docker container ls --all --quiet --filter "name=^/${container_name}$"
}

existing_container_ids="$(container_ids)" || fail 69 'could not inspect the maintenance container'
[[ -z "$existing_container_ids" ]] || fail 76 "stale container exists: $container_name"

cleanup_container() {
  local remaining_container_ids

  remaining_container_ids="$(container_ids)" || {
    echo 'run-maintenance: could not confirm maintenance container state' >&2
    return 1
  }
  if [[ -n "$remaining_container_ids" ]]; then
    timeout --kill-after=10s 30s \
      env -u APP_IMAGE -u MAINTENANCE_IMAGE \
        docker container rm --force --volumes "$container_name" >/dev/null 2>&1 || true
  fi
  remaining_container_ids="$(container_ids)" || {
    echo 'run-maintenance: could not confirm maintenance container cleanup' >&2
    return 1
  }
  [[ -z "$remaining_container_ids" ]] || {
    echo "run-maintenance: maintenance container still exists: $container_name" >&2
    return 1
  }
}

cleanup_on_exit() {
  local status="$?"
  trap - EXIT INT TERM
  if ! cleanup_container; then
    exit 70
  fi
  exit "$status"
}

trap cleanup_on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

cd "$repo_root"
run_status=0
timeout --kill-after=30s 15m \
  env -u APP_IMAGE -u MAINTENANCE_IMAGE \
    docker compose --profile maintenance run \
    --name "$container_name" --rm --no-deps maintenance "$@" || run_status="$?"
exit "$run_status"
