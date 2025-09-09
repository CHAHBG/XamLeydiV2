#!/bin/bash
# Helper to run EAS build in CI-like environment (expects EAS_TOKEN env var)
set -euo pipefail
if [ -z "${EAS_TOKEN:-}" ]; then
  echo "EAS_TOKEN not set"
  exit 1
fi
npm ci
npm install -g eas-cli
eas whoami || eas login --token "$EAS_TOKEN"
eas build --platform android --profile production --non-interactive
