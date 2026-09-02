#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
backup_script="$repo_root/deploy/scripts/backup-sqlite.sh"
restore_script="$repo_root/deploy/scripts/verify-restore.sh"
maintenance_runner="$repo_root/deploy/scripts/run-maintenance.sh"

for required_script in "$backup_script" "$restore_script" "$maintenance_runner"; do
  if [[ ! -x "$required_script" ]]; then
    echo "FAIL: required executable is missing: $required_script" >&2
    exit 1
  fi
done

assert_unit_line() {
  local unit_path="$1"
  local expected_line="$2"

  if ! grep -Fqx "$expected_line" "$unit_path"; then
    echo "FAIL: expected $unit_path to contain: $expected_line" >&2
    exit 1
  fi
}

assert_no_follow_publication() {
  local script_path="$1"

  if ! grep -Fq 'ln -T --' "$script_path"; then
    echo "FAIL: $script_path must use no-follow link publication" >&2
    exit 1
  fi
}

reconcile_unit="$repo_root/deploy/systemd/knowledge-reconcile.service"
backup_unit="$repo_root/deploy/systemd/knowledge-backup.service"
for unit_path in "$reconcile_unit" "$backup_unit"; do
  assert_unit_line "$unit_path" 'Environment=APP_ENV_FILE=/etc/knowledge-frontier/app.env'
  assert_unit_line "$unit_path" 'TimeoutStartSec=34min'
done
assert_unit_line "$reconcile_unit" 'ExecStart=/srv/knowledge-frontier/current/deploy/scripts/run-maintenance.sh pnpm reconcile:github'
assert_unit_line "$backup_unit" 'ExecStart=/srv/knowledge-frontier/current/deploy/scripts/run-maintenance.sh /opt/knowledge-frontier/scripts/backup-sqlite.sh'
assert_no_follow_publication "$backup_script"
assert_no_follow_publication "$restore_script"

for required_command in sqlite3 realpath find touch cp ln; do
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

backup_symlink_target="$test_root/backup-symlink-target"
backup_symlink="$test_root/backup-symlink"
mkdir "$backup_symlink_target"
ln -s -- "$backup_symlink_target" "$backup_symlink"
expect_failure 'backup rejects a destination directory symlink' \
  env SQLITE_PATH="$source_db" BACKUP_DIR="$backup_symlink" "$backup_script"
expect_failure 'backup rejects a destination directory symlink with a trailing slash' \
  env SQLITE_PATH="$source_db" BACKUP_DIR="$backup_symlink/" "$backup_script"
test -z "$(find "$backup_symlink_target" -maxdepth 1 -type f -print -quit)"

SQLITE_PATH="$source_db" BACKUP_DIR="$backup_dir" "$backup_script"
backup_file="$(find "$backup_dir" -maxdepth 1 -type f -name '*.db' -print -quit)"
test -n "$backup_file"
test ! -e "${backup_file}.tmp"

apostrophe_backup_dir="$test_root/backups-with-'quote"
SQLITE_PATH="$source_db" BACKUP_DIR="$apostrophe_backup_dir" "$backup_script"
test -n "$(find "$apostrophe_backup_dir" -maxdepth 1 -type f -name '*.db' -print -quit)"

fake_ln_bin="$test_root/fake-ln-bin"
mkdir "$fake_ln_bin"
real_ln="$(command -v ln)"
printf '%s\n' \
  '#!/usr/bin/env bash' \
  'set -euo pipefail' \
  'destination="${!#}"' \
  '"$REAL_LN" -s -- "$RACE_REDIRECT_DIR" "$destination"' \
  'exec "$REAL_LN" "$@"' > "$fake_ln_bin/ln"
chmod +x "$fake_ln_bin/ln"
backup_race_dir="$test_root/backup-race"
backup_redirect_dir="$test_root/backup-redirect"
mkdir "$backup_redirect_dir"
expect_failure 'backup does not publish through a raced destination directory symlink' \
  env PATH="$fake_ln_bin:$PATH" REAL_LN="$real_ln" RACE_REDIRECT_DIR="$backup_redirect_dir" SQLITE_PATH="$source_db" BACKUP_DIR="$backup_race_dir" \
  "$backup_script"
test -z "$(find "$backup_redirect_dir" -maxdepth 1 -type f -print -quit)"

expect_failure 'restore rejects the live database parent' \
  env SQLITE_PATH="$source_db" "$restore_script" "$backup_file" "$test_root"

expect_failure 'restore requires SQLITE_PATH to protect the live database parent' \
  env -u SQLITE_PATH "$restore_script" "$backup_file" "$test_root/missing-live-path"
expect_failure 'restore rejects the production data directory' \
  env SQLITE_PATH="$source_db" "$restore_script" "$backup_file" '/srv/knowledge-frontier/data'
expect_failure 'restore rejects the filesystem root' \
  env SQLITE_PATH="$source_db" "$restore_script" "$backup_file" '/'

non_db_backup="$test_root/backup.sqlite"
cp -- "$backup_file" "$non_db_backup"
expect_failure 'restore rejects a backup without a .db extension' \
  env SQLITE_PATH="$source_db" "$restore_script" "$non_db_backup" "$test_root/non-db-restore"

non_regular_backup="$test_root/non-regular.db"
mkdir "$non_regular_backup"
expect_failure 'restore rejects a non-regular backup' \
  env SQLITE_PATH="$source_db" "$restore_script" "$non_regular_backup" "$test_root/non-regular-restore"

restore_symlink_target="$test_root/restore-symlink-target"
restore_symlink="$test_root/restore-symlink"
mkdir "$restore_symlink_target"
ln -s -- "$restore_symlink_target" "$restore_symlink"
expect_failure 'restore rejects a destination directory symlink' \
  env SQLITE_PATH="$source_db" "$restore_script" "$backup_file" "$restore_symlink"
expect_failure 'restore rejects a destination directory symlink with a trailing slash' \
  env SQLITE_PATH="$source_db" "$restore_script" "$backup_file" "$restore_symlink/"
test -z "$(find "$restore_symlink_target" -mindepth 1 -maxdepth 1 -print -quit)"

SQLITE_PATH="$source_db" "$restore_script" "$backup_file" "$restore_dir"
test "$(sqlite3 "$restore_dir/restored.db" 'select value from probe;')" = 'ok'

rollback_data_dir="$test_root/rollback-data"
mkdir "$rollback_data_dir"
rollback_restore_dir="$(mktemp -d "$rollback_data_dir/knowledge-frontier-rollback.XXXXXXXX")"
SQLITE_PATH="$source_db" "$restore_script" "$backup_file" "$rollback_restore_dir"
test "$(sqlite3 "$rollback_restore_dir/restored.db" 'select value from probe;')" = 'ok'

sqlite3 "$source_db" "update probe set value = 'live';"
restore_directory_race="$test_root/restore-directory-race"
restore_redirect_dir="$test_root/restore-redirect"
mkdir "$restore_redirect_dir"
expect_failure 'restore does not publish through a raced destination directory symlink' \
  env PATH="$fake_ln_bin:$PATH" REAL_LN="$real_ln" RACE_REDIRECT_DIR="$restore_redirect_dir" SQLITE_PATH="$source_db" \
  "$restore_script" "$backup_file" "$restore_directory_race"
test -z "$(find "$restore_redirect_dir" -maxdepth 1 -type f -name '*.db' -print -quit)"
test "$(sqlite3 "$source_db" 'select value from probe;')" = 'live'

race_target="$test_root/race-restore"
mkdir "$race_target"
fake_bin="$test_root/fake-bin"
mkdir "$fake_bin"
real_cp="$(command -v cp)"
printf '%s\n' \
  '#!/usr/bin/env bash' \
  'set -euo pipefail' \
  'ln -s -- "$RACE_LIVE_DB" "$RACE_TARGET/restored.db"' \
  'exec "$REAL_CP" "$@"' > "$fake_bin/cp"
chmod +x "$fake_bin/cp"
expect_failure 'restore does not overwrite a live database when restored.db appears during copy' \
  env PATH="$fake_bin:$PATH" REAL_CP="$real_cp" RACE_LIVE_DB="$source_db" RACE_TARGET="$race_target" SQLITE_PATH="$source_db" \
  "$restore_script" "$backup_file" "$race_target"
test "$(sqlite3 "$source_db" 'select value from probe;')" = 'live'

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
