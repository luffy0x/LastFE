#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
backup_script="$repo_root/deploy/scripts/backup-sqlite.sh"
restore_script="$repo_root/deploy/scripts/verify-restore.sh"

for required_script in "$backup_script" "$restore_script"; do
  if [[ ! -x "$required_script" ]]; then
    echo "FAIL: required executable is missing: $required_script" >&2
    exit 1
  fi
done

for required_command in sqlite3 realpath find touch; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    echo "NOT RUN: backup round-trip requires $required_command on Linux or WSL" >&2
    exit 77
  fi
done

expect_failure() {
  local label="$1"
  shift

  if "$@"; then
    echo "FAIL: expected failure: $label" >&2
    exit 1
  fi
}

test_root="$(mktemp -d)"
trap 'rm -rf -- "$test_root"' EXIT
source_db="$test_root/source.db"
backup_dir="$test_root/backups"
restore_dir="$test_root/restore"

sqlite3 "$source_db" 'create table probe(value text); insert into probe values("ok");'

expect_failure 'backup rejects an empty SQLITE_PATH' \
  env SQLITE_PATH='' BACKUP_DIR="$backup_dir" "$backup_script"
expect_failure 'backup rejects the filesystem root as BACKUP_DIR' \
  env SQLITE_PATH="$source_db" BACKUP_DIR='/' "$backup_script"
expect_failure 'backup rejects the production data directory as BACKUP_DIR' \
  env SQLITE_PATH="$source_db" BACKUP_DIR='/srv/knowledge-frontier/data' "$backup_script"
expect_failure 'backup rejects the live database parent as BACKUP_DIR' \
  env SQLITE_PATH="$source_db" BACKUP_DIR="$test_root" "$backup_script"

SQLITE_PATH="$source_db" BACKUP_DIR="$backup_dir" "$backup_script"
backup_file="$(find "$backup_dir" -maxdepth 1 -type f -name '*.db' -print -quit)"
test -n "$backup_file"
test ! -e "${backup_file}.tmp"

expect_failure 'restore rejects the live database parent' \
  env SQLITE_PATH="$source_db" "$restore_script" "$backup_file" "$test_root"

expect_failure 'restore requires SQLITE_PATH to protect the live database parent' \
  env -u SQLITE_PATH "$restore_script" "$backup_file" "$test_root/missing-live-path"
expect_failure 'restore rejects the production data directory' \
  env SQLITE_PATH="$source_db" "$restore_script" "$backup_file" '/srv/knowledge-frontier/data'

SQLITE_PATH="$source_db" "$restore_script" "$backup_file" "$restore_dir"
test "$(sqlite3 "$restore_dir/restored.db" 'select value from probe;')" = 'ok'

expect_failure 'restore rejects a non-empty target directory' \
  env SQLITE_PATH="$source_db" "$restore_script" "$backup_file" "$restore_dir"

corrupt_backup="$test_root/corrupt.db"
printf 'not a sqlite database' > "$corrupt_backup"
expect_failure 'restore rejects a backup that fails integrity_check' \
  env SQLITE_PATH="$source_db" "$restore_script" "$corrupt_backup" "$test_root/corrupt-restore"

expired_backup="$backup_dir/expired.db"
sqlite3 "$expired_backup" 'create table expired(value text);'
touch -d '15 days ago' "$expired_backup"
mkdir -p "$backup_dir/nested"
nested_expired_backup="$backup_dir/nested/expired.db"
sqlite3 "$nested_expired_backup" 'create table retained(value text);'
touch -d '15 days ago' "$nested_expired_backup"

SQLITE_PATH="$source_db" BACKUP_DIR="$backup_dir" "$backup_script"
test ! -e "$expired_backup"
test -f "$nested_expired_backup"

echo 'PASS: SQLite backup/restore round-trip and safety checks'
