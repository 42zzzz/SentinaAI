#!/usr/bin/env bash
set -euo pipefail

# Creates a Mosquitto password file for username/password authentication.
# Note: if you are using mutual TLS with `use_identity_as_username`, you may not
# need passwords for devices (CN acts as identity). Service accounts can still
# use passwords if desired.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PW_FILE="$ROOT_DIR/services/security/mqtt-broker/passwords"

command -v mosquitto_passwd >/dev/null 2>&1 || {
  echo "ERROR: mosquitto_passwd not found. Install Mosquitto locally to use this script." >&2
  exit 1
}

mkdir -p "$(dirname "$PW_FILE")"

echo "Writing: $PW_FILE"

# Create/overwrite file
rm -f "$PW_FILE"

# Service accounts
mosquitto_passwd -b "$PW_FILE" telemetry-service "change-me"
mosquitto_passwd -b "$PW_FILE" nodered "change-me"

# Example device account (username must match deviceId if using ACL patterns)
mosquitto_passwd -b "$PW_FILE" OCCZA03 "change-me"

echo "Done. Remember to rotate passwords and never commit real secrets." 
