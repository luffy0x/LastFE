#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "verify-compose-images: $*" >&2
  exit 1
}

[[ "$#" -eq 3 ]] || fail 'usage: verify-compose-images.sh COMPOSE_ENV APP_IMAGE MAINTENANCE_IMAGE'

selector_env="$1"
expected_app_image="$2"
expected_maintenance_image="$3"

[[ -n "$expected_app_image" ]] || fail 'APP_IMAGE must not be empty'
[[ -n "$expected_maintenance_image" ]] || fail 'MAINTENANCE_IMAGE must not be empty'
[[ "$expected_app_image" != "$expected_maintenance_image" ]] || fail 'app and maintenance images must be distinct'
command -v realpath >/dev/null 2>&1 || fail 'realpath is required'
command -v docker >/dev/null 2>&1 || fail 'docker is required'
selector_env="$(realpath -e -- "$selector_env")" || fail 'COMPOSE_ENV must resolve to an existing file'
[[ -f "$selector_env" ]] || fail 'COMPOSE_ENV must be a regular file'

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

env -u APP_IMAGE -u MAINTENANCE_IMAGE \
  docker compose --env-file "$selector_env" --profile maintenance config --quiet

rendered_app_image="$({
  env -u APP_IMAGE -u MAINTENANCE_IMAGE \
    docker compose --env-file "$selector_env" --profile maintenance \
      config --images app
})" || fail 'could not render the app image'

rendered_maintenance_image="$({
  env -u APP_IMAGE -u MAINTENANCE_IMAGE \
    docker compose --env-file "$selector_env" --profile maintenance \
      config --images maintenance
})" || fail 'could not render the maintenance image'

[[ "$rendered_app_image" == "$expected_app_image" ]] || fail 'rendered app image does not match the approved app tag'
[[ "$rendered_maintenance_image" == "$expected_maintenance_image" ]] || fail 'rendered maintenance image does not match the approved maintenance tag'

printf 'compose images verified: %s %s\n' "$expected_app_image" "$expected_maintenance_image"
