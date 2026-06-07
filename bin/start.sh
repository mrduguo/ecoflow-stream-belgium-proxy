#!/bin/sh
set -e

PID_FILE="tmp/proxy.pid"

mkdir -p tmp

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Proxy already running (PID $(cat "$PID_FILE"))"
  exit 1
fi

nohup deno run --allow-all src/index.ts > tmp/proxy.log 2>&1 &
echo $! > "$PID_FILE"
echo "Proxy started (PID $!) — logs in tmp/proxy.log"
