#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v systemd-run >/dev/null || ! systemctl --user show-environment >/dev/null; then
  printf 'A Linux systemd user session is required for the benchmark memory/process guard.\n' >&2
  exit 1
fi
export NODE_OPTIONS=--max-old-space-size=2048
export CARGO_BUILD_JOBS=2
exec systemd-run --user --scope --quiet --unit="realworld-perf-$(date +%s)-$$" \
  --property=MemoryMax=12G --property=MemorySwapMax=0 --property=TasksMax=1024 \
  timeout --signal=TERM --kill-after=30s 3600s node "$@"
