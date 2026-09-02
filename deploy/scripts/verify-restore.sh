#!/usr/bin/env bash
set -euo pipefail

umask 0077

fail() {
  echo "verify-restore: $*" >&2
  exit 1
}

[[ "$#" -eq 2 ]] || fail 'usage: verify-restore.sh BACKUP_DB RESTORE_DIRECTORY'

backup_arg="$1"
target_arg="$2"
sqlite_path="${SQLITE_PATH:-}"

[[ -n "$backup_arg" ]] || fail 'BACKUP_DB must not be empty'
[[ -n "$target_arg" ]] || fail 'RESTORE_DIRECTORY must not be empty'
[[ -n "$sqlite_path" ]] || fail 'SQLITE_PATH is required to protect the live database directory'

command -v realpath >/dev/null 2>&1 || fail 'realpath is required'
command -v sqlite3 >/dev/null 2>&1 || fail 'sqlite3 is required'
command -v mktemp >/dev/null 2>&1 || fail 'mktemp is required'
command -v ln >/dev/null 2>&1 || fail 'ln is required'

backup_db="$(realpath -e -- "$backup_arg")" || fail 'BACKUP_DB must resolve to an existing file'
target_dir="$(realpath -m -- "$target_arg")" || fail 'RESTORE_DIRECTORY could not be resolved'
live_db="$(realpath -m -- "$sqlite_path")" || fail 'SQLITE_PATH could not be resolved'
live_db_parent="$(dirname "$live_db")"

[[ -f "$backup_db" && ! -L "$backup_db" ]] || fail 'BACKUP_DB must be a regular file'
[[ "$backup_db" == *.db ]] || fail 'BACKUP_DB must have a .db extension'
[[ "$target_dir" != '/' ]] || fail 'RESTORE_DIRECTORY must not be /'
[[ "$target_dir" != '/srv/knowledge-frontier/data' ]] || fail 'RESTORE_DIRECTORY must not be the production data directory'
[[ "$target_dir" != "$live_db_parent" ]] || fail 'RESTORE_DIRECTORY must not be the live database directory'

if [[ -e "$target_dir" ]]; then
  [[ -d "$target_dir" ]] || fail 'RESTORE_DIRECTORY must be a directory'
  [[ -z "$(find "$target_dir" -mindepth 1 -maxdepth 1 -print -quit)" ]] || fail 'RESTORE_DIRECTORY must be absent or empty'
else
  mkdir -p -- "$target_dir"
fi

if ! exec {target_fd}<"$target_dir"; then
  fail 'could not open RESTORE_DIRECTORY'
fi
stable_target_dir="/proc/self/fd/$target_fd/."
[[ "$(realpath -e -- "$stable_target_dir")" == "$target_dir" ]] || fail 'RESTORE_DIRECTORY changed during validation'
[[ -z "$(find "$stable_target_dir" -mindepth 1 -maxdepth 1 -print -quit)" ]] || fail 'RESTORE_DIRECTORY must be absent or empty'
restored_db="$stable_target_dir/restored.db"
staging_dir="$(mktemp -d "$stable_target_dir/.knowledge-frontier-restore.XXXXXX")" || fail 'could not create private restore staging directory'
chmod 700 -- "$staging_dir"
staged_db="$staging_dir/restored.db"

cleanup_staging() {
  rm -rf -- "$staging_dir"
  exec {target_fd}<&-
}
trap cleanup_staging EXIT

cp -- "$backup_db" "$staged_db"
integrity_result="$(sqlite3 "$staged_db" 'PRAGMA integrity_check;' | tr -d '\r')"
[[ "$integrity_result" == 'ok' ]] || fail 'restored database integrity_check did not return exactly ok'

# The target was empty before staging; stop if another entry appeared before publication.
[[ -z "$(find "$stable_target_dir" -mindepth 1 -maxdepth 1 ! -name "$(basename "$staging_dir")" -print -quit)" ]] || fail 'RESTORE_DIRECTORY changed during verification'
# This no-clobber link cannot follow or replace a raced restored.db symlink.
ln -- "$staged_db" "$restored_db" || fail 'RESTORE_DIRECTORY changed during verification'
rm -f -- "$staged_db"
rmdir -- "$staging_dir"
trap - EXIT
exec {target_fd}<&-
echo "$target_dir/restored.db"
