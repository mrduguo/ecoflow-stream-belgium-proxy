#!/bin/sh

PID_FILE="tmp/proxy.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "No PID file found — proxy not running"
  exit 1
fi

PID=$(cat "$PID_FILE")
if kill "$PID" 2>/dev/null; then
  echo "Proxy stopped (PID $PID)"
else
  echo "Process $PID not found — removing stale PID file"
fi
rm -f "$PID_FILE"
