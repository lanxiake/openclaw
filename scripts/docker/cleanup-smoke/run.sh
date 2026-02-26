#!/usr/bin/env bash
set -euo pipefail

cd /repo

export MTBOT_STATE_DIR="/tmp/mtbot-test"
export MTBOT_CONFIG_PATH="${MTBOT_STATE_DIR}/mtbot.json"

echo "==> Seed state"
mkdir -p "${MTBOT_STATE_DIR}/credentials"
mkdir -p "${MTBOT_STATE_DIR}/agents/main/sessions"
echo '{}' >"${MTBOT_CONFIG_PATH}"
echo 'creds' >"${MTBOT_STATE_DIR}/credentials/marker.txt"
echo 'session' >"${MTBOT_STATE_DIR}/agents/main/sessions/sessions.json"

echo "==> Reset (config+creds+sessions)"
pnpm mtbot reset --scope config+creds+sessions --yes --non-interactive

test ! -f "${MTBOT_CONFIG_PATH}"
test ! -d "${MTBOT_STATE_DIR}/credentials"
test ! -d "${MTBOT_STATE_DIR}/agents/main/sessions"

echo "==> Recreate minimal config"
mkdir -p "${MTBOT_STATE_DIR}/credentials"
echo '{}' >"${MTBOT_CONFIG_PATH}"

echo "==> Uninstall (state only)"
pnpm mtbot uninstall --state --yes --non-interactive

test ! -d "${MTBOT_STATE_DIR}"

echo "OK"
