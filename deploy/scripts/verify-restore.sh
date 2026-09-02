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

restored_db="$target_dir/restored.db"
[[ ! -e "$restored_db" ]] || fail 'RESTORE_DIRECTORY must be empty'

cleanup_restore() {
  rm -f -- "$restored_db"
}
trap cleanup_restore EXIT

cp -- "$backup_db" "$restored_db"
integrity_result="$(sqlite3 "$restored_db" 'PRAGMA integrity_check;' | tr -d '\r')"
[[ "$integrity_result" == 'ok' ]] || fail 'restored database integrity_check did not return exactly ok'

trap - EXIT
echo "$restored_db"
