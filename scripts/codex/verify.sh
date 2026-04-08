#!/usr/bin/env bash
set -euo pipefail

echo "==> Verification starting"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required but was not found in PATH."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required but was not found in PATH."
  exit 1
fi

echo "==> Node version"
node --version

echo "==> npm version"
npm --version

echo "==> Checking required files"
test -f AGENTS.md
test -f package.json
test -f apps/client/package.json
test -f apps/server/package.json

echo "==> Validating server JavaScript syntax"
node --check apps/server/index.js
node --check apps/server/db.js

if [[ -f "apps/server/seed-users.js" ]]; then
  node --check apps/server/seed-users.js
fi

echo "==> Building client"
npm run build

echo "==> Verification finished successfully"