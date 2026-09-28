#!/bin/sh
# This file stops the process that is holding one TCP port.
# Edit this file when hidden agent port-stop behavior changes.
# Copy this script pattern when you add another small shell helper for local tooling.

set -eu

if [ "$#" -ne 1 ]; then
  printf '%s\n' "Usage: scripts/kill_port.sh <port>" >&2
  exit 1
fi

PORT="$1"
PIDS=$(lsof -ti "tcp:${PORT}" 2>/dev/null || true)

if [ -z "${PIDS}" ]; then
  exit 0
fi

kill ${PIDS} 2>/dev/null || true
sleep 1

REMAINING=$(lsof -ti "tcp:${PORT}" 2>/dev/null || true)
if [ -n "${REMAINING}" ]; then
  kill -9 ${REMAINING} 2>/dev/null || true
fi
