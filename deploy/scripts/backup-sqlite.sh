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

timestamp="$(date -u +'%Y%m%dT%H%M%SZ')"
tmp_backup="$backup_dir/knowledge-frontier-$timestamp-$$.db.tmp"
final_backup="${tmp_backup%.tmp}"
[[ ! -e "$tmp_backup" && ! -e "$final_backup" ]] || fail 'refusing to replace an existing backup'

cleanup_tmp() {
  rm -f -- "$tmp_backup"
}
trap cleanup_tmp EXIT

# SQLite's dot-command parser accepts SQL-style quoted filenames.
sqlite_backup_path="${tmp_backup//\'/\'\'}"
sqlite3 "$source_db" ".backup '$sqlite_backup_path'"

integrity_result="$(sqlite3 "$tmp_backup" 'PRAGMA integrity_check;' | tr -d '\r')"
[[ "$integrity_result" == 'ok' ]] || fail 'backup integrity_check did not return exactly ok'

# Both names are in the validated backup directory, so this is an atomic rename.
mv -- "$tmp_backup" "$final_backup"
trap - EXIT

# Limit cleanup to direct regular .db children; temporary files and nested data are untouched.
find "$backup_dir" -maxdepth 1 -type f -name '*.db' -mtime +13 -delete

echo "$final_backup"
