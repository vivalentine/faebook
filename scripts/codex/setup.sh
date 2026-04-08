#!/usr/bin/env bash
set -euo pipefail

echo "==> Codex setup starting"

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

install_deps() {
  local dir="$1"

  if [[ ! -d "$dir" ]]; then
    echo "Missing directory: $dir"
    exit 1
  fi

  if [[ -f "$dir/package-lock.json" ]]; then
    echo "==> npm ci in $dir"
    npm ci --prefix "$dir"
  else
    echo "==> npm install in $dir"
    npm install --prefix "$dir"
  fi
}

echo "==> Installing root dependencies"
install_deps "."

echo "==> Installing client dependencies"
install_deps "apps/client"

echo "==> Installing server dependencies"
install_deps "apps/server"

echo "==> Codex setup finished"