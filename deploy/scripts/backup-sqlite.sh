#!/usr/bin/env bash
set -euo pipefail

umask 0077

fail() {
  echo "backup-sqlite: $*" >&2
  exit 1
}

sqlite_path="${SQLITE_PATH:-}"
backup_dir="${BACKUP_DIR:-/backups}"

[[ -n "$sqlite_path" ]] || fail 'SQLITE_PATH must not be empty'
[[ -n "$backup_dir" ]] || fail 'BACKUP_DIR must not be empty'

command -v realpath >/dev/null 2>&1 || fail 'realpath is required'
command -v sqlite3 >/dev/null 2>&1 || fail 'sqlite3 is required'
command -v mktemp >/dev/null 2>&1 || fail 'mktemp is required'
command -v ln >/dev/null 2>&1 || fail 'ln is required'

source_db="$(realpath -e -- "$sqlite_path")" || fail 'SQLITE_PATH must resolve to an existing file'
[[ -f "$source_db" && ! -L "$source_db" ]] || fail 'SQLITE_PATH must resolve to a regular file'
source_db_parent="$(dirname "$source_db")"

backup_dir="$(realpath -m -- "$backup_dir")" || fail 'BACKUP_DIR could not be resolved'
[[ "$backup_dir" != '/' ]] || fail 'BACKUP_DIR must not be /'
[[ "$backup_dir" != '/srv/knowledge-frontier/data' ]] || fail 'BACKUP_DIR must not be the production data directory'
[[ "$backup_dir" != "$source_db_parent" ]] || fail 'BACKUP_DIR must not be the live database directory'
mkdir -p -- "$backup_dir"
backup_dir="$(realpath -e -- "$backup_dir")" || fail 'BACKUP_DIR could not be resolved after creation'
[[ -d "$backup_dir" ]] || fail 'BACKUP_DIR must be a directory'
[[ "$backup_dir" != '/' ]] || fail 'BACKUP_DIR must not be /'
[[ "$backup_dir" != '/srv/knowledge-frontier/data' ]] || fail 'BACKUP_DIR must not be the production data directory'
[[ "$backup_dir" != "$source_db_parent" ]] || fail 'BACKUP_DIR must not be the live database directory'
if ! exec {backup_fd}<"$backup_dir"; then
  fail 'could not open BACKUP_DIR'
fi
stable_backup_dir="/proc/self/fd/$backup_fd/."
[[ "$(realpath -e -- "$stable_backup_dir")" == "$backup_dir" ]] || fail 'BACKUP_DIR changed during validation'

timestamp="$(date -u +'%Y%m%dT%H%M%SZ')"
staging_dir="$(mktemp -d "$stable_backup_dir/.knowledge-frontier-backup.XXXXXX")" || fail 'could not create private backup staging directory'
chmod 700 -- "$staging_dir"
staging_token="${staging_dir##*.}"
backup_basename="knowledge-frontier-$timestamp-$staging_token.db"
tmp_backup="$staging_dir/$backup_basename.tmp"
final_backup="$stable_backup_dir/$backup_basename"

cleanup_staging() {
  rm -rf -- "$staging_dir"
  exec {backup_fd}<&-
}
trap cleanup_staging EXIT

# The generated basename contains no shell or SQLite dot-command metacharacters.
(
  cd -- "$staging_dir"
  sqlite3 "$source_db" ".backup ${backup_basename}.tmp"
)

integrity_result="$(sqlite3 "$tmp_backup" 'PRAGMA integrity_check;' | tr -d '\r')"
[[ "$integrity_result" == 'ok' ]] || fail 'backup integrity_check did not return exactly ok'

# A hard-link publication is atomic and refuses an existing destination, including a symlink.
ln -- "$tmp_backup" "$final_backup" || fail 'refusing to replace an existing backup'

# Limit cleanup to direct regular .db children; temporary files and nested data are untouched.
find "$stable_backup_dir" -maxdepth 1 -type f -name '*.db' -mtime +13 -delete

echo "$backup_dir/$backup_basename"
