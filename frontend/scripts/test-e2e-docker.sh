#!/bin/sh
# This script runs Docker e2e tests from start to finish with one fixed test stack.
# Edit this file when docker e2e ports, startup checks, or cleanup rules change.
# Copy this script pattern when you add another full test command that needs setup and cleanup.

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
FRONTEND_DIR=$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)
REPO_DIR=$(CDPATH= cd -- "${FRONTEND_DIR}/.." && pwd)
COMPOSE_SCRIPT="${REPO_DIR}/scripts/docker-compose.sh"
DOCKER_ENV_FILE="${REPO_DIR}/.docker.env"

if [ ! -f "${DOCKER_ENV_FILE}" ]; then
  printf '%s\n' "Docker config file .docker.env was not found. Run make setup first." >&2
  exit 1
fi

set -a
. "${DOCKER_ENV_FILE}"
set +a

: "${E2E_COMPOSE_PROJECT_NAME:?Missing E2E_COMPOSE_PROJECT_NAME in .docker.env.}"
: "${E2E_APP_MODE:?Missing E2E_APP_MODE in .docker.env.}"
: "${E2E_APP_DEBUG_LOGS:?Missing E2E_APP_DEBUG_LOGS in .docker.env.}"
: "${E2E_COOKIE_SECRET:?Missing E2E_COOKIE_SECRET in .docker.env.}"
: "${E2E_FRONTEND_ORIGIN:?Missing E2E_FRONTEND_ORIGIN in .docker.env.}"
: "${E2E_VITE_BACKEND_URL:?Missing E2E_VITE_BACKEND_URL in .docker.env.}"
: "${E2E_GATEWAY_PORT:?Missing E2E_GATEWAY_PORT in .docker.env.}"
: "${E2E_FRONTEND_URL:?Missing E2E_FRONTEND_URL in .docker.env.}"

PROJECT_NAME="${E2E_COMPOSE_PROJECT_NAME}"
export COMPOSE_PROJECT_NAME="${E2E_COMPOSE_PROJECT_NAME}"
export APP_MODE="${E2E_APP_MODE}"
export APP_DEBUG_LOGS="${E2E_APP_DEBUG_LOGS}"
export COOKIE_SECRET="${E2E_COOKIE_SECRET}"
export FRONTEND_ORIGIN="${E2E_FRONTEND_ORIGIN}"
export VITE_BACKEND_URL="${E2E_VITE_BACKEND_URL}"
export GATEWAY_PORT="${E2E_GATEWAY_PORT}"
export PW_DOCKER_FRONTEND_URL="${E2E_FRONTEND_URL}"

cleanup() {
  "${COMPOSE_SCRIPT}" --env-file "${DOCKER_ENV_FILE}" -p "${PROJECT_NAME}" -f "${REPO_DIR}/docker-compose.yml" -f "${REPO_DIR}/docker-compose.local.yml" down -v --remove-orphans >/dev/null 2>&1 || true
}

wait_for_frontend() {
  i=0
  while [ "$i" -lt 60 ]; do
    if curl -fsS "${PW_DOCKER_FRONTEND_URL}" >/dev/null 2>&1; then
      return 0
    fi
    i=$((i + 1))
    sleep 1
  done

  printf '%s\n' "Docker frontend did not start on ${PW_DOCKER_FRONTEND_URL}." >&2
  return 1
}

trap cleanup EXIT INT TERM

cleanup
"${COMPOSE_SCRIPT}" --env-file "${DOCKER_ENV_FILE}" -p "${PROJECT_NAME}" -f "${REPO_DIR}/docker-compose.yml" -f "${REPO_DIR}/docker-compose.local.yml" up -d --build --remove-orphans
wait_for_frontend

cd "${FRONTEND_DIR}"
npx playwright test -c playwright.docker.config.ts "$@"
