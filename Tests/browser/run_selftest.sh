#!/bin/bash
# Usage: run_selftest.sh "<only-filter>" [max_seconds]
LOG=/tmp/kd_chrome.log; rm -f "$LOG"; PROF=$(mktemp -d /tmp/kd-chrome-XXXX)
chromium --headless=new --disable-gpu --no-first-run --disable-background-networking --disable-component-update --disable-sync \
  --user-data-dir="$PROF" --autoplay-policy=no-user-gesture-required --enable-logging=stderr --v=0 \
  "http://127.0.0.1:8777/${3:-selftest.html}?only=$1&r=$RANDOM&$4" > "$LOG" 2>&1 &
PID=$!; MAX=${2:-120}
for ((i = 0; i < MAX; i++)); do grep -q "KDR DONE" "$LOG" 2>/dev/null && break; sleep 1; done
kill $PID 2>/dev/null; wait $PID 2>/dev/null; rm -rf "$PROF"
echo "(${i}s)"; grep 'KDR ' "$LOG" | sed 's/.*KDR //; s/", source.*//; s/"//g; s/,ms:[0-9]*//' | column -t -s' '
