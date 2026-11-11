#!/bin/bash
# Session start (cloud only): install the pinned tools and restore the owner's clasp login,
# so `npx clasp push --force` / `update-deployment` work straight away (owner's standing OK,
# 2026-11-11). The login lives in ONE place: the owner's private repo abdullaha24/tony-ngo,
# file context/secrets/clasprc.json. It is copied to ~/.clasprc.json (mode 600) and never
# into this repo. If that repo is not in the session yet, the agent attaches it with the
# add_repo tool (read access) and runs this script again (see AGENTS.md).
set -uo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

# npm ci only when the lockfile or this script changed
hashes=node_modules/.session-start.sha256
if ! sha256sum --check --status "$hashes" 2>/dev/null; then
  rm -f "$hashes"
  npm ci --no-audit --no-fund >/dev/null 2>&1 || npm install --no-audit --no-fund >/dev/null 2>&1
  sha256sum .claude/hooks/session-start.sh package.json package-lock.json > "$hashes" 2>/dev/null || rm -f "$hashes"
fi

umask 077
src=""
for d in /home/user/tony-ngo "$(dirname "$PWD")/tony-ngo"; do
  [ -f "$d/context/secrets/clasprc.json" ] && src="$d/context/secrets/clasprc.json" && break
done
if [ -z "$src" ]; then
  tmp="$(mktemp -d)"
  if git clone -q --depth 1 --filter=blob:none --sparse https://github.com/abdullaha24/tony-ngo "$tmp/t" >/dev/null 2>&1 \
     && git -C "$tmp/t" sparse-checkout set context/secrets >/dev/null 2>&1 \
     && [ -f "$tmp/t/context/secrets/clasprc.json" ]; then
    cp "$tmp/t/context/secrets/clasprc.json" "$HOME/.clasprc.json"
  fi
  rm -rf "$tmp"
else
  cp "$src" "$HOME/.clasprc.json"
fi

if [ -s "$HOME/.clasprc.json" ]; then
  chmod 600 "$HOME/.clasprc.json"
  echo "clasp $(node_modules/.bin/clasp --version 2>/dev/null) ready; login restored to ~/.clasprc.json"
else
  echo "clasp login NOT restored: attach abdullaha24/tony-ngo with add_repo (read), then run .claude/hooks/session-start.sh" >&2
fi
exit 0
